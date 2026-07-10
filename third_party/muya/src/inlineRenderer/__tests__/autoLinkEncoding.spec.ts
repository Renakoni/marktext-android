// @vitest-environment happy-dom

import type { Muya as MuyaType } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (language: string) => language,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): MuyaType {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('#3548: autolink hrefs are not double percent-encoded', () => {
    it('keeps an already-encoded `%20` intact instead of turning it into `%2520`', () => {
        const muya = bootMuya('<https://www.google.com/search?q=marktext%20foo%20bar>\n');
        const anchor = muya.domNode.querySelector<HTMLAnchorElement>('a.mu-auto-link')!;
        const href = anchor.getAttribute('href')!;

        expect(href).toContain('%20');
        expect(href).not.toContain('%2520');
    });

    it('does not re-encode reserved characters in a query string', () => {
        const muya = bootMuya('<https://example.com/a?b=c&d=e>\n');
        const anchor = muya.domNode.querySelector<HTMLAnchorElement>('a.mu-auto-link')!;

        expect(anchor.getAttribute('href')).toBe('https://example.com/a?b=c&d=e');
    });
});
