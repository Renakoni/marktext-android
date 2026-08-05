// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';

// ScrollPage.resetToSingleEmptyParagraph — the one supported empty-document
// state is exactly one empty paragraph. The whole-table cut path and the
// mobile table commands restore it through here after removing the last
// block of the document.

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
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

describe('scrollPage.resetToSingleEmptyParagraph', () => {
    it('replaces the whole document with one empty paragraph and seats the caret', () => {
        const muya = bootMuya('# Title\n\nSome text\n\n- item\n');
        const scrollPage = muya.editor.scrollPage!;

        const cursorBlock = scrollPage.resetToSingleEmptyParagraph();

        expect(scrollPage.length()).toBe(1);
        expect(muya.domNode.querySelectorAll('p.mu-paragraph')).toHaveLength(1);
        expect(cursorBlock).not.toBeNull();
        expect(cursorBlock!.text).toBe('');

        // The op dispatch keeps the json state in step.
        muya.editor.jsonState.flush();
        expect(muya.getMarkdown().trim()).toBe('');
    });

    it('recovers an already-empty page to the same invariant', () => {
        const muya = bootMuya('| A | B |\n| --- | --- |\n| one | two |\n');
        const scrollPage = muya.editor.scrollPage!;

        // Simulate what removing the document's only table leaves behind.
        scrollPage.forEach((child) => {
            (child as { remove(): void }).remove();
        });
        expect(scrollPage.length()).toBe(0);

        const cursorBlock = scrollPage.resetToSingleEmptyParagraph();

        expect(scrollPage.length()).toBe(1);
        expect(cursorBlock).not.toBeNull();
    });
});
