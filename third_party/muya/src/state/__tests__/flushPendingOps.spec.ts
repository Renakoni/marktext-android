// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import * as json1 from 'ot-json1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { asDoc } from '..';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

// #2938 part 2: `muya.flush()` makes a same-frame edit durable before the
// document is swapped out (a tab switch calls setContent within the same frame
// as the last keystroke). Drives the real typing path: `content.text = ...`
// queues an op + schedules a requestAnimationFrame; the op lands only when that
// frame fires — unless flushed first.

const hosts: HTMLElement[] = [];
beforeEach(() => {
    window.MUYA_VERSION = 'test';
});
afterEach(() => {
    while (hosts.length)
        hosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function boot(md: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: md } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    hosts.push(muya.domNode);
    return muya;
}

function nextFrame(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('muya.flush() — make pending edits durable synchronously (#2938)', () => {
    it('applies a queued edit and emits json-change synchronously', () => {
        const muya = boot('hello\n');
        const leaf = muya.editor.scrollPage!.firstContentInDescendant() as Content;

        let changes = 0;
        muya.eventCenter.on('json-change', () => {
            changes += 1;
        });

        leaf.text = 'hello world'; // queued, not yet applied
        expect(muya.getMarkdown().trim()).toBe('hello');
        expect(changes).toBe(0);

        muya.flush();

        // The edit is now in the document, and a json-change fired — all without
        // waiting for the animation frame.
        expect(muya.getMarkdown().trim()).toBe('hello world');
        expect(changes).toBe(1);
    });

    it('does not attach a redundant post-edit state snapshot', () => {
        const muya = boot('hello\n');
        const leaf = muya.editor.scrollPage!.firstContentInDescendant() as Content;
        let change: Record<string, unknown> | null = null;

        muya.eventCenter.on('json-change', (payload: Record<string, unknown>) => {
            change = payload;
        });

        leaf.text = 'hello world';
        muya.flush();

        expect(change).toHaveProperty('prevDoc');
        expect(change).not.toHaveProperty('doc');
    });

    it('flushing before setContent persists the outgoing edit (no loss, no double-flush)', async () => {
        const muya = boot('hello\n');
        const leaf = muya.editor.scrollPage!.firstContentInDescendant() as Content;

        const captured: string[] = [];
        muya.eventCenter.on('json-change', () => {
            captured.push(muya.getMarkdown().trim());
        });

        leaf.text = 'hello world'; // pending

        // Tab-switch sequence: flush the outgoing doc FIRST, then swap.
        muya.flush();
        expect(captured).toEqual(['hello world']); // outgoing edit captured

        muya.setContent('B\n');
        await nextFrame();
        await nextFrame();

        // No leftover op fired against B, and B is intact.
        expect(captured).toEqual(['hello world']);
        expect(muya.getMarkdown().trim()).toBe('B');
    });

    it('is a no-op when nothing is pending', () => {
        const muya = boot('hello\n');
        let changes = 0;
        muya.eventCenter.on('json-change', () => {
            changes += 1;
        });

        muya.flush();
        muya.flush();

        expect(changes).toBe(0);
        expect(muya.getMarkdown().trim()).toBe('hello');
    });

    it('edits keep flushing normally after a flush', async () => {
        const muya = boot('hello\n');
        const leaf = muya.editor.scrollPage!.firstContentInDescendant() as Content;

        leaf.text = 'one';
        muya.flush();
        expect(muya.getMarkdown().trim()).toBe('one');

        // A subsequent edit still batches + flushes on its own frame.
        const leaf2 = muya.editor.scrollPage!.firstContentInDescendant() as Content;
        leaf2.text = 'two';
        expect(muya.getMarkdown().trim()).toBe('one'); // still deferred
        await nextFrame();
        expect(muya.getMarkdown().trim()).toBe('two');
    });

    it('does not emit json-change when queued operations compose to identity (#4806)', () => {
        const muya = boot('hello\n');
        const jsonState = muya.editor.jsonState;
        const op = json1.insertOp([1], asDoc({ name: 'paragraph', text: 'x' } as never))!;
        const inverse = json1.type.invert(op);
        let changes = 0;

        expect(json1.type.compose(op, inverse)).toBe(null);
        muya.eventCenter.on('json-change', () => {
            changes += 1;
        });

        // @ts-expect-error — drive the private deferred-flush path directly.
        jsonState._operationCache.push(op, inverse);
        // @ts-expect-error — this is the crash stack's private flush method.
        expect(() => jsonState._flushOperationCache()).not.toThrow();

        expect(changes).toBe(0);
        expect(muya.getMarkdown().trim()).toBe('hello');
    });
});
