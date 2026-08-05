// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';
import type Table from '../index';

// Table.outsideContentInContext — the caret target OUTSIDE the table when a
// removal consumes the whole table. The plain `nextContentInContext` on the
// table itself starts at the table's PARENT's siblings (the traversal is
// designed for content blocks), so it never sees the table's own
// neighbours; the boundary-descendant resolution must.

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function findTable(muya: Muya): Table {
    let table: Table | null = null;
    muya.editor.scrollPage!.depthFirstTraverse((block) => {
        if (block.blockName === 'table' && table == null)
            table = block as unknown as Table;
    });
    expect(table).not.toBeNull();
    return table!;
}

const SURROUNDED = `before

| A | B |
| --- | --- |
| one | two |

after
`;

describe('table.outsideContentInContext()', () => {
    it('prefers the content right after a top-level table', () => {
        const table = findTable(bootMuya(SURROUNDED));

        expect(table.outsideContentInContext()?.text).toBe('after');
    });

    it('falls back to the content right before when nothing follows', () => {
        const table = findTable(bootMuya('before\n\n| A | B |\n| --- | --- |\n| one | two |\n'));

        expect(table.outsideContentInContext()?.text).toBe('before');
    });

    it('seats the caret on the following prose when the last row removal kills the table', () => {
        const muya = bootMuya(SURROUNDED);
        const table = findTable(muya);

        const survivor = table.removeRow(1);
        expect(survivor?.text).toBe('A');

        const outside = table.removeRow(0);
        expect(outside?.text).toBe('after');
        muya.editor.jsonState.flush();
        expect(muya.getMarkdown()).not.toContain('| A | B |');
    });

    it('reports contentless when the table was a list item\'s only child', async () => {
        // Reachable shape: the pipe conversion REPLACES a list item's
        // paragraph with the table (listMathEnterConvert pins that as
        // intentional); createTable from an empty item paragraph takes the
        // same replace-in-place path.
        const muya = bootMuya('- placeholder\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.editor.activeContentBlock = first;
        first.setCursor(0, 0, true);
        first.text = '';
        muya.createTable({ rows: 2, columns: 2 });
        await vi.waitFor(() => {
            expect(findTable(muya)).toBeTruthy();
        });

        const table = findTable(muya);
        // Sole content: the page's first content descendant IS a table cell.
        expect(muya.editor.scrollPage!.firstContentInDescendant()?.blockName).toBe(
            'table.cell.content',
        );
        expect(table.outsideContentInContext()).toBeNull();

        // Killing the table leaves only empty container skeletons: still a
        // top-level child, but NO content descendant — the exact predicate
        // the app-side empty-document recovery keys on.
        table.removeRow(1);
        const outside = table.removeRow(0);
        expect(outside).toBeNull();
        const scrollPage = muya.editor.scrollPage!;
        expect(scrollPage.length()).toBeGreaterThan(0);
        expect(scrollPage.firstContentInDescendant()).toBeNull();

        // The invariant restore handles the skeleton shape too.
        const cursorBlock = scrollPage.resetToSingleEmptyParagraph();
        expect(cursorBlock).not.toBeNull();
        expect(scrollPage.length()).toBe(1);
        expect(scrollPage.firstContentInDescendant()?.blockName).toBe('paragraph.content');
    });

    it('resolves the sibling paragraph inside a list item for a nested table', async () => {
        // Same construction as the nested-table cursor spec: createTable from
        // a caret inside a list item nests the table after the item's
        // paragraph.
        const muya = bootMuya('- item text\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.editor.activeContentBlock = first;
        first.setCursor(4, 4, true);
        muya.createTable({ rows: 2, columns: 2 });
        await vi.waitFor(() => {
            expect(findTable(muya)).toBeTruthy();
        });

        const table = findTable(muya);
        expect(table.outsideContentInContext()?.text).toBe('item text');

        // Killing the nested table through its rows must not throw and must
        // seat the caret on that sibling paragraph.
        table.removeRow(1);
        const outside = table.removeRow(0);
        expect(outside?.text).toBe('item text');
        expect(muya.editor.scrollPage!.length()).toBeGreaterThan(0);
    });
});
