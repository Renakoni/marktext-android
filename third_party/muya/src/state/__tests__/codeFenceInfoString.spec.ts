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

    it('uses the edited language when a stored info string is now stale', () => {
        const states = [
            {
                name: 'code-block' as const,
                meta: { type: 'fenced', lang: 'python', info: '{example, listing1-name}' },
                text: 'x',
            },
        ];

        const output = new ExportMarkdown({ listIndentation: 1 }).generate(states);

        expect(output).toContain('```python\n');
        expect(output).not.toContain('example');
    });
});
