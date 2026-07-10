// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import prism, { loadLanguage } from '../index';
import { loadedLanguages } from '../loadLanguage';

function resetCppState() {
    for (const lang of ['c', 'cpp']) {
        delete (prism.languages as Record<string, unknown>)[lang];
        loadedLanguages.delete(lang);
    }
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('loadLanguage dependency order', () => {
    it('loads a dependency before the dependent grammar that extends it', async () => {
        resetCppState();

        const addOrder: string[] = [];
        const realAdd = loadedLanguages.add.bind(loadedLanguages);
        vi.spyOn(loadedLanguages, 'add').mockImplementation((lang: string) => {
            addOrder.push(lang);
            return realAdd(lang);
        });

        await expect(loadLanguage('cpp')).resolves.toBeDefined();

        expect(addOrder).toContain('c');
        expect(addOrder).toContain('cpp');
        expect(addOrder.indexOf('c')).toBeLessThan(addOrder.indexOf('cpp'));
        expect(prism.languages.cpp).toBeTruthy();
        expect(() => prism.tokenize('int main(){}', prism.languages.cpp)).not.toThrow();
    });
});
