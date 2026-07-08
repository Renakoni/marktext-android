// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    return muya;
}

describe('code fence info string through the live block', () => {
    it('does not crash on a language plus attributes info string', () => {
        expect(() => boot('```js title="app.js"\nconst a = 1\n```\n')).not.toThrow();
    });

    it('does not crash on a Pandoc attribute info string', () => {
        expect(() => boot('```{example, listing1-name}\nx\n```\n')).not.toThrow();
    });

    it('never builds a language class token containing a space', () => {
        const muya = boot('```js title="app.js"\nconst a = 1\n```\n');
        expect(muya.domNode!.innerHTML).not.toContain('language-js title');
    });

    it('round-trips the full info string through the live block', () => {
        const muya = boot('```js title="app.js"\nconst a = 1\n```\n');
        expect(muya.getMarkdown()).toContain('```js title="app.js"');
    });
});
