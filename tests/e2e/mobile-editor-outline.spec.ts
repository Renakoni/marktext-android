import { expect, test, type Page } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

const HEADINGS_MARKDOWN = `# Alpha

intro paragraph

> ## Quoted heading

## Beta

${'filler paragraph one\n\n'.repeat(20)}## Beta

### Gamma nested

${'filler paragraph two\n\n'.repeat(20)}# Omega
`

async function openHeadingsDraft(page: Page) {
  await openLocalDraft(page, {
    id: 'outline-draft',
    markdown: HEADINGS_MARKDOWN,
    title: /Alpha/,
  })
}

async function openOutline(page: Page) {
  await page.getByTestId('outline-open-button').click()
  await expect(page.getByTestId('outline-sheet')).toBeVisible()
}

test('outline lists top-level headings with normalized indentation', async ({ page }) => {
  await openHeadingsDraft(page)
  await openOutline(page)

  const rows = page.getByTestId('outline-row')
  await expect(rows).toHaveCount(5)
  await expect(rows.nth(0)).toHaveText('Alpha')
  await expect(rows.nth(1)).toHaveText('Beta')
  await expect(rows.nth(2)).toHaveText('Beta')
  await expect(rows.nth(3)).toHaveText('Gamma nested')
  await expect(rows.nth(4)).toHaveText('Omega')

  // The quoted heading is not a top-level block and must not appear.
  await expect(page.getByTestId('outline-list')).not.toContainText('Quoted heading')

  // Indentation is normalized from H1 and the dialog is modal.
  await expect(rows.nth(0)).toHaveAttribute('data-outline-indent', '0')
  await expect(rows.nth(1)).toHaveAttribute('data-outline-indent', '1')
  await expect(rows.nth(3)).toHaveAttribute('data-outline-indent', '2')
  await expect(page.getByTestId('outline-sheet')).toHaveAttribute('aria-modal', 'true')
})

test('selecting a repeated heading scrolls the editor to the correct occurrence', async ({
  page,
}) => {
  await openHeadingsDraft(page)
  await openOutline(page)

  // Choose the SECOND "Beta" (third row) — index mapping must not collapse
  // repeated titles or count the blockquote heading.
  await page.getByTestId('outline-row').nth(2).click()

  await expect(page.getByTestId('outline-sheet')).toHaveCount(0)

  await expect
    .poll(() =>
      page.evaluate(() => {
        const shell = document.querySelector('.editor-host-shell')!
        const headings = shell.querySelectorAll('.mu-container > h2')
        const target = headings[1]!
        const shellRect = shell.getBoundingClientRect()
        const rect = target.getBoundingClientRect()
        return rect.top >= shellRect.top && rect.top < shellRect.top + shellRect.height * 0.5
      }),
    )
    .toBe(true)

  // Navigation must not focus the editor (keyboard stays closed).
  const focusInEditor = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-testid="editor-host"]')),
  )
  expect(focusInEditor).toBe(false)
})

test('outline does not modify the document markdown', async ({ page }) => {
  await openHeadingsDraft(page)
  const before = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts'))

  await openOutline(page)
  await page.getByTestId('outline-row').nth(4).click()
  await expect(page.getByTestId('outline-sheet')).toHaveCount(0)

  const after = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts'))
  expect(after).toBe(before)
})

test('scrim tap and the explicit close action both dismiss the outline', async ({ page }) => {
  await openHeadingsDraft(page)

  await openOutline(page)
  await page.getByTestId('outline-close-button').click()
  await expect(page.getByTestId('outline-sheet')).toHaveCount(0)

  await openOutline(page)
  await page.getByTestId('outline-sheet-scrim').click({ position: { x: 10, y: 10 } })
  await expect(page.getByTestId('outline-sheet')).toHaveCount(0)
})

test('outline shows a restrained empty state without headings', async ({ page }) => {
  await openLocalDraft(page, {
    id: 'outline-empty-draft',
    markdown: 'plain paragraph only\n',
    title: /plain paragraph/,
  })

  await openOutline(page)

  await expect(page.getByTestId('outline-empty')).toBeVisible()
  await expect(page.getByTestId('outline-row')).toHaveCount(0)

  await page.getByTestId('outline-close-button').click()
  await expect(page.getByTestId('outline-sheet')).toHaveCount(0)
})

test('opening the outline dismisses editor focus so the keyboard closes', async ({ page }) => {
  await openHeadingsDraft(page)

  await page.getByTestId('editor-host').click()
  const focusedBefore = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-testid="editor-host"]')),
  )
  expect(focusedBefore).toBe(true)

  await openOutline(page)

  const focusedAfter = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-testid="editor-host"]')),
  )
  expect(focusedAfter).toBe(false)

  // Accessibility focus moved into the dialog instead.
  await expect(page.getByTestId('outline-sheet')).toBeFocused()
})
