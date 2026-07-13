import { expect, test } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// Five 10em columns are far wider than a Pixel 5 portrait editor column, so the
// table reliably exercises the horizontal-overflow path.
const WIDE_TABLE_MARKDOWN = `# Wide table

| Alpha | Bravo | Charlie | Delta | Echo |
| --- | --- | --- | --- | --- |
| one | two | three | four | five |
| six | seven | eight | nine | ten |
`

async function overflow(locator: import('@playwright/test').Locator) {
  return locator.evaluate(el => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollLeft: el.scrollLeft,
  }))
}

test('a wide table scrolls inside its own figure, never the editor root', async ({ page }) => {
  await openLocalDraft(page, {
    id: 'wide-table-draft',
    markdown: WIDE_TABLE_MARKDOWN,
    title: /Wide table/,
    now: '2026-07-01T10:00:00.000Z',
  })

  const table = page.getByTestId('editor-host').locator('figure.mu-table')
  const shell = page.locator('.editor-host-shell')
  await expect(table).toBeVisible()

  // The table genuinely overflows its own figure — the horizontal scroll it owns.
  const tableBefore = await overflow(table)
  expect(tableBefore.scrollWidth).toBeGreaterThan(tableBefore.clientWidth)

  // The editor root does not overflow sideways: nothing slides the whole editor.
  const shellBefore = await overflow(shell)
  expect(shellBefore.scrollWidth).toBeLessThanOrEqual(shellBefore.clientWidth + 1)

  // Swiping the table scrolls the table itself...
  await table.evaluate(el => el.scrollTo({ left: 9999 }))
  expect((await overflow(table)).scrollLeft).toBeGreaterThan(0)

  // ...while the editor root stays pinned and cannot be scrolled horizontally.
  await shell.evaluate(el => el.scrollTo({ left: 9999 }))
  expect((await overflow(shell)).scrollLeft).toBe(0)

  // Landscape keeps the same invariant: the wide table still owns its overflow
  // and the root never slides horizontally.
  await page.setViewportSize({ width: 851, height: 393 })
  const shellLandscape = await overflow(shell)
  expect(shellLandscape.scrollWidth).toBeLessThanOrEqual(shellLandscape.clientWidth + 1)
})
