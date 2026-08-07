// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../config';
import hardLineBreak from '../inlineRenderer/renderer/hardLineBreak';
import softLineBreak from '../inlineRenderer/renderer/softLineBreak';
import { Muya } from '../muya';
import { getHighlightHtml } from '../utils/highlightHTML';

// The #142 preference is implemented entirely as CSS scoped under the root
// `.mu-soft-break-as-space` class, so the regression surface is the CSS/DOM
// contract: the rules must hit soft-break spans (mid-paragraph and trailing)
// and must NOT hit the other emitters of `.mu-line-end` — trailing hard
// breaks (the hardLineBreak renderer) and trailing code-block newlines
// (getHighlightHtml). An earlier draft's broad
// `.mu-soft-break-as-space .mu-line-end` rule matched all three.

const SPACE_RULE
    = `.${CLASS_NAMES.MU_SOFT_BREAK_AS_SPACE} .${CLASS_NAMES.MU_SOFT_LINE_BREAK}`;
const LINE_END_RULE
    = `.${CLASS_NAMES.MU_SOFT_BREAK_AS_SPACE} .${CLASS_NAMES.MU_SOFT_LINE_BREAK}.${CLASS_NAMES.MU_LINE_END}`;

// happy-dom's `Element.matches` mis-evaluates descendant combinators against
// the real (deeply nested) editor tree, so "would this descendant rule apply"
// is asserted as its equivalent decomposition: the element itself matches the
// rule's final compound, and some proper ancestor matches the scope part.
function ruleHits(el: Element, rule: string): boolean {
    const lastSpace = rule.lastIndexOf(' ');
    const scope = rule.slice(0, lastSpace);
    const compound = rule.slice(lastSpace + 1);
    if (!el.matches(compound))
        return false;
    const scopeHit = el.parentElement?.closest(scope) ?? null;
    return scopeHit !== null;
}

// Captures the selector strings the inline renderers actually emit, so the
// elements under test carry exactly the classes production DOM would.
type EmitH = (selector: string, children?: unknown) => string;
const emitH: EmitH = selector => selector;

function emittedSelectors(renderer: unknown, token: Record<string, unknown>): string[] {
    const fn = renderer as (args: { h: EmitH; token: unknown }) => string[];
    return fn.call(undefined, { h: emitH, token });
}

function elementFrom(selector: string): HTMLElement {
    const [tag, ...classes] = selector.split('.');
    const el = document.createElement(tag);
    for (const cls of classes)
        el.classList.add(cls);
    return el;
}

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string, options: Record<string, unknown> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function raf(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('soft-break-as-space CSS/DOM contract (#142)', () => {
    it('scopes both stylesheet rules to the soft-break span', () => {
        const css = readFileSync(
            resolve(process.cwd(), 'src/assets/styles/inlineSyntax.css'),
            'utf8',
        );
        expect(css).toContain(`${SPACE_RULE} {`);
        expect(css).toContain(`${LINE_END_RULE} {`);
        // The broad variant (any `.mu-line-end` under the root class) must
        // not come back: it also restyles hard-break and code-block nodes.
        expect(css).not.toMatch(
            new RegExp(`\\.${CLASS_NAMES.MU_SOFT_BREAK_AS_SPACE}\\s+\\.${CLASS_NAMES.MU_LINE_END}`),
        );
    });

    it('hits soft-break emissions and only those, per renderer emission', () => {
        const host = document.createElement('div');
        host.classList.add(CLASS_NAMES.MU_SOFT_BREAK_AS_SPACE);
        document.body.appendChild(host);
        bootedHosts.push(host);

        const attach = (selector: string) => {
            const el = elementFrom(selector);
            host.appendChild(el);
            return el;
        };

        // Trailing soft break: one span carrying both classes — both rules hit.
        const [softAtEnd] = emittedSelectors(softLineBreak, { lineBreak: '\n', isAtEnd: true });
        expect(softAtEnd).toBe(`span.${CLASS_NAMES.MU_SOFT_LINE_BREAK}.${CLASS_NAMES.MU_LINE_END}`);
        const softAtEndEl = attach(softAtEnd);
        expect(ruleHits(softAtEndEl, SPACE_RULE)).toBe(true);
        expect(ruleHits(softAtEndEl, LINE_END_RULE)).toBe(true);

        // Mid-paragraph soft break: white-space rule only.
        const [softMid] = emittedSelectors(softLineBreak, { lineBreak: '\n', isAtEnd: false });
        const softMidEl = attach(softMid);
        expect(ruleHits(softMidEl, SPACE_RULE)).toBe(true);
        expect(ruleHits(softMidEl, LINE_END_RULE)).toBe(false);

        // Trailing hard break: its separate `.mu-line-end` span must match
        // neither rule — the preference is about soft breaks only.
        const hardEmissions = emittedSelectors(hardLineBreak, {
            spaces: '  ',
            lineBreak: '\n',
            isAtEnd: true,
        });
        expect(hardEmissions[1]).toBe(`span.${CLASS_NAMES.MU_LINE_END}`);
        const hardLineEndEl = attach(hardEmissions[1]);
        expect(ruleHits(hardLineEndEl, SPACE_RULE)).toBe(false);
        expect(ruleHits(hardLineEndEl, LINE_END_RULE)).toBe(false);
    });

    it('does not restyle the trailing code-block newline span', () => {
        const host = document.createElement('div');
        host.classList.add(CLASS_NAMES.MU_SOFT_BREAK_AS_SPACE);
        document.body.appendChild(host);
        bootedHosts.push(host);

        const container = document.createElement('span');
        container.innerHTML = getHighlightHtml('const a = 1\n', [], false, true);
        host.appendChild(container);

        const codeLineEnd = container.querySelector<HTMLElement>(`.${CLASS_NAMES.MU_LINE_END}`);
        expect(codeLineEnd).not.toBeNull();
        expect(ruleHits(codeLineEnd!, SPACE_RULE)).toBe(false);
        expect(ruleHits(codeLineEnd!, LINE_END_RULE)).toBe(false);
    });

    it('setOptions toggles the root class live on the same soft-break node', async () => {
        const muya = bootMuya('alpha\nbeta\n');
        await raf();
        const soft = muya.domNode.querySelector<HTMLElement>(`.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`);
        expect(soft).not.toBeNull();
        expect(ruleHits(soft!, SPACE_RULE)).toBe(false);

        muya.setOptions({ renderSoftBreakAsSpace: true });
        expect(muya.domNode.classList.contains(CLASS_NAMES.MU_SOFT_BREAK_AS_SPACE)).toBe(true);
        // The SAME node is now hit by the scoped rule — a pure class flip, no
        // re-render: the document model and serialized markdown are untouched.
        expect(soft!.isConnected).toBe(true);
        expect(ruleHits(soft!, SPACE_RULE)).toBe(true);
        expect(muya.getMarkdown()).toBe('alpha\nbeta\n');

        muya.setOptions({ renderSoftBreakAsSpace: false });
        expect(muya.domNode.classList.contains(CLASS_NAMES.MU_SOFT_BREAK_AS_SPACE)).toBe(false);
        expect(ruleHits(soft!, SPACE_RULE)).toBe(false);
    });

    it('applies the root class at construction time', async () => {
        const muya = bootMuya('alpha\nbeta\n', { renderSoftBreakAsSpace: true });
        await raf();
        expect(muya.domNode.classList.contains(CLASS_NAMES.MU_SOFT_BREAK_AS_SPACE)).toBe(true);
        const soft = muya.domNode.querySelector<HTMLElement>(`.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`);
        expect(soft).not.toBeNull();
        expect(ruleHits(soft!, SPACE_RULE)).toBe(true);
    });

    it('leaves a real document hard break out of the soft-break styling', async () => {
        const muya = bootMuya('alpha  \nbeta\n', { renderSoftBreakAsSpace: true });
        await raf();
        const hard = muya.domNode.querySelector<HTMLElement>(`.${CLASS_NAMES.MU_HARD_LINE_BREAK}`);
        expect(hard).not.toBeNull();
        // A hard break renders no soft-break span, so nothing in this
        // document is hit by the preference's rules.
        expect(
            muya.domNode.querySelectorAll(`.${CLASS_NAMES.MU_SOFT_LINE_BREAK}`).length,
        ).toBe(0);
        expect(ruleHits(hard!, SPACE_RULE)).toBe(false);
    });
});
