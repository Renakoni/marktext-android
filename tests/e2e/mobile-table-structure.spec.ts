import { expect, test, type Page } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

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
  // exits, the format panel returns.
  await tapCell(page, 'Alpha')
  await page.getByTestId('toolbar-table-table-delete-row').click()
  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)
  await expect(page.getByTestId('toolbar-command-format.strong')).toBeVisible()
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

test('delete table removes the whole table in one tap', async ({ page }) => {
  await openTableDraft(page)

  await page.getByTestId('toolbar-expand-button').click()
  await tapCell(page, 'one')
  await page.getByTestId('toolbar-table-table-delete-table').click()

  await expect(page.getByTestId('editor-host').locator('figure.mu-table')).toHaveCount(0)
  await expect(page.getByTestId('editor-host')).toContainText('before')
  await expect(page.getByTestId('editor-host')).toContainText('after')
  await expect(page.getByTestId('toolbar-command-format.strong')).toBeVisible()
})
