// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('../loadLanguage', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../loadLanguage')>();
    return {
        ...actual,
        // Keep this test focused on the grammar patch. The actual Vite globbed
        // Prism component loading is covered by integration paths.
        default: () => async () => [],
    };
});

async function loadPatchedPrism() {
    (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
    const mod = await import('../index');
    mod.default.languages.latex = { comment: /%.*/ };
    mod.patchLatexEscapedPercent(mod.default);
    return mod.default;
}

function hasCommentToken(tokens: unknown[]): boolean {
    return tokens.some((token) => {
        if (typeof token !== 'object' || token === null)
            return false;

        const maybeToken = token as { type?: string; content?: unknown };
        if (maybeToken.type === 'comment')
            return true;

        return Array.isArray(maybeToken.content)
            ? hasCommentToken(maybeToken.content)
            : false;
    });
}

describe('latex escaped percent highlighting (#3037)', () => {
    it('does not treat `\\%` as the start of a comment', async () => {
        const prism = await loadPatchedPrism();
        expect(hasCommentToken(prism.tokenize('1\\%+2\\%=3\\%', prism.languages.latex))).toBe(false);
    });

    it('still treats a bare `%` as a comment', async () => {
        const prism = await loadPatchedPrism();
        expect(hasCommentToken(prism.tokenize('100% done', prism.languages.latex))).toBe(true);
    });

    it('still treats a line-leading `%` as a comment', async () => {
        const prism = await loadPatchedPrism();
        expect(hasCommentToken(prism.tokenize('%a real comment', prism.languages.latex))).toBe(true);
    });
});
