import { expect, test, type Page } from '@playwright/test'
import { newBlankDocument, openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// A 2x2 table (header + one body row) with prose on both sides, so the
// caret always has an outside block to land on when the table goes away.
const TABLE_MARKDOWN = `# Table probe

before

| Alpha | Bravo |
| --- | --- |
| one | two |

after
`

async function openTableDraft(page: Page) {
  await openLocalDraft(page, {
    id: 'table-structure-draft',
    markdown: TABLE_MARKDOWN,
    title: /Table probe/,
    now: '2026-07-01T10:00:00.000Z',
  })
}

function tableRows(page: Page) {
  return page.getByTestId('editor-host').locator('figure.mu-table tr')
}

async function tapCell(page: Page, text: string) {
  await page.getByTestId('editor-host').locator('figure.mu-table').getByText(text).click()
}

test('the toolbar follows the caret into the table and back out', async ({ page }) => {
  await openTableDraft(page)

  await page.getByTestId('toolbar-expand-button').click()
  await expect(page.getByTestId('toolbar-command-format.strong')).toBeVisible()

  // Caret into a body cell: the TABLE panel takes over and the panel menu
  // gains its contextual entry.
  await tapCell(page, 'two')
  await expect(page.getByTestId('toolbar-table-table-insert-row-below')).toBeVisible()
  await page.getByTestId('toolbar-group-switcher').click()
  await expect(page.getByTestId('toolbar-section-option-table')).toBeVisible()
  await page.getByTestId('toolbar-group-switcher').click()

  // Caret out to prose: the previous panel returns and the contextual
  // entry disappears with it.
  await page.getByTestId('editor-host').getByText('after').click()
  await expect(page.getByTestId('toolbar-command-format.strong')).toBeVisible()
  await expect(page.getByTestId('toolbar-table-table-insert-row-below')).toHaveCount(0)
})

test('inserts and deletes rows and columns around the caret cell', async ({ page }) => {
  await openTableDraft(page)

  await page.getByTestId('toolbar-expand-button').click()
  await tapCell(page, 'two')
  await expect(tableRows(page)).toHaveCount(2)

  // Insert below: a fresh row appears and the caret lands in it, so
  // typing goes straight into the new first cell.
  await page.getByTestId('toolbar-table-table-insert-row-below').click()
  await expect(tableRows(page)).toHaveCount(3)
  await page.keyboard.type('fresh')
  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toContainText('fresh')

  // Insert column right of the caret cell: the caret stays in the
  // ORIGINATING row (the engine's own return value is the header-row
  // cell), so typing lands in the body row, not the header.
  await tapCell(page, 'two')
  await page.getByTestId('toolbar-table-table-insert-column-right').click()
  await expect(tableRows(page).first().locator('th, td')).toHaveCount(3)
  await page.keyboard.type('sidecar')
  await expect(tableRows(page).nth(1)).toContainText('sidecar')
  await expect(tableRows(page).first()).not.toContainText('sidecar')

  // The caret sits in the new column, so deleting the column consumes it.
  await page.getByTestId('toolbar-table-table-delete-column').click()
  await expect(tableRows(page).first().locator('th, td')).toHaveCount(2)
  await expect(page.getByTestId('editor-host')).not.toContainText('sidecar')

  // Delete the row that holds the caret.
  await tapCell(page, 'fresh')
  await page.getByTestId('toolbar-table-table-delete-row').click()
  await expect(tableRows(page)).toHaveCount(2)
  await expect(page.getByTestId('editor-host')).not.toContainText('fresh')
})

test('a table command works again right after undoing the previous one', async ({ page }) => {
  // Device-reproduced #144 bug: insert row -> undo -> insert row again
  // silently no-opped and kicked the panel out. The session's FIRST
  // recorded op stored no selection, so its undo restored nothing and
  // the active content block kept pointing into the removed row.
  await openTableDraft(page)

  await page.getByTestId('toolbar-expand-button').click()
  await tapCell(page, 'two')
  await expect(tableRows(page)).toHaveCount(2)

  await page.getByTestId('toolbar-table-table-insert-row-above').click()
  await expect(tableRows(page)).toHaveCount(3)

  await page.getByTestId('toolbar-command-edit.undo').click()
  await expect(tableRows(page)).toHaveCount(2)

  // The caret is back on a live cell: the panel stays TABLE and the
  // repeated command inserts again instead of no-opping.
  await expect(page.getByTestId('toolbar-table-table-insert-row-above')).toBeVisible()
  await page.getByTestId('toolbar-table-table-insert-row-above').click()
  await expect(tableRows(page)).toHaveCount(3)
})

test('a tail insert undo keeps the table context (insert below the last row)', async ({
  page,
}) => {
  // Review gap on #175: inserting BELOW the last row parks the caret at a
  // tail index the undo removes, so the recorded post-op path stopped
  // resolving and the context fell to the document head. Priming records
  // the before-command cell instead.
  await openTableDraft(page)

  await page.getByTestId('toolbar-expand-button').click()
  await tapCell(page, 'two')
  await page.getByTestId('toolbar-table-table-insert-row-below').click()
  await expect(tableRows(page)).toHaveCount(3)

  await page.getByTestId('toolbar-command-edit.undo').click()
  await expect(tableRows(page)).toHaveCount(2)

  // Context intact: the panel still shows the table strip and the repeat
  // inserts again.
  await expect(page.getByTestId('toolbar-table-table-insert-row-below')).toBeVisible()
  await page.getByTestId('toolbar-table-table-insert-row-below').click()
  await expect(tableRows(page)).toHaveCount(3)
})

test('undoing a table delete puts the caret back into the restored table', async ({ page }) => {
  // Device-reported: delete the table (caret lands on the following
  // prose), undo — the table came back but the caret teleported to the
  // DOCUMENT HEAD. The command primes the entry with the true
  // before-command selection, so the undo restores the caret into the
  // cell it came from.
  await openTableDraft(page)

  await page.getByTestId('toolbar-expand-button').click()
  await tapCell(page, 'one')
  // Pin the caret to the cell start so the restored offset is exact.
  await page.keyboard.press('Home')
  await page.getByTestId('toolbar-table-table-delete-table').click()
  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)

  await page.getByTestId('toolbar-command-edit.undo').click()
  await expect(tableRows(page)).toHaveCount(2)

  await page.keyboard.type('X')
  await expect(tableRows(page).nth(1)).toContainText('Xone')
  // Nowhere near the document head.
  await expect(page.getByTestId('editor-host')).not.toContainText('X# Table probe')
})

test('removing the last row or the whole table drops the caret outside and restores the panel', async ({
  page,
}) => {
  await openTableDraft(page)

  await page.getByTestId('toolbar-expand-button').click()

  // Deleting the body row leaves a header-only table.
  await tapCell(page, 'one')
  await page.getByTestId('toolbar-table-table-delete-row').click()
  await expect(tableRows(page)).toHaveCount(1)

  // Deleting the last remaining row removes the table itself: the caret
  // exits onto the FOLLOWING prose (not lost in the detached tree), the
  // format panel returns, and typing proves where the caret landed.
  await tapCell(page, 'Alpha')
  await page.getByTestId('toolbar-table-table-delete-row').click()
  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)
  await expect(page.getByTestId('toolbar-command-format.strong')).toBeVisible()
  await page.keyboard.type('landed-')
  await expect(page.getByTestId('editor-host')).toContainText('landed-after')
})

// A document whose ONLY block is the table: every removal path must
// restore the one-empty-paragraph invariant instead of leaving a dead,
// uneditable page.
const TABLE_ONLY_MARKDOWN = `| Solo | Table |
| --- | --- |
| one | two |
`

test('deleting the only table restores an editable empty paragraph', async ({ page }) => {
  await openLocalDraft(page, {
    id: 'table-only-draft',
    markdown: TABLE_ONLY_MARKDOWN,
    title: /Solo/,
    now: '2026-07-01T10:00:00.000Z',
  })

  await page.getByTestId('toolbar-expand-button').click()
  await tapCell(page, 'one')
  await page.getByTestId('toolbar-table-table-delete-table').click()

  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)
  await expect(page.getByTestId('toolbar-command-format.strong')).toBeVisible()
  await page.keyboard.type('reborn')
  await expect(page.getByTestId('editor-host')).toContainText('reborn')
})

test('deleting the only table via its last row restores an editable paragraph', async ({
  page,
}) => {
  await openLocalDraft(page, {
    id: 'table-only-rows-draft',
    markdown: TABLE_ONLY_MARKDOWN,
    title: /Solo/,
    now: '2026-07-01T10:00:00.000Z',
  })

  await page.getByTestId('toolbar-expand-button').click()
  await tapCell(page, 'one')
  await page.getByTestId('toolbar-table-table-delete-row').click()
  await tapCell(page, 'Solo')
  await page.getByTestId('toolbar-table-table-delete-row').click()

  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)
  await page.keyboard.type('afterlife')
  await expect(page.getByTestId('editor-host')).toContainText('afterlife')
})

test('recovers an editable paragraph when the deleted table was a list item\'s only content', async ({
  page,
}) => {
  // The reachable shape codex round three pinned: inserting a table from
  // an EMPTY list item replaces the item's paragraph, so the table becomes
  // the item's only child. Deleting it leaves empty container skeletons —
  // a top-level block with zero content descendants — and the recovery
  // must still restore an editable paragraph.
  await newBlankDocument(page)
  await page.getByTestId('editor-host').click()
  await page.keyboard.type('- ')

  await page.getByTestId('toolbar-expand-button').click()
  await page.getByTestId('toolbar-group-switcher').click()
  await page.getByTestId('toolbar-section-option-insert').click()
  await page.getByTestId('toolbar-command-paragraph.table').click()
  await expect(page.getByTestId('table-insert-sheet')).toBeVisible()
  await page.getByTestId('table-insert-button').click()

  // The table nests as the list item's ONLY child.
  await expect(page.getByTestId('editor-host').locator('li > figure.mu-table')).toHaveCount(1)

  // Tapping a cell brings the TABLE panel up (programmatic insertion does
  // not emit a selection change, so the panel follows the first tap), and
  // the sheet flow collapsed the toolbar, so expand it again to see it.
  await page
    .getByTestId('editor-host')
    .locator('figure.mu-table span.mu-table-cell-content')
    .first()
    .click()
  await page.getByTestId('toolbar-expand-button').click()
  await expect(page.getByTestId('toolbar-table-table-delete-table')).toBeVisible()

  await page.getByTestId('toolbar-table-table-delete-table').click()
  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)
  await page.keyboard.type('reborn')
  await expect(page.getByTestId('editor-host')).toContainText('reborn')
})

test('delete table removes the whole table in one tap', async ({ page }) => {
  await openTableDraft(page)

  await page.getByTestId('toolbar-expand-button').click()
  await tapCell(page, 'one')
  await page.getByTestId('toolbar-table-table-delete-table').click()

  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)
  await expect(page.getByTestId('editor-host')).toContainText('before')
  await expect(page.getByTestId('editor-host')).toContainText('after')
  await expect(page.getByTestId('toolbar-command-format.strong')).toBeVisible()

  // The caret lands on the prose right after the removed table.
  await page.keyboard.type('landed-')
  await expect(page.getByTestId('editor-host')).toContainText('landed-after')
})
