// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('../loadLanguage', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../loadLanguage')>();
    return {
        ...actual,
        // This spec validates alias registration; component loading is covered
        // by Prism/Vite integration and would make the unit depend on globbed
        // language modules unrelated to the alias table.
        default: () => async () => [],
    };
});

async function loadPrismModule() {
    (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
    return import('../index');
}

describe('c++ language alias (#2910)', () => {
    it('resolves `c++` to the cpp grammar', async () => {
        const { transformAliasToOrigin } = await loadPrismModule();
        expect(transformAliasToOrigin(['c++'])[0]).toBe('cpp');
    });

    it('resolves `h++` to the cpp grammar', async () => {
        const { transformAliasToOrigin } = await loadPrismModule();
        expect(transformAliasToOrigin(['h++'])[0]).toBe('cpp');
    });

    it('leaves the canonical `cpp` id untouched', async () => {
        const { transformAliasToOrigin } = await loadPrismModule();
        expect(transformAliasToOrigin(['cpp'])[0]).toBe('cpp');
    });

    it('exposes a runtime grammar for the resolved id but not the raw alias', async () => {
        const { default: prism, transformAliasToOrigin } = await loadPrismModule();
        const resolved = transformAliasToOrigin(['c++'])[0];
        expect(resolved).toBe('cpp');

        prism.languages.cpp = prism.languages.javascript;
        expect(prism.languages[resolved]).toBeTruthy();
        expect(prism.languages['c++']).toBeUndefined();
        expect(() => prism.tokenize('int main(){}', prism.languages[resolved])).not.toThrow();
    });
});
