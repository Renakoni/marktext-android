import type { Muya } from '../muya';
import githubMarkdownCss from 'github-markdown-css/github-markdown-light.css?inline';
import katexCss from 'katex/dist/katex.css?inline';
import prismCss from 'prismjs/themes/prism.css?inline';
import exportStyle from '../assets/styles/exportStyle.css?inline';
import { EXPORT_DOMPURIFY_CONFIG } from '../config';
import { isHTMLElement, sanitize, unescapeHTML } from '../utils';
import loadRenderer from '../utils/diagram';

import { getHighlightHtml } from '../utils/marked';
import { generateGithubSlug } from '../utils/slug';
import { transformFootnotes } from './transformFootnotes';

// The core stylesheets (github-markdown-css, katex, prism) are inlined into the
// exported document so the output is fully self-contained and renders offline /
// behind CSP / air-gapped — see `generate`. Linking them from a CDN left a
// saved `.html` file unstyled with no network access, a regression for an
// offline desktop editor. Callers that explicitly want the lighter CDN-linked
// shell can opt in via `generate({ inlineStyles: false })`.

// CDN `<link>` tags used when `inlineStyles` is disabled. Kept verbatim from
// the previous default so the opt-out path is byte-identical to the old output.
const CDN_STYLESHEET_LINKS = `  <!-- https://cdnjs.com/libraries/github-markdown-css -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.css" integrity="sha512-n5zPz6LZB0QV1eraRj4OOxRbsV7a12eAGfFcrJ4bBFxxAwwYDp542z5M0w24tKPEhKk2QzjjIpR5hpOjJtGGoA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <!-- https://katex.org/docs/browser -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn" crossorigin="anonymous">
  <!-- https://cdnjs.com/libraries/prism -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/9000.0.1/themes/prism.min.css" integrity="sha512-/mZ1FHPkg6EKcxo0fKXF51ak6Cr2ocgDi5ytaTBjsQZIH/RNs6GF6+oId/vPe3eJB836T36nXwVh/WBl/cWT4w==" crossorigin="anonymous" referrerpolicy="no-referrer" />`;

// Sentinel standing in for `\n` INSIDE markdown text tokens through the
// sanitize + DOM stage (#3676): raw-HTML formatting whitespace and
// authored soft breaks are indistinguishable once parsed, so the token
// layer marks the newlines that are provably markdown text — and ONLY
// those. Raw HTML is never rewritten in any way: DOMPurify judges its
// real attribute values (its URI policy sees `\njavascript:` as
// authored), the HTML parser sees its real tag-syntax whitespace, and
// comments keep their real data. The sentinel reaches DOM Text nodes
// only — partly by construction (escaped text cannot originate markup)
// and partly by sink inventory (image labels, the one text-token path
// that renders into an ATTRIBUTE, are explicitly exempted in the marking
// hook) — and the DOM pass resolves every occurrence to either `<br>` or
// `\n`: a total function, so none can leak into the output. The marker
// is freshly RANDOM per render, so authored content cannot collide with
// it — not even through numeric character references, which no
// input-scan check could enumerate.
function pickSoftBreakSentinel(): string {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes);
    }
    else {
        for (let i = 0; i < bytes.length; i++)
            bytes[i] = Math.floor(Math.random() * 256);
    }

    let token = 'mu-soft-br-';
    for (const byte of bytes)
        token += byte.toString(16).padStart(2, '0');

    return token;
}

// Containers whose text newlines are CONTENT, never soft breaks. The
// browser's parser has already resolved raw-text elements, nesting, and
// mismatched tags by the time the DOM pass runs — this one selector is
// the entire protection the token-level attempt (#4951/#160) needed ten
// review rounds of HTML-parser emulation for. `.katex`/`math`/`svg`
// guard generated math and diagram output.
const SOFT_BREAK_PROTECTED
    = 'pre, code, kbd, script, style, textarea, title, svg, math, table, .katex';

// Containers whose DIRECT text children are always serializer whitespace
// (between <li>s, between table sections/rows/cells): never convert there.
const STRUCTURAL_PARENT_TAG
    = /^(?:UL|OL|MENU|DL|TABLE|THEAD|TBODY|TFOOT|TR|COLGROUP|SELECT|OPTGROUP)$/;

// Block-level / structural elements: a newline touching one of these (or
// a container edge) separates STRUCTURE — marked's own serialization
// shape — and must not become a visible break. Everything else adjacent
// is phrasing content, where a newline is an authored soft break.
const BLOCKISH_TAG
    = /^(?:ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|CAPTION|COL|COLGROUP|DETAILS|DIV|DL|DD|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TBODY|TD|TFOOT|TH|THEAD|TR|UL)$/;

export class MarkdownToHtml {
    private _exportContainer: HTMLDivElement | null = null;

    constructor(public markdown: string, private _muya?: Muya) {}

    /**
     * Render authored soft line breaks as `<br>` (#3676). CommonMark
     * explicitly permits a renderer to emit soft breaks as hard line
     * breaks; the editor already SHOWS them as line breaks
     * (`.mu-content` is pre-wrap), so exports must match. Runs on the
     * sanitized export DOM, driven by the soft-break sentinel: only
     * sentinel-carrying text nodes (markdown text by construction) are
     * ever touched, and every sentinel resolves to either `<br>`
     * (authored soft break in phrasing context) or `\n` (protected
     * containers, structural positions) — newlines that arrived as real
     * `\n` (raw HTML, marked's own block separators) are never visited
     * at all.
     */
    private _renderSoftBreaks(container: HTMLElement, sentinel: string) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const texts: Text[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if ((node as Text).data.includes(sentinel))
                texts.push(node as Text);
        }

        for (const text of texts)
            this._convertSoftBreaks(text, sentinel);
    }

    private _convertSoftBreaks(text: Text, sentinel: string) {
        const parts = text.data.split(sentinel);
        const parent = text.parentElement;

        // Reader opted into CommonMark soft-break spacing (#142): restore the
        // plain newline everywhere instead of emitting <br>. The export
        // paragraph's default `white-space: normal` then collapses it to a
        // space, matching what the editor shows with the same preference on.
        if (this._muya?.options?.renderSoftBreakAsSpace) {
            text.data = parts.join('\n');
            return;
        }

        // Contexts that never convert restore the plain newline: a text
        // token's newline that parsed into a protected or structural
        // position (an inline raw `<pre>` interior, a multiline setext
        // heading) is content, not a soft break.
        if (
            !parent
            || parent.closest(SOFT_BREAK_PROTECTED)
            || STRUCTURAL_PARENT_TAG.test(parent.tagName)
            || !parent.closest('p, li')
        ) {
            text.data = parts.join('\n');
            return;
        }

        // A newline at the node's EDGE next to a block-level sibling (a
        // nested list inside a tight item, a paragraph boundary inside a
        // loose one) — or at the container edge itself — is structural.
        const structuralBefore
            = text.previousSibling == null
                || (isHTMLElement(text.previousSibling)
                    && BLOCKISH_TAG.test(text.previousSibling.tagName));
        const structuralAfter
            = text.nextSibling == null
                || (isHTMLElement(text.nextSibling)
                    && BLOCKISH_TAG.test(text.nextSibling.tagName));

        // Precomputed emptiness frontiers make each boundary check O(1);
        // per-boundary prefix/suffix scans made a long single paragraph
        // quadratic in its line count.
        let firstNonEmpty = parts.length;
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] !== '') {
                firstNonEmpty = i;
                break;
            }
        }
        let lastNonEmpty = -1;
        for (let i = parts.length - 1; i >= 0; i--) {
            if (parts[i] !== '') {
                lastNonEmpty = i;
                break;
            }
        }

        const fragment = document.createDocumentFragment();
        let converted = false;
        for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
                // The boundary between parts[i-1] and parts[i].
                const leadingEmpty = firstNonEmpty >= i;
                const trailingEmpty = lastNonEmpty < i;
                const structural
                    = (leadingEmpty && structuralBefore)
                        || (trailingEmpty && structuralAfter);
                if (structural) {
                    fragment.appendChild(document.createTextNode('\n'));
                }
                else {
                    fragment.appendChild(document.createElement('br'));
                    converted = true;
                }
            }
            if (parts[i])
                fragment.appendChild(document.createTextNode(parts[i]));
        }

        if (converted)
            text.parentNode!.replaceChild(fragment, text);
        else
            text.data = parts.join('\n');
    }

    private async _renderMermaid() {
        const codes = this._exportContainer!.querySelectorAll(
            'code.language-mermaid',
        );
        for (const code of codes) {
            const preEle = code.parentNode;
            if (!isHTMLElement(preEle))
                continue;
            const mermaidContainer = document.createElement('div');
            mermaidContainer.innerHTML = sanitize(
                unescapeHTML(code.innerHTML),
                EXPORT_DOMPURIFY_CONFIG,
                true,
            ) as string;
            mermaidContainer.classList.add('mermaid');
            preEle.replaceWith(mermaidContainer);
        }
        const nodes = [...this._exportContainer!.querySelectorAll('div.mermaid')];
        if (nodes.length === 0)
            return;

        const mermaid = await loadRenderer('mermaid');
        // We only export light theme, so set mermaid theme to `default`, in the future, we can choose which theme to export.
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'default',
        });
        // Render each diagram in isolation: `mermaid.run` rejects the whole
        // batch on the first parse error, so one invalid diagram used to abort
        // the entire export (#4812). Contain the failure to that diagram and
        // fall back to the same placeholder the other diagram renderers use.
        for (const node of nodes) {
            try {
                await mermaid.run({ nodes: [node] });
            }
            catch {
                node.innerHTML = '< Invalid Diagram >';
            }
        }
        if (this._muya) {
            mermaid.initialize({
                securityLevel: 'strict',
                theme: this._muya.options.mermaidTheme,
            });
        }
    }

    private async _renderDiagram() {
        const selector
            = 'code.language-vega-lite, code.language-plantuml, code.language-flowchart, code.language-sequence';
        const codes = this._exportContainer!.querySelectorAll(selector);

        for (const code of codes) {
            const rawCode = unescapeHTML(code.innerHTML);
            const functionType = (() => {
                if (/plantuml/.test(code.className))
                    return 'plantuml';
                else if (/flowchart/.test(code.className))
                    return 'flowchart';
                else if (/sequence/.test(code.className))
                    return 'sequence';
                else
                    return 'vega-lite';
            })();
            const render = await loadRenderer(functionType);
            const preParent = code.parentNode;
            if (!isHTMLElement(preParent))
                continue;
            const diagramContainer = document.createElement('div');
            diagramContainer.classList.add(functionType);
            preParent.replaceWith(diagramContainer);
            const options = {};
            if (functionType === 'vega-lite') {
                Object.assign(options, {
                    actions: false,
                    tooltip: false,
                    renderer: 'svg',
                    theme: 'latimes', // only render light theme
                    // Parse the spec to an AST and evaluate expressions with the
                    // interpreter instead of compiling them via `new Function`,
                    // which the sandboxed renderer's CSP blocks (`unsafe-eval`
                    // is not granted) — without this the embed throws and the
                    // chart renders as `< Invalid Diagram >`.
                    ast: true,
                });
            }
            else if (functionType === 'sequence') {
                Object.assign(options, {
                    theme: this._muya?.options.sequenceTheme ?? 'hand',
                });
            }

            try {
                if (functionType === 'plantuml') {
                    const diagram = render.parse(rawCode, this._muya?.options.plantumlServer);
                    diagramContainer.innerHTML = '';
                    diagram.insertImgElement(diagramContainer);
                }
                else if (functionType === 'flowchart' || functionType === 'sequence') {
                    const diagram = render.parse(rawCode);
                    diagramContainer.innerHTML = '';
                    diagram.drawSVG(diagramContainer, options);
                }
                else if (functionType === 'vega-lite') {
                    await render(diagramContainer, JSON.parse(rawCode), options);
                }
            }
            catch {
                diagramContainer.innerHTML = '< Invalid Diagram >';
            }
        }
    }

    // Assign a github-compatible slug `id` to every `<h1>..<h6>` in the
    // export container. Headings that already carry an explicit id (none today,
    // but defensive) are left as-is and reserve that id. Duplicates are
    // deduplicated by incrementing a `-N` suffix until the *full* candidate id
    // is unused — so a later heading whose text already looks like an earlier
    // `-N` slug (e.g. `heading`, `heading`, `heading-1`) still resolves to a
    // unique anchor, matching github.
    private _injectHeadingIds(container: HTMLElement) {
        const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const seen = new Set<string>();

        // Reserve any pre-existing ids first so generated slugs never collide
        // with them.
        for (const heading of headings) {
            if (heading.id)
                seen.add(heading.id);
        }

        for (const heading of headings) {
            if (heading.id)
                continue;

            const base = generateGithubSlug(heading.textContent ?? '') || 'heading';
            let slug = base;
            let n = 1;
            while (seen.has(slug))
                slug = `${base}-${n++}`;

            seen.add(slug);
            heading.id = slug;
        }
    }

    // render pure html by marked
    async renderHtml() {
        const footnote = this._muya?.options?.footnote ?? false;
        const softBreakSentinel = pickSoftBreakSentinel();
        let html = getHighlightHtml(this.markdown, {
            superSubScript: this._muya?.options?.superSubScript ?? true,
            footnote,
            isGitlabCompatibilityEnabled:
        this._muya?.options?.isGitlabCompatibilityEnabled ?? true,
            math: this._muya?.options?.math ?? true,
        }, { softBreakSentinel });

        // Post-process footnotes into the standard GFM / pandoc shape (inline
        // numbered <sup> refs + bottom <section class="footnotes"> with
        // backrefs). Must run before DOMPurify strips the `data-identifier`
        // marker the marked footnote extension emits.
        if (footnote)
            html = transformFootnotes(html);

        html = sanitize(html, EXPORT_DOMPURIFY_CONFIG, false) as string;

        const exportContainer = (this._exportContainer
            = document.createElement('div'));
        exportContainer.classList.add('mu-render-container');
        exportContainer.innerHTML = html;
        document.body.appendChild(exportContainer);

        // Authored soft breaks -> <br> (#3676), on the parsed DOM where
        // the browser has already resolved everything the token stream
        // cannot express. Runs FIRST so no later pass (mermaid, heading
        // slugs) ever observes a sentinel, and resolves every sentinel
        // in place — nothing textual changes after this point except
        // subtree replacement by the diagram renderers.
        this._renderSoftBreaks(exportContainer, softBreakSentinel);

        // render only render the light theme of mermaid and diagram...
        await this._renderMermaid();
        await this._renderDiagram();

        // Inject github-compatible slug ids onto exported headings so the
        // exported document's [TOC] / `getHtmlToc` `href="#slug"` anchors
        // resolve. Scoped to this export DOM path — the conformance
        // renderer (`renderToStaticHTML`) is deliberately left untouched.
        this._injectHeadingIds(exportContainer);

        let result = exportContainer.innerHTML;
        exportContainer.remove();

        // hack to add arrow marker to output html
        // TODO: JOCS, are these codes still needed?
        const paths = document.querySelectorAll('path[id^=raphael-marker-]');
        const def = '<defs style="-webkit-tap-highlight-color: rgba(0, 0, 0, 0);">';
        result = result.replace(def, () => {
            let str = '';
            for (const path of paths)
                str += path.outerHTML;

            return `${def}${str}`;
        });

        this._exportContainer = null;

        return `<article class="markdown-body">${result}</article>`;
    }

    /**
     * Get HTML with style.
     *
     * @param options Document options.
     * @param options.title Document `<title>`.
     * @param options.extraCSS Extra CSS appended after the base stylesheets.
     * @param options.inlineStyles Inline the core stylesheets so the output is
     * self-contained and renders offline (default `true`); pass `false` to fall
     * back to CDN `<link>` tags.
     * @param options.dir Text direction set on the root `<html>` (`rtl` / `auto`);
     * `ltr` is the HTML default and stays implicit.
     */
    async generate(
        options: {
            title?: string;
            extraCSS?: string;
            inlineStyles?: boolean;
            dir?: string;
        } = {},
    ) {
        const html = await this.renderHtml();

        // `extraCSS` may changed in the mean time.
        const { title = '', extraCSS = '', inlineStyles = true, dir } = options;

        // Mirror the editor's text direction onto the exported document so RTL
        // documents export right-to-left (#4553). LTR is the HTML default, so it
        // stays implicit to keep existing exports byte-identical.
        const dirAttr = dir === 'rtl' || dir === 'auto' ? ` dir="${dir}"` : '';

        let baseStyles: string;
        if (inlineStyles) {
            // Embed the KaTeX fonts as data URIs so math renders offline. The
            // font data (~300KB base64) is dynamically imported here so it only
            // loads on export, never in the editor bundle.
            const { embedKatexFonts } = await import('../utils/embedKatexFonts');
            baseStyles = [githubMarkdownCss, embedKatexFonts(katexCss), prismCss]
                .map(css => `  <style>${css}</style>`)
                .join('\n');
        }
        else {
            baseStyles = CDN_STYLESHEET_LINKS;
        }

        return `<!DOCTYPE html>
<html lang="en"${dirAttr}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${sanitize(title, EXPORT_DOMPURIFY_CONFIG, true)}</title>
${baseStyles}
  <style>${exportStyle}</style>
  <style>${extraCSS}</style>
</head>
<body>
  ${html}
</body>
</html>`;
    }
}
