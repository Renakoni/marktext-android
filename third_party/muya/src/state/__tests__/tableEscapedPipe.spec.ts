// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (language: string) => language,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    return muya;
}

function codeTexts(muya: Muya): string[] {
    return [...muya.domNode!.querySelectorAll('td code')].map(code => code.textContent ?? '');
}

function roundTrip(markdown: string): string {
    const states = new MarkdownToState().generate(markdown);
    return new ExportMarkdown({ listIndentation: 1 }).generate(states);
}

const TABLE = [
    '| a | b |',
    '| --- | --- |',
    '| `\\|` | x |',
    '| `\\|\\|` | y |',
    '',
].join('\n');

describe('#4849: escaped pipe in a table cell', () => {
    it('renders `\\|` inside code as | without the backslash in the editor', () => {
        const muya = boot(TABLE);

        expect(codeTexts(muya)).toEqual(['|', '||']);
    });

    it('keeps the table structure', () => {
        const muya = boot(TABLE);
        const rows = muya.domNode!.querySelectorAll('tr');

        expect(rows.length).toBe(3);
        expect(rows[2].querySelectorAll('td').length).toBe(2);
    });

    it('round-trips the escaped pipes back to `\\|` / `\\|\\|`', () => {
        const markdown = roundTrip(TABLE);

        expect(markdown).toContain('`\\|`');
        expect(markdown).toContain('`\\|\\|`');
    });

    it('round-trips an escaped pipe in plain cell text', () => {
        const markdown = roundTrip('| a | b |\n| --- | --- |\n| x \\| y | z |\n');

        expect(markdown).toContain('x \\| y');
    });
});
