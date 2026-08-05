// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { renderToStaticHTML } from '../renderToStaticHTML';
import { MarkdownToHtml } from '../markdownToHtml';

// marktext#3676 — a soft line break (a bare `\n` inside a block) shows as a
// line break in the editor (`.mu-content` is pre-wrap) but collapsed to a
// space on HTML/PDF export.
//
// Second attempt (#160/#4951 post-mortem): the token-level guard — deciding
// "is this newline raw HTML?" from marked's token stream — required
// emulating HTML-parser semantics and died under review. This design moves
// the conversion to the DOM stage `renderHtml` already owns: after
// sanitize + innerHTML, the BROWSER has authoritatively resolved raw-text
// elements, nesting, and mismatched tags, so one `closest()` covers the
// entire protection surface. The token layer contributes the single bit
// only it knows — "this text came from a raw HTML token" — as a newline
// sentinel, with no tag tracking at all.
//
// The parked suite's ground truths all hold: the sentinel carries every
// raw-token newline (comment-adjacent ones included — marked folds them
// into the html token) through the DOM pass verbatim, so the output
// matches the token-level design case for case, minus the state machine.

// happy-dom quirk: DOMPurify under happy-dom strips the FIRST element's
// wrapper tags (verified directly: `<p>a</p>` -> `a`; real Chromium does
// not do this). Every fixture leads with a sacrificial pad block so the
// content under test never sits first. Test-environment workaround only.
const PAD = '# pad\n\n';

async function exportHtml(markdown: string) {
    return new MarkdownToHtml(PAD + markdown).renderHtml();
}

describe('marktext#3676 — authored soft breaks render as <br> on export', () => {
    it('renders a paragraph soft break as <br>', async () => {
        expect(await exportHtml('line one\nline two\n')).toContain(
            '<p>line one<br>line two</p>',
        );
    });

    it('renders a tight-item soft break as <br>', async () => {
        expect(await exportHtml('- line A\n  line B\n')).toContain(
            '<li>line A<br>line B</li>',
        );
    });

    it('renders a soft break between inline-wrapped lines as <br>', async () => {
        expect(await exportHtml('- **left**\n  **right**\n')).toContain(
            '<strong>left</strong><br><strong>right</strong>',
        );
    });

    it('renders a soft break inside an inline span as <br>', async () => {
        expect(await exportHtml('**left\nright**\n')).toContain(
            '<strong>left<br>right</strong>',
        );
    });

    it('renders a blockquote paragraph soft break as <br>', async () => {
        expect(await exportHtml('> line one\n> line two\n')).toContain(
            'line one<br>line two',
        );
    });

    it('keeps a real hard break working (two trailing spaces)', async () => {
        expect(await exportHtml('line one  \nline two\n')).toMatch(
            /line one<br\s*\/?>\s*line two/,
        );
    });

    it('reaches the final document through generate()', async () => {
        const doc = await new MarkdownToHtml(PAD + '- line A\n  line B\n').generate({
            title: 't',
            inlineStyles: false,
        });
        expect(doc).toContain('line A<br>line B');
    });

    it('leaves the conformance renderer untouched', () => {
        const html = renderToStaticHTML('line one\nline two\n');
        expect(html).toContain('line one\nline two');
        expect(html).not.toContain('<br>');
    });
});

describe('everything that is NOT an authored soft break stays untouched', () => {
    it('keeps canonical block separators between paragraphs', async () => {
        const html = await exportHtml('para one\n\npara two\n');
        expect(html).toContain('</p>\n<p>');
        expect(html).not.toContain('<br>');
    });

    it('keeps the newline before a nested list structural', async () => {
        const html = await exportHtml('- a\n  - b\n');
        expect(html).not.toContain('a<br>');
        expect(html).toContain('<ul>');
    });

    it('preserves an authored &nbsp; item next to a nested list', async () => {
        const html = await exportHtml('- &nbsp;\n  - child\n');
        expect(html).not.toContain('<br>');
    });

    it('keeps loose-item paragraph boundaries structural', async () => {
        const html = await exportHtml('- para one\n\n  para two\n');
        expect(html).not.toContain('<br>');
    });

    it('collapses a code-span newline to a space per spec, never <br>', async () => {
        expect(await exportHtml('a `x\ny` b\n')).toContain('<code>x y</code>');
    });

    it('keeps fenced code content verbatim', async () => {
        const html = await exportHtml('```\nline one\nline two\n```\n');
        expect(html).toContain('line one\nline two');
        expect(html).not.toContain('line one<br>');
    });

    it('keeps raw-HTML formatting newlines verbatim (raw <p>)', async () => {
        // At the DOM stage a raw-authored <p> and a markdown paragraph are
        // the same element — the raw-newline sentinel is what keeps this
        // distinction alive across the parse.
        const html = await exportHtml(
            '<p>\n<strong>left</strong>\n<strong>right</strong>\n</p>\n',
        );
        expect(html).toContain(
            '<p>\n<strong>left</strong>\n<strong>right</strong>\n</p>',
        );
        expect(html).not.toContain('<br>');
    });

    it('keeps raw blockquote inline whitespace untouched', async () => {
        const raw
            = '<blockquote><strong>left</strong> <strong>right</strong></blockquote>';
        expect(await exportHtml(`${raw}\n`)).toContain(raw);
    });

    it('keeps inline raw-text element content verbatim (<pre>)', async () => {
        // The war case of the token-level attempt: marked hands the interior
        // of an inline <pre> over as ordinary text tokens. Post-parse, the
        // DOM knows exactly where the pre is.
        const html = await exportHtml('text <pre>a\nb</pre> more\n');
        expect(html).toContain('a\nb');
        expect(html).not.toContain('a<br>b');
    });

    it('keeps inline raw-text element content verbatim (<textarea>)', async () => {
        const html = await exportHtml('text <textarea>a\nb</textarea> more\n');
        expect(html).toContain('a\nb');
        expect(html).not.toContain('a<br>b');
    });

    it('a mismatched closing tag inside a raw-text element cannot corrupt it', async () => {
        // Token-level this took a two-tier state machine; the browser's
        // parser settles it before the pass ever runs.
        const html = await exportHtml(
            'before <textarea>left\n</style>\nright</textarea> after\n',
        );
        expect(html).not.toContain('left<br>');
        expect(html).not.toContain('<br>\nright');
    });

    it('keeps legitimate nesting like <pre><code> protected through the inner close', async () => {
        const html = await exportHtml('<pre><code>a\nb</code>\nc\nd</pre>\n');
        expect(html).not.toContain('<br>');
    });

    it('downgrades raw attribute newlines to spaces', async () => {
        // Attribute sentinels restore as SPACE, not `\n`: URL parsing
        // strips tab/newline/CR but preserves interior spaces, so a
        // dangerous scheme can never reassemble around the restored
        // character (see the href smuggling test below). An attribute
        // newline is collapsible whitespace semantically, so the space
        // is presentation-equivalent.
        const html = await exportHtml('<div title="a\nb">x</div>\n');
        expect(html).toContain('title="a b"');
    });

    it('keeps table cells untouched', async () => {
        const html = await exportHtml('| a | b |\n| - | - |\n| c | d |\n');
        expect(html).not.toContain('<br>');
    });

    it('keeps serializer newlines between nested-list siblings structural', async () => {
        // A multi-child nested list puts `\n` text nodes directly under
        // the inner <ul> (between the <li>s) — direct children of a
        // structural container are serializer whitespace, never breaks.
        const html = await exportHtml('- parent\n  - c1\n  - c2\n');
        expect(html).not.toContain('<br>');
        expect(html).toContain('<li>c1</li>');
        expect(html).toContain('<li>c2</li>');
    });

    it('keeps a table nested in a list item free of <br>', async () => {
        const html = await exportHtml(
            '- item\n\n  | a | b |\n  | - | - |\n  | c | d |\n',
        );
        expect(html).not.toContain('<br>');
        expect(html).toContain('<table>');
    });
});

describe('raw-token newlines survive verbatim', () => {
    it('keeps the newline riding an inline comment token untouched', async () => {
        // marked folds the newline after the comment into the html token
        // itself; the sentinel walks it through the DOM pass verbatim —
        // byte-identical to the parked token-level ground truth.
        const html = await exportHtml('- left\n  <!-- c -->\n  right\n');
        expect(html).toContain('left<!-- c -->\nright');
        expect(html).not.toContain('<br>');
    });
});

describe('the sentinel round-trip cannot be abused', () => {
    it('cannot smuggle a javascript: URI through an attribute newline', async () => {
        // The attack the string-level restore allowed: `java\nscript:`
        // rides through DOMPurify as an inert sentinel-carrying value,
        // then the post-serialization swap turns it back into a newline
        // that URL parsing strips — a working javascript: href. Restoring
        // ON the DOM before serialization, and restoring attributes as
        // SPACE, kills both halves: nothing textual changes after
        // sanitization, and a space never disappears from URL parsing.
        const html = await exportHtml('<a href="java\nscript:alert(1)">x</a>\n');
        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('java\nscript');
        expect(html).not.toContain('java&#10;script');
    });

    it('leaves authored text that looks like a sentinel untouched', async () => {
        // The sentinel is freshly random per render, so authored content
        // — including a verbatim copy of some earlier render's token —
        // cannot collide with it and get rewritten into a newline.
        const literal = 'mu-raw-nl-00112233445566778899aabbccddeeff';
        const html = await exportHtml(`before ${literal} after\n`);
        expect(html).toContain(literal);
    });
});
