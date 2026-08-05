// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// Undoing a whole-table delete used to teleport the caret to the document
// head: the entry's recorded selection pointed at the POST-delete caret
// (the paragraph after the table), whose path the undo's re-insert now
// occupies with the table — a non-content block — and the restore fell
// back to focus(). Two fixes pinned here: primeRecordSelection() stamps
// the entry with the true before-command selection, and the restore's
// fallback seats the caret at the nearest content under the resolved
// block instead of the document head.

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
    cellAt: (row: number, column: number) => {
        firstChild: { text: string; setCursor: (b: number, e: number, u?: boolean) => void };
    };
    outsideContentInContext: () => { setCursor: (b: number, e: number, u?: boolean) => void } | null;
    remove: () => void;
}

function findTable(muya: Muya): ITableProbe | null {
    let table: ITableProbe | null = null;
    muya.editor.scrollPage!.depthFirstTraverse((block) => {
        if (block.blockName === 'table' && table == null)
            table = block as unknown as ITableProbe;
    });
    return table;
}

function activeText(muya: Muya): string {
    return (muya.editor.activeContentBlock as { text?: string } | null)?.text ?? 'null';
}

const DOC = 'before\n\n| A | B |\n| --- | --- |\n| one | two |\n\nafter\n';

function deleteWholeTable(muya: Muya, { prime }: { prime: boolean }) {
    const table = findTable(muya)!;
    table.cellAt(1, 0).firstChild.setCursor(0, 0, true);

    muya.editor.history.cutoff();
    if (prime)
        muya.editor.history.primeRecordSelection();
    const outside = table.outsideContentInContext();
    table.remove();
    outside?.setCursor(0, 0, true);
    muya.editor.jsonState.flush();
    muya.editor.history.cutoff();

    expect(findTable(muya)).toBeNull();
    expect(activeText(muya)).toBe('after');
}

describe('caret restore across a whole-table delete undo', () => {
    it('primed: the caret returns INTO the restored table cell it came from', () => {
        const muya = bootMuya(DOC);
        deleteWholeTable(muya, { prime: true });

        muya.undo();

        expect(findTable(muya)).not.toBeNull();
        expect(activeText(muya)).toBe('one');
    });

    it('unprimed: the nearest-content fallback lands in the restored table, never the head', () => {
        const muya = bootMuya(DOC);
        deleteWholeTable(muya, { prime: false });

        muya.undo();

        // The recorded (post-delete) path now points at the re-inserted
        // table; the caret lands on its first content — not on 'before'
        // and not at the document head.
        expect(findTable(muya)).not.toBeNull();
        expect(activeText(muya)).toBe('A');
    });
});
