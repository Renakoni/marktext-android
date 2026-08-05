import type { ILexOption } from './types';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import Prism from 'prismjs';
import cjkEmStrongExtension from './extensions/cjkEmStrong';
import emojiExtension from './extensions/emoji';
import footnoteExtension from './extensions/footnote';
import mathExtension from './extensions/math';
import superSubScriptExtension from './extensions/superSubscript';
import fm, { frontMatterRender } from './frontMatter';
import { DEFAULT_OPTIONS } from './options';
import walkTokens from './walkTokens';

const DIAGRAM_TYPE = [
    'mermaid',
    'plantuml',
    'vega-lite',
    'flowchart',
    'sequence',
];

function highlight(code: string, lang: string) {
    // Language may be undefined (GH#591)
    if (!lang)
        return code;

    if (DIAGRAM_TYPE.includes(lang))
        return code;

    const grammar = Prism.languages[lang];
    if (!grammar) {
        console.warn(`Unable to find grammar for "${lang}".`);
        return code;
    }
    return Prism.highlight(code, grammar, lang);
}

export interface IHighlightHtmlOptions {
    /**
     * Replace `\n` INSIDE markdown TEXT tokens with this sentinel string
     * (#3676, #4951). The DOM-stage export pass converts authored soft
     * breaks to `<br>` but must leave raw-HTML formatting whitespace
     * alone — and after parsing, the two are indistinguishable in the
     * DOM. The token layer contributes the one bit only it knows ("this
     * newline is markdown text, not raw HTML"), and it marks the SAFE
     * side of that line: text-token content is escaped text by
     * construction, so the sentinel can never land in tag syntax, an
     * attribute, or a comment — raw HTML flows through marked, DOMPurify
     * and the HTML parser byte-identical to a sentinel-free render.
     * (The inverse marking — sentinels INSIDE raw HTML tokens — rewrote
     * markup text and died three ways at once: it corrupted multiline
     * tags, leaked into comment data, and let sanitized-inert URI values
     * re-materialize as dangerous ones after DOMPurify.) Export-only:
     * the editor and the conformance renderer never pass it, so their
     * output stays spec-canonical.
     */
    softBreakSentinel?: string;
}

export function getHighlightHtml(
    src: string,
    options: ILexOption = {},
    { softBreakSentinel }: IHighlightHtmlOptions = {},
) {
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    const { footnote, frontMatter, math, isGitlabCompatibilityEnabled, superSubScript }
        = options;

    // Build a fresh Marked instance per call. `Marked.use({ walkTokens })`
    // chains rather than replaces, so reusing a module-level singleton would
    // cause walkTokens to fire N times after N invocations and corrupt token
    // state (e.g. wiping `lang` on subsequent runs).
    const marked = new Marked(markedHighlight({ highlight }));

    marked.use({
        walkTokens: walkTokens({ math, isGitlabCompatibilityEnabled }),
    });

    // Treat CJK characters as punctuation for emphasis/strong flanking so
    // `中文**"加粗"**中文` bolds (marktext/marktext#4307). Additive override —
    // never regresses spec-conformant Latin emphasis.
    marked.use(cjkEmStrongExtension());

    marked.use(emojiExtension({ isRenderEmoji: true }));

    if (math) {
        marked.use(
            mathExtension({
                throwOnError: false,
                useKatexRender: true,
            }),
        );
    }

    if (softBreakSentinel) {
        // Text tokens inside an image LABEL are the one place a text
        // token does not become a DOM Text node: marked renders the
        // label into the `alt` attribute, which no text-node pass can
        // ever visit — a sentinel there would leak into the export
        // verbatim. Marked walks parents before children, so tagging the
        // image's subtree at the image token keeps its descendants
        // unmarked (and the alt newline keeps marked's own behavior).
        const imageLabelTokens = new WeakSet<object>();
        const tagImageLabel = (token: { tokens?: object[] }) => {
            for (const child of token.tokens ?? []) {
                imageLabelTokens.add(child);
                tagImageLabel(child);
            }
        };

        marked.use({
            // Mark soft breaks where they live: leaf `text` tokens. Raw
            // `html` tokens, code, codespans, and every extension token
            // keep their own types, so nothing but escaped markdown text
            // is ever touched. (The renderer escapes token.text — the
            // sentinel is alphanumeric-plus-hyphen, so escaping preserves
            // it.) This instance is per-call, so the closure over this
            // render's sentinel cannot chain into the next render.
            walkTokens(token) {
                if (token.type === 'image') {
                    tagImageLabel(token);
                    return;
                }
                if (
                    token.type === 'text'
                    && !imageLabelTokens.has(token)
                    && token.text.includes('\n')
                ) {
                    token.text = token.text.replace(/\n/g, softBreakSentinel);
                }
            },
        });
    }

    if (superSubScript)
        marked.use(superSubScriptExtension());

    if (footnote)
        marked.use(footnoteExtension());

    let html = '';

    if (frontMatter) {
        const { token, src: newSrc } = fm(src);
        if (token) {
            html = frontMatterRender(token);
            src = newSrc;
        }
    }

    html += marked.parse(src);

    return html;
}
