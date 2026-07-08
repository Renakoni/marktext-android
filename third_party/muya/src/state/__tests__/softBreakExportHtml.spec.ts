import { describe, expect, it } from 'vitest';
import { getHighlightHtml } from '../../utils/marked';

const OPTS = { math: false, superSubScript: false, footnote: false, frontMatter: false };

describe('#3676: soft line breaks survive export as conformant newlines', () => {
    it('keeps a paragraph soft break as a newline, never a <br>', () => {
        const html = getHighlightHtml('line one\nline two', OPTS);

        expect(html).toContain('<p>line one\nline two</p>');
        expect(html).not.toMatch(/<br\s*\/?>/);
    });

    it('keeps a soft break inside a tight list item, never a <br>', () => {
        const html = getHighlightHtml('- line A\n  line B', OPTS);

        expect(html).toMatch(/<li>line A\nline B<\/li>/);
        expect(html).not.toMatch(/<br\s*\/?>/);
    });

    it('leaves a real hard break as <br>', () => {
        const html = getHighlightHtml('line one  \nline two', OPTS);

        expect(html).toMatch(/<br\s*\/?>/);
    });
});
