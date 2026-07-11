import { expect, test, type Page } from '@playwright/test'
import { DRAFTS_STORAGE_KEY, openLocalDraft } from './helpers/drafts'
import { expectEditorReady } from './helpers/editor'

test.describe.configure({ timeout: 60000 })

const RESUME_STORAGE_KEY = 'marktext-for-android:resume-positions'
const DRAFT_ID = 'resume-draft'
const DOC_KEY = `local-draft:${DRAFT_ID}`
const CAPTURE_SCROLL_TOP = 3000

const LONG_MARKDOWN = `# Resume Alpha

${Array.from(
  { length: 140 },
  (_, index) =>
    `Filler paragraph ${index + 1} with enough words to wrap onto a second line on a phone viewport.`,
).join('\n\n')}
`

async function openResumeDraft(page: Page) {
  await openLocalDraft(page, {
    id: DRAFT_ID,
    markdown: LONG_MARKDOWN,
    title: /Resume Alpha/,
  })
}

async function scrollEditorTo(page: Page, top: number) {
  await page.evaluate(value => {
    document.querySelector<HTMLElement>('.editor-host-shell')!.scrollTop = value
  }, top)
  // Wait past the capture settle window so the anchor updates.
  await page.waitForTimeout(500)
}

function getShellScrollTop(page: Page) {
  return page.evaluate(() => document.querySelector<HTMLElement>('.editor-host-shell')!.scrollTop)
}

function getResumeStorage(page: Page) {
  return page.evaluate(key => localStorage.getItem(key) ?? '', RESUME_STORAGE_KEY)
}

async function exitToHome(page: Page) {
  await page.getByTestId('back-button').click()
  await expect(page.getByTestId('new-document-button')).toBeVisible()
}

async function reopenDraft(page: Page) {
  await page.getByRole('button', { name: /Resume Alpha/ }).click()
  await expectEditorReady(page)
}

/** Open the draft, scroll deep into it, and exit so a position is stored. */
async function seedCapturedPosition(page: Page) {
  await openResumeDraft(page)
  await scrollEditorTo(page, CAPTURE_SCROLL_TOP)
  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)
}

test('captures on exit and resumes from the card without auto-scrolling', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)

  // The document opens at the top; nothing scrolls until the user taps.
  const card = page.getByTestId('resume-card')
  await expect(card).toBeVisible()
  expect(await getShellScrollTop(page)).toBe(0)
  await expect(page.getByTestId('resume-card-button')).toContainText('Filler paragraph')

  await page.getByTestId('resume-card-button').click()

  await expect(card).toHaveCount(0)
  await expect
    .poll(() => getShellScrollTop(page))
    .toBeGreaterThan(CAPTURE_SCROLL_TOP - 60)
  expect(await getShellScrollTop(page)).toBeLessThan(CAPTURE_SCROLL_TOP + 60)

  // The jump never focuses Muya, so the soft keyboard stays closed.
  const focusInEditor = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-testid="editor-host"]')),
  )
  expect(focusInEditor).toBe(false)
})

test('silently discards the position when the document changed since capture', async ({
  page,
}) => {
  await seedCapturedPosition(page)

  // Simulate an external edit between sessions.
  await page.evaluate(key => {
    const drafts = JSON.parse(localStorage.getItem(key)!) as Array<{ markdown: string }>
    drafts[0].markdown += '\nExternally appended line.\n'
    localStorage.setItem(key, JSON.stringify(drafts))
  }, DRAFTS_STORAGE_KEY)
  await page.reload()
  await reopenDraft(page)

  // No card, no fallback jump — and the stale record is cleaned up.
  await page.waitForTimeout(900)
  await expect(page.getByTestId('resume-card')).toHaveCount(0)
  expect(await getShellScrollTop(page)).toBe(0)
  await expect.poll(() => getResumeStorage(page)).not.toContain(DOC_KEY)
})

test('does not offer the card for a position near the top', async ({ page }) => {
  await openResumeDraft(page)
  await scrollEditorTo(page, 200)
  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)

  await reopenDraft(page)
  await page.waitForTimeout(900)
  await expect(page.getByTestId('resume-card')).toHaveCount(0)
})

test('user scrolling dismisses the card without jumping', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await scrollEditorTo(page, 200)

  await expect(page.getByTestId('resume-card')).toHaveCount(0)
  // Dismissal must not trigger the jump.
  expect(await getShellScrollTop(page)).toBeLessThan(400)
})

test('the explicit close control dismisses the card', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await page.getByTestId('resume-card-dismiss').click()

  await expect(page.getByTestId('resume-card')).toHaveCount(0)
  expect(await getShellScrollTop(page)).toBe(0)
})

test('competing editor surfaces dismiss the card', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await page.getByTestId('search-open-button').click()
  await expect(page.getByTestId('editor-search-bar')).toBeVisible()
  await expect(page.getByTestId('resume-card')).toHaveCount(0)

  // A fresh session offers the card again; the outline dismisses it too.
  await page.getByTestId('search-close-button').click()
  await exitToHome(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await page.getByTestId('outline-open-button').click()
  await expect(page.getByTestId('outline-sheet')).toBeVisible()
  await expect(page.getByTestId('resume-card')).toHaveCount(0)
})

test('editing dismisses the card', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await page.locator('.mu-editor p').first().click()
  await page.keyboard.type('x')

  await expect(page.getByTestId('resume-card')).toHaveCount(0)
})

test('resume never modifies the document, drafts storage, or save state', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  const draftsBefore = await page.evaluate(key => localStorage.getItem(key), DRAFTS_STORAGE_KEY)
  await page.getByTestId('resume-card-button').click()
  await expect.poll(() => getShellScrollTop(page)).toBeGreaterThan(0)
  await page.waitForTimeout(600)

  const draftsAfter = await page.evaluate(key => localStorage.getItem(key), DRAFTS_STORAGE_KEY)
  expect(draftsAfter).toBe(draftsBefore)
})

test('a revisit without scrolling keeps the stored position', async ({ page }) => {
  await seedCapturedPosition(page)
  const storedBefore = await getResumeStorage(page)

  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()
  await exitToHome(page)

  // No scroll happened, so no anchor was captured and the record survives
  // untouched for the next session.
  await page.waitForTimeout(400)
  expect(await getResumeStorage(page)).toBe(storedBefore)
})
