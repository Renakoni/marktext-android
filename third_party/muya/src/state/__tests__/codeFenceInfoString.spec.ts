import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

function roundTrip(markdown: string): string {
    const states = new MarkdownToState().generate(markdown);
    return new ExportMarkdown({ listIndentation: 1 }).generate(states);
}

describe('#4770: fenced code block info string round-trip', () => {
    it('preserves a Pandoc/RMarkdown-style attribute info string', () => {
        const markdown = '```{example, listing1-name}\nlabel for code listing 1\n```\n';

        expect(roundTrip(markdown)).toContain('```{example, listing1-name}');
    });

    it('preserves a language followed by attributes', () => {
        const markdown = '```js title="app.js"\nconst a = 1\n```\n';

        expect(roundTrip(markdown)).toContain('```js title="app.js"');
    });

    it('leaves a plain single-word language unchanged', () => {
        const output = roundTrip('```js\nconst a = 1\n```\n');

        expect(output).toContain('```js\n');
    });

    it('leaves a language-less fence unchanged', () => {
        const output = roundTrip('```\nplain\n```\n');

        expect(output).toContain('```\n');
        expect(output).not.toContain('```undefined');
    });

    // The stale-`meta.info` guard test from the interim #4770 port is gone on
    // purpose: since #4856 the model stores the whole info string on
    // `meta.lang` itself, so an edited language can no longer disagree with a
    // separately stored info string.
});
