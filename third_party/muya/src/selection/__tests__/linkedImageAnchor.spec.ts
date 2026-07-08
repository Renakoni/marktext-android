// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

const bootedMuyas: Muya[] = [];

beforeEach(() => {
    (window as unknown as { MUYA_VERSION?: string }).MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    delete (window as unknown as { MUYA_VERSION?: string }).MUYA_VERSION;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

// #4865: the image hover controls used to render as nested `<a>` elements.
// Inside a real anchor (reference link or raw HTML) the illegal `<a>`-in-`<a>`
// nesting made the HTML parser close the outer anchor early, structurally
// hoisting the image out of its link. These specs pin the fixed DOM shape;
// the desktop-only modifier-click routing that upstream also touched is not
// ported (no Android consumer).
describe('linked image stays inside its anchor (#4865)', () => {
    it('keeps a raw-HTML linked image inside a.mu-raw-html', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`<a href="https://link.example.com"><img src="${src}"></a>`);

        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        expect(wrapper).not.toBeNull();
        expect(wrapper.closest(`a.${CLASS_NAMES.MU_RAW_HTML}`)).not.toBeNull();
        expect(wrapper.querySelector(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`)).not.toBeNull();
    });

    it('keeps a reference-linked image inside a.mu-reference-link', () => {
        const src = 'https://example.com/badge.svg';
        const muya = boot(`[![alt](${src})][ref]\n\n[ref]: https://link.example.com`);

        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        expect(wrapper).not.toBeNull();
        expect(wrapper.closest(`a.${CLASS_NAMES.MU_REFERENCE_LINK}`)).not.toBeNull();
    });

    it('renders no anchor-tagged hover controls inside the image wrapper', () => {
        const muya = boot('![alt](https://example.com/pic.png)');

        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        expect(wrapper).not.toBeNull();
        // The loading/fail/close controls are spans now — an `<a>` here is what
        // used to break outer anchors.
        expect(wrapper.querySelector('a.mu-image-icon-success')).toBeNull();
        expect(wrapper.querySelector('a.mu-image-icon-fail')).toBeNull();
        expect(wrapper.querySelector('a.mu-image-icon-close')).toBeNull();
        expect(wrapper.querySelector('span.mu-image-icon-success')).not.toBeNull();
    });
});
