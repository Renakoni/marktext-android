// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Composition audit for the MOBILE source-code-mode hand-off (#180). The
// individual APIs — getCursorOffset / replaceContent / setCursorByOffset —
// each have their own suites; these cases pin the exact SEQUENCE the Android
// shell runs, because the mode's correctness lives in the composition:
//
//   enter:  getMarkdown() snapshot + getSelection() + getCursorOffset()
//   edit:   plain-text mutation outside muya
//   exit:   replaceContent(text, entrySelection) + setCursorByOffset(caret)
//   undo:   ONE step back to the pre-session document and entry caret
//
// Nothing here is trusted from the doc comments — every invariant the app
// relies on is asserted against the engine.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
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

function placeCursor(muya: Muya, blockPick: 'first' | 'last', start: number, end: number): Content {
    const block = blockPick === 'first'
        ? muya.editor.scrollPage!.firstContentInDescendant()!
        : muya.editor.scrollPage!.lastContentInDescendant()!;
    muya.editor.activeContentBlock = block;
    block.setCursor(start, end, true);
    return block;
}

describe('source-mode hand-off composition (#180)', () => {
    it('round-trips enter -> edit -> exit with one undo step back to the entry state', async () => {
        const muya = bootMuya('alpha\n\nbravo\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('alpha\n\nbravo'));

        // ENTER: caret inside "bravo" (offset 3), capture everything the app captures.
        placeCursor(muya, 'last', 3, 3);
        const entryMarkdown = muya.getMarkdown();
        const entrySelection = muya.getSelection();
        const entryOffset = muya.getCursorOffset();
        expect(entrySelection).not.toBeNull();
        expect(entryOffset?.focus).toEqual({ line: 2, ch: 3 });

        // EDIT outside muya: prepend a heading, extend bravo.
        const edited = '# Title\n\nalpha\n\nbravo lives on\n';

        // EXIT: replace as one boundary with the ENTRY selection recorded, then
        // place the WYSIWYG caret where the textarea caret ended (inside
        // "lives", line 4 ch 8).
        expect(muya.replaceContent(edited, entrySelection)).toBe(true);
        expect(muya.setCursorByOffset({ anchor: { line: 4, ch: 8 }, focus: { line: 4, ch: 8 } })).toBe(true);

        expect(muya.getMarkdown().trim()).toBe(edited.trim());
        // The restored caret sits in the edited last paragraph.
        expect(muya.getCursorOffset()?.focus).toEqual({ line: 4, ch: 8 });

        // ONE undo reverts the whole session and restores the ENTRY caret.
        muya.undo();
        expect(muya.getMarkdown()).toBe(entryMarkdown);
        expect(muya.getSelection()?.anchor.path).toEqual(entrySelection?.anchor.path);

        // Redo replays the whole session as one step too.
        muya.redo();
        expect(muya.getMarkdown().trim()).toBe(edited.trim());
    });

    it('setCursorByOffset after replaceContent keeps the replacement boundary undoable', async () => {
        // setCursorByOffset internally rebuilds the document twice and
        // snapshots/restores history around it — the boundary pushed by the
        // immediately preceding replaceContent must survive that restore.
        const muya = bootMuya('one\n\ntwo\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('one\n\ntwo'));

        placeCursor(muya, 'first', 1, 1);
        const entrySelection = muya.getSelection();
        const before = muya.getMarkdown();

        muya.replaceContent('changed everything\n', entrySelection);
        muya.setCursorByOffset({ anchor: { line: 0, ch: 5 }, focus: { line: 0, ch: 5 } });

        muya.undo();
        expect(muya.getMarkdown()).toBe(before);
    });

    it('an emptied textarea exits into the single-empty-paragraph document', async () => {
        const muya = bootMuya('content\n\nmore\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('content\n\nmore'));

        placeCursor(muya, 'first', 0, 0);
        const entrySelection = muya.getSelection();
        const before = muya.getMarkdown();

        expect(muya.replaceContent('', entrySelection)).toBe(true);
        expect(muya.getMarkdown().trim()).toBe('');
        // The scroll page keeps its one-empty-paragraph invariant.
        expect(muya.editor.scrollPage!.firstContentInDescendant()).not.toBeNull();

        muya.undo();
        expect(muya.getMarkdown()).toBe(before);
    });

    it('an unchanged exit records no boundary and keeps the caret untouched', async () => {
        const muya = bootMuya('steady\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('steady'));

        placeCursor(muya, 'first', 2, 2);
        const entrySelection = muya.getSelection();

        expect(muya.replaceContent(muya.getMarkdown(), entrySelection)).toBe(false);
        // @ts-expect-error — private stack, assertion only.
        expect(muya.editor.history._stack.undo.length).toBe(0);
        expect(muya.getCursorOffset()?.focus).toEqual({ line: 0, ch: 2 });
    });

    it('reads the caret while the editor is unfocused, but not after the DOM selection is cleared', async () => {
        // AUDIT GROUND TRUTH, not a wish: getSelection()/getCursorOffset()
        // read the LIVE DOM selection only — there is no engine-side cache.
        // Chromium keeps a contenteditable's ranges when focus moves to a
        // button, so the normal menu-tap entry still resolves; but anything
        // that clears the ranges leaves the hand-off with null, and the app
        // MUST capture entry state at toggle time and fall back
        // deterministically (caret at document start, null recordSelection).
        const muya = bootMuya('word\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('word'));

        placeCursor(muya, 'first', 4, 4);
        expect(muya.getCursorOffset()?.focus).toEqual({ line: 0, ch: 4 });

        document.getSelection()?.removeAllRanges();
        expect(muya.getCursorOffset()).toBeNull();
        expect(muya.getSelection()).toBeNull();
    });

    it('maps the exit caret through the RAW source text, not the canonical serialization', async () => {
        // Review repro (#182 round 1): the textarea caret's {line, ch} is
        // expressed against the RAW text the user typed, but the document
        // after replaceContent is the CANONICAL serialization — table
        // columns padded, so the same {line, ch} points at a different
        // character. setCursorByOffset must inject its sentinels into the
        // RAW text (both serializations parse to the same state, so the
        // located block + offset are valid in the canonical tree).
        const raw = 'alpha\n\n| a | b |\n| - | - |\n| c | d |\n';
        const muya = bootMuya('alpha\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('alpha'));

        placeCursor(muya, 'first', 0, 0);
        expect(muya.replaceContent(raw, muya.getSelection())).toBe(true);
        const canonical = muya.getMarkdown();
        // Discriminating premise: canonicalization really changed the text.
        expect(canonical).not.toBe(raw);
        const canonicalLines = canonical.split('\n');

        // Caret right AFTER the 'd' cell text, in RAW coordinates.
        const rawLines = raw.split('\n');
        const cursor = {
            anchor: { line: 4, ch: rawLines[4].indexOf('d') + 1 },
            focus: { line: 4, ch: rawLines[4].indexOf('d') + 1 },
        };

        // Fixed path: raw-text injection lands the caret after 'd' in the
        // canonical document.
        expect(muya.setCursorByOffset(cursor, raw)).toBe(true);
        const mapped = muya.getCursorOffset();
        expect(mapped?.focus).toBeTruthy();
        expect(
            canonicalLines[mapped!.focus!.line].slice(0, mapped!.focus!.ch).endsWith('d'),
        ).toBe(true);

        // Built-in counterfactual: WITHOUT the source text (the old
        // behavior), the same raw coordinates resolve against the padded
        // canonical line and either fail or land away from 'd'. This pins
        // the parameter's discriminating power forever.
        const staleResolved = muya.setCursorByOffset(cursor);
        const stale = staleResolved ? muya.getCursorOffset() : null;
        expect(
            stale?.focus == null
            || !canonicalLines[stale.focus.line].slice(0, stale.focus.ch).endsWith('d'),
        ).toBe(true);
    });

    it('round-trips structure-heavy documents to their CANONICAL serialization', async () => {
        // The engine re-serializes on exit: what comes back is muya's
        // canonical markdown (table columns padded to width, etc.), exactly
        // as if the same content had been typed in WYSIWYG — byte fidelity
        // to the source-mode keystrokes is NOT the contract, semantic
        // fidelity to the canonical form is.
        const structured
            = '# H\n\n| a | b |\n| --- | --- |\n| c | d |\n\n```js\nconst x = 1;\n```\n\n- item\n  - nested\n\n$$\nx^2\n$$\n';
        const reference = bootMuya(structured);
        await vi.waitFor(() => expect(reference.getMarkdown()).toContain('# H'));
        const canonical = reference.getMarkdown();

        const muya = bootMuya('plain\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('plain'));

        placeCursor(muya, 'first', 0, 0);
        const entrySelection = muya.getSelection();
        const before = muya.getMarkdown();

        expect(muya.replaceContent(structured, entrySelection)).toBe(true);
        expect(muya.getMarkdown()).toBe(canonical);

        muya.undo();
        expect(muya.getMarkdown()).toBe(before);
        muya.redo();
        expect(muya.getMarkdown()).toBe(canonical);
    });
});
