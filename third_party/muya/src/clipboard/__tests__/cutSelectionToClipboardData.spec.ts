// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

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
    const muya = new MuyaClass(host, { markdown } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function firstContent(muya: Muya): Content {
    return muya.editor.scrollPage!.firstContentInDescendant()!;
}

function stubSameBlockSelection(muya: Muya, block: Content, start: number, end: number) {
    const path = block.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: start, block, path },
        focus: { offset: end, block, path },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: SelectionDirection.FORWARD,
        type: start === end ? SelectionCaretType.CARET : SelectionCaretType.RANGE,
    });
}

describe('clipboard.cutSelectionToClipboardData', () => {
    it('returns the selected text and deletes it synchronously', () => {
        const muya = bootMuya('alpha beta\n');
        const block = firstContent(muya);
        stubSameBlockSelection(muya, block, 0, 5);

        const payload = muya.editor.clipboard.cutSelectionToClipboardData();

        expect(payload.text).toBe('alpha');
        expect(muya.getMarkdown()).toBe(' beta\n');
    });

    it('does not delete when there is no clipboard payload', () => {
        const muya = bootMuya('alpha beta\n');
        const block = firstContent(muya);
        stubSameBlockSelection(muya, block, 3, 3);

        const payload = muya.editor.clipboard.cutSelectionToClipboardData();

        expect(payload.text).toBe('');
        expect(muya.getMarkdown()).toBe('alpha beta\n');
    });
});
