// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mermaidRun = vi.fn();

vi.mock('../../utils/diagram', () => ({
    default: vi.fn(async (name: string) => {
        if (name === 'mermaid') {
            return {
                initialize: vi.fn(),
                run: mermaidRun,
            };
        }
        throw new Error(`unexpected renderer ${name}`);
    }),
}));

// Import after the mock is registered so MarkdownToHtml uses the fake renderer.
const { MarkdownToHtml } = await import('../markdownToHtml');

beforeEach(() => {
    mermaidRun.mockReset();
});

const INVALID_MERMAID = [
    '# Title',
    '',
    'Intro paragraph.',
    '',
    '```mermaid',
    'graph LR',
    'H[a|b|c]',
    '```',
    '',
    'Trailing paragraph.',
    '',
].join('\n');

describe('#4812: mermaid syntax error must not abort export', () => {
    it('renderHtml resolves even when a mermaid diagram fails to parse', async () => {
        mermaidRun.mockRejectedValue(new Error('Parse error'));

        const html = await new MarkdownToHtml(INVALID_MERMAID).renderHtml();

        expect(html).toContain('Title');
        expect(html).toContain('Intro paragraph.');
        expect(html).toContain('Trailing paragraph.');
        expect(html).toContain('&lt; Invalid Diagram &gt;');
    });

    it('one broken diagram does not stop a later valid diagram from rendering', async () => {
        mermaidRun
            .mockRejectedValueOnce(new Error('Parse error'))
            .mockResolvedValueOnce(undefined);

        const markdown = [
            '```mermaid',
            'graph LR',
            'H[a|b|c]',
            '```',
            '',
            '```mermaid',
            'graph TD; A-->B',
            '```',
            '',
        ].join('\n');

        const html = await new MarkdownToHtml(markdown).renderHtml();

        expect(mermaidRun).toHaveBeenCalledTimes(2);
        expect(html).toContain('&lt; Invalid Diagram &gt;');
    });

    it('does not load mermaid when the document contains no mermaid diagrams', async () => {
        const html = await new MarkdownToHtml('plain paragraph').renderHtml();

        expect(html).toContain('plain paragraph');
        expect(mermaidRun).not.toHaveBeenCalled();
    });
});
