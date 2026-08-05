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

  // Insert column right of the caret cell.
  await tapCell(page, 'two')
  await page.getByTestId('toolbar-table-table-insert-column-right').click()
  await expect(tableRows(page).first().locator('th, td')).toHaveCount(3)

  // Delete that column again from a cell inside it? The caret sits in the
  // NEW column after the insert, so deleting the column consumes it.
  await page.getByTestId('toolbar-table-table-delete-column').click()
  await expect(tableRows(page).first().locator('th, td')).toHaveCount(2)

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
