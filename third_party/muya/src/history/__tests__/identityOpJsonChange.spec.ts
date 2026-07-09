// @vitest-environment happy-dom

import * as json1 from 'ot-json1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { asDoc } from '../../state';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function undoDepth(muya: Muya): number {
    // @ts-expect-error — reach into the private stack for test assertions.
    return muya.editor.history._stack.undo.length;
}

describe('identity (null) op via json-change — #4806', () => {
    it('updateContents(null) does not crash History and records nothing', () => {
        const muya = bootMuya('hello\n');

        expect(() => muya.editor.updateContents(null, null, 'user')).not.toThrow();

        expect(muya.getMarkdown().trim()).toBe('hello');
        expect(undoDepth(muya)).toBe(0);
    });

    it('flushing a compose-to-null batch is a no-op (locks #4815)', () => {
        const muya = bootMuya('hello\n');
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
        // @ts-expect-error — the function the crash stack named.
        expect(() => jsonState._flushOperationCache()).not.toThrow();

        expect(changes).toBe(0);
        expect(muya.getMarkdown().trim()).toBe('hello');
        expect(undoDepth(muya)).toBe(0);
    });
});
