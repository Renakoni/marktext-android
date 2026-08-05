import { expect, test, type Page } from '@playwright/test'
import { DRAFTS_STORAGE_KEY } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// #151 — drafts beyond the home's recency cap existed with no UI path to
// them. The quiet resting view keeps the cap (100); a "show more" text
// action at the end of Earlier expands the list to the COMPLETE draft
// collection. Expansion is ephemeral state: it never writes storage.

const TOTAL = 105

function seededDrafts() {
  const base = Date.parse('2026-06-01T00:00:00.000Z')
  return Array.from({ length: TOTAL }, (_, i) => ({
    id: `draft-${String(i + 1).padStart(3, '0')}`,
    markdown: `# Probe ${i + 1}\n\npayload-${i + 1}\n`,
    createdAt: new Date(base).toISOString(),
    updatedAt: new Date(base + (i + 1) * 60_000).toISOString(),
    lastSavedAt: new Date(base + (i + 1) * 60_000).toISOString(),
  }))
}

async function openSeededHome(page: Page) {
  await page.goto('/')
  await page.evaluate(
    ({ draftsStorageKey, drafts }) => {
      localStorage.clear()
      localStorage.setItem(draftsStorageKey, JSON.stringify(drafts))
    },
    { draftsStorageKey: DRAFTS_STORAGE_KEY, drafts: seededDrafts() },
  )
  await page.reload()
}

function documentRows(page: Page) {
  return page.getByTestId('documents-screen').getByRole('button', { name: /Probe \d+/ })
}

test('every draft beyond the cap is reachable through show-more', async ({ page }) => {
  await openSeededHome(page)

  // Resting view: exactly the capped 100 (Continue masthead + Earlier),
  // and the quiet expander names what is hidden.
  await expect(documentRows(page)).toHaveCount(100)
  const showAll = page.getByTestId('home-show-all-button')
  await expect(showAll).toHaveText(/5/)

  const storageBefore = await page.evaluate(
    key => localStorage.getItem(key) ?? '',
    DRAFTS_STORAGE_KEY,
  )

  await showAll.click()
  await expect(documentRows(page)).toHaveCount(TOTAL)
  await expect(page.getByTestId('home-show-all-button')).toHaveCount(0)

  // The expansion is presentation-only: the durable collection is
  // byte-identical.
  const storageAfter = await page.evaluate(
    key => localStorage.getItem(key) ?? '',
    DRAFTS_STORAGE_KEY,
  )
  expect(storageAfter).toBe(storageBefore)

  // The OLDEST draft — unreachable before this change — opens normally.
  await page.getByRole('button', { name: /Probe 1(?!\d)/ }).click()
  await expect(page.getByTestId('editor-host')).toContainText('payload-1')
})

test('pinning a beyond-cap draft keeps it visible in the resting view', async ({ page }) => {
  await openSeededHome(page)

  await page.getByTestId('home-show-all-button').click()
  const oldest = page.getByRole('button', { name: /Probe 1(?!\d)/ })
  await oldest.click({ delay: 700 })

  await expect(page.getByTestId('home-selection-bar')).toBeVisible()
  await page.getByTestId('home-selection-pin').click()

  // Fresh visit (selection and expansion are both ephemeral): the list
  // rests collapsed again, but the pinned beyond-cap draft stays
  // visible — pinning is explicit intent.
  await page.reload()
  await expect(page.getByRole('button', { name: /Probe 1(?!\d)/ })).toBeVisible()
  await expect(page.getByTestId('home-show-all-button')).toHaveText(/4/)
})
