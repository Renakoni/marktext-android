// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { isValidAttribute } from '../../utils/dompurify';
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
// only it knows — "this newline is markdown text, not raw HTML" — as a
// sentinel inside TEXT tokens, with no tag tracking at all. The marking
// direction is the security and correctness contract: text-token content
// is escaped text by construction, so the sentinel can never sit in tag
// syntax, an attribute value, or comment data — raw HTML reaches
// DOMPurify and the parser byte-identical to a sentinel-free render, and
// the DOM pass resolves every sentinel to either <br> or `\n` (a total
// function; nothing can leak into the output).
//
// The parked suite's ground truths all hold: raw-token newlines
// (comment-adjacent ones included — marked folds them into the html
// token) are simply never touched, so the output matches the token-level
// design case for case, minus the state machine.

// happy-dom quirk: DOMPurify under happy-dom strips the FIRST element's
// wrapper tags (verified directly: `<p>a</p>` -> `a`; real Chromium does
// not do this). Every fixture leads with a sacrificial pad block so the
// content under test never sits first. Test-environment workaround only.
const PAD = '# pad\n\n';

// The sentinel is random per render, but its prefix is stable. Every
// sentinel must resolve inside the DOM pass, so the prefix showing up in
// ANY output is an implementation leak — assert on every export.
const SENTINEL_PREFIX = 'mu-soft-br-';

async function exportHtml(markdown: string) {
    const html = await new MarkdownToHtml(PAD + markdown).renderHtml();
    expect(html).not.toContain(SENTINEL_PREFIX);
    return html;
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
        // the same element — the soft-break sentinel marking only markdown
        // text is what keeps this distinction alive across the parse: raw
        // newlines are never marked, so the pass never visits them.
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
        // of an inline <pre> over as ordinary TEXT tokens, so these newlines
        // DO get sentinel-marked — and post-parse the DOM knows exactly
        // where the pre is, so the pass restores them to `\n` instead of
        // converting.
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

    it('keeps raw attribute newlines verbatim', async () => {
        // Raw HTML is never sentinelized, so the attribute value reaches
        // DOMPurify and the serializer with its real newline — full
        // fidelity, and DOMPurify judges the true value (see the
        // javascript: smuggling tests below).
        const html = await exportHtml('<div title="a\nb">x</div>\n');
        expect(html).toContain('title="a\nb"');
    });

    it('keeps multiline start tags intact (newline between attributes)', async () => {
        // A sentinel in tag-syntax whitespace would glue itself onto the
        // next attribute name and destroy it; unmarked raw HTML parses
        // exactly as authored.
        const html = await exportHtml('<div id="kept-id"\nclass="kept-class">x</div>\n');
        expect(html).toContain('id="kept-id"');
        expect(html).toContain('class="kept-class"');
    });

    it('keeps multiline start tags intact (newline after the tag name)', async () => {
        const html = await exportHtml('<div\nclass="kept-class">x</div>\n');
        expect(html).toContain('<div class="kept-class">x</div>');
    });

    it('keeps newlines inside raw comment data verbatim', async () => {
        // Comments parse into Comment nodes, which SHOW_TEXT walkers never
        // visit — safe here because raw comment data is never marked in
        // the first place.
        const html = await exportHtml('before <!-- left\nright --> after\n');
        expect(html).toContain('<!-- left\nright -->');
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
        // itself; unmarked raw newlines pass through the DOM stage
        // verbatim — byte-identical to the parked token-level ground
        // truth.
        const html = await exportHtml('- left\n  <!-- c -->\n  right\n');
        expect(html).toContain('left<!-- c -->\nright');
        expect(html).not.toContain('<br>');
    });
});

describe('the sentinel cannot weaken sanitization or leak', () => {
    // The security contract of the flipped marking direction: this
    // feature never rewrites raw HTML, so DOMPurify judges the authored
    // bytes and its verdict is final — no pass of ours runs after it
    // that could turn an inert value into a dangerous one. (Both prior
    // designs failed exactly there: the sentinel made
    // `href="\njavascript:alert(1)"` look like an inert relative URL at
    // check time, and the restore — even a space downgrade, since URL
    // parsing strips LEADING spaces — re-armed the scheme afterwards.)
    //
    // happy-dom cannot assert the browser-side removal: its DOMPurify
    // attribute pass is inert (probe: even a literal javascript: href
    // survives sanitize() here, while real Chromium strips it). What IS
    // assertable in this environment, and is the property this feature
    // owns, is byte fidelity: the authored whitespace reaches the
    // output unlaundered, so DOMPurify's policy — proven below via its
    // string-level isValidAttribute, which does work here — is applied
    // to exactly what the author wrote.
    it('never launders a LEADING attribute newline into a space', async () => {
        const html = await exportHtml('<a href="\njavascript:alert(1)">x</a>\n');
        expect(html).toContain('href="\njavascript:alert(1)"');
        expect(html).not.toContain('href=" javascript:');
    });

    it('never launders an interior attribute newline', async () => {
        const html = await exportHtml('<a href="java\nscript:alert(1)">x</a>\n');
        expect(html).toContain('href="java\nscript:alert(1)"');
        expect(html).not.toContain('href="java script:');
        expect(html).not.toContain('javascript:');
    });

    it('DOMPurify itself rejects the whitespace-split URIs we hand through', () => {
        // The browser-side half of the contract, testable here because
        // isValidAttribute is a pure string check (no DOM involved).
        for (const value of [
            '\njavascript:alert(1)',
            ' javascript:alert(1)',
            'java\nscript:alert(1)',
            'jav\tascript:alert(1)',
            'javascript:alert(1)\n',
        ]) {
            expect(isValidAttribute('a', 'href', value)).toBe(false);
        }
    });

    it('leaves authored text that looks like a sentinel untouched', async () => {
        // The sentinel is freshly random per render, so authored content
        // — including a verbatim copy of some earlier render's token —
        // cannot collide with it and get rewritten into a break.
        const literal = 'mu-soft-br-00112233445566778899aabbccddeeff';
        const html = await new MarkdownToHtml(
            `${PAD}before ${literal} after\n`,
        ).renderHtml();
        expect(html).toContain(literal);
    });
});

describe('conversion cost stays linear', () => {
    it('converts a very long single paragraph without quadratic blowup', async () => {
        // Per-boundary prefix/suffix array copies made this quadratic
        // (~3s at 16k lines); the precomputed emptiness frontiers keep it
        // linear. The vitest timeout is the regression tripwire.
        const lines = Array.from({ length: 8000 }, (_, i) => `line ${i}`);
        const html = await exportHtml(`${lines.join('\n')}\n`);
        expect(html).toContain('line 0<br>line 1<br>');
        expect(html).toContain('line 7998<br>line 7999');
    });
});
