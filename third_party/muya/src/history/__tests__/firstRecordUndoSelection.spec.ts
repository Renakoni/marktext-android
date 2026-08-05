// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// The session's FIRST recorded operation used to store selection = null
// (the selection stack held one entry and the bookkeeping only returned
// the "previous" entry of two). Undoing that op then restored NOTHING:
// editor.activeContentBlock kept pointing into the subtree the inverse op
// removed, so every consumer that climbs from it — the mobile table panel
// above all — misread the caret as "not in a table" and its commands
// silently no-opped (#144 review, device-reproduced).

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

interface ITableProbe {
    rowCount: number;
    cellAt: (row: number, column: number) => { firstChild: { text: string; setCursor: (b: number, e: number, u?: boolean) => void } };
    insertRow: (offset: number) => { setCursor: (b: number, e: number, u?: boolean) => void };
}

function findTable(muya: Muya): ITableProbe {
    let table: ITableProbe | null = null;
    muya.editor.scrollPage!.depthFirstTraverse((block) => {
        if (block.blockName === 'table' && table == null)
            table = block as unknown as ITableProbe;
    });
    expect(table).not.toBeNull();
    return table!;
}

function activeBlockRootName(muya: Muya): string {
    // The scroll page itself has a non-block parent, so the climb stops
    // there (mirrors the editor's own attachment check).
    let node = muya.editor.activeContentBlock as { blockName: string; parent: unknown } | null;
    if (!node)
        return 'null';
    while (node.blockName !== 'scrollpage' && node.parent)
        node = node.parent as typeof node;
    return node.blockName;
}

describe('undo of the session\'s first recorded op', () => {
    it('re-seats the caret on a live block instead of leaving a detached reference', () => {
        const muya = bootMuya('before\n\n| A | B |\n| --- | --- |\n| one | two |\n\nafter\n');
        const table = findTable(muya);

        // Caret into the body cell, then the mobile-adapter command shape:
        // boundary-cut insert with the caret moved onto the fresh row.
        table.cellAt(1, 0).firstChild.setCursor(0, 0, true);
        muya.editor.history.cutoff();
        table.insertRow(1).setCursor(0, 0, true);
        muya.editor.jsonState.flush();
        muya.editor.history.cutoff();
        expect(table.rowCount).toBe(3);

        muya.undo();

        // The insert is undone AND the active content block is a live table
        // cell again — its parent chain reaches the scroll page.
        expect(findTable(muya).rowCount).toBe(2);
        expect(activeBlockRootName(muya)).toBe('scrollpage');
        const active = muya.editor.activeContentBlock as { blockName: string } | null;
        expect(active?.blockName).toBe('table.cell.content');

        // The immediate follow-up command therefore works — the exact
        // device sequence that used to no-op and kick the panel out.
        muya.editor.history.cutoff();
        findTable(muya).insertRow(1).setCursor(0, 0, true);
        muya.editor.jsonState.flush();
        muya.editor.history.cutoff();
        expect(findTable(muya).rowCount).toBe(3);
    });

    it('never leaves a detached active block when a restore has no selection', () => {
        const muya = bootMuya('| A | B |\n| --- | --- |\n| one | two |\n');
        const table = findTable(muya);
        const cellContent = table.cellAt(1, 0).firstChild;
        cellContent.setCursor(0, 0, true);

        // Simulate the null-selection restore against a block whose subtree
        // was just detached (internal links intact, no page root).
        const editor = muya.editor as unknown as {
            activeContentBlock: unknown;
            _restoreSelection: (selection: null) => void;
        };
        const detached = {
            blockName: 'table.cell.content',
            parent: { blockName: 'table.cell', parent: { blockName: 'table.row', parent: null } },
            // The activeContentBlock setter drives focus/blur on the blocks.
            focusHandler: () => {},
            blurHandler: () => {},
        };
        editor.activeContentBlock = detached;
        editor._restoreSelection(null);
        expect(editor.activeContentBlock).toBeNull();

        // An ATTACHED active block survives the same call untouched.
        cellContent.setCursor(0, 0, true);
        editor._restoreSelection(null);
        expect(activeBlockRootName(muya)).toBe('scrollpage');
    });
});
