import { expect, test } from '@playwright/test'

// #152 — the draft store is one JSON array in localStorage, and the quota
// (~5 MB in Chromium-family engines) is its binding constraint. This pins
// the FAILURE CONTRACT at that wall: a quota-rejected autosave must leave
// the stored array untouched, keep the live edit in the editor, surface
// "Autosave failed", and self-heal on the next successful write. The
// measurement curves behind that verdict live on the issue.

const DRAFTS_KEY = 'marktext-for-android:drafts'

function makeDrafts(count: number, bytesEach: number) {
  const body = 'x'.repeat(Math.max(0, bytesEach - 100))
  const base = Date.parse('2026-07-01T00:00:00.000Z')
  return Array.from({ length: count }, (_, i) => ({
    id: `probe-${String(i).padStart(4, '0')}`,
    markdown: `# Probe ${i}\n\n${body}`,
    createdAt: new Date(base).toISOString(),
    updatedAt: new Date(base + i * 1000).toISOString(),
    lastSavedAt: new Date(base + i * 1000).toISOString(),
  }))
}

test('autosave failure at quota keeps stored data and the live edit', async ({ page }) => {
  test.setTimeout(120000)
  // Seed one existing draft, open a new document, type, then make every
  // setItem throw QuotaExceededError and let the autosave fire.
  await page.goto('/')
  await page.evaluate(
    ({ key, drafts }) => {
      localStorage.clear()
      localStorage.setItem(key, JSON.stringify(drafts))
    },
    { key: DRAFTS_KEY, drafts: makeDrafts(1, 500) },
  )
  await page.reload()
  await page.getByTestId('new-document-button').click()
  await expect(page.getByTestId('editor-host')).toBeVisible()
  await page.getByTestId('editor-host').click()
  await page.keyboard.type('quota probe content survives')

  const storedBefore = await page.evaluate(key => localStorage.getItem(key) ?? '', DRAFTS_KEY)

  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as unknown as { __restoreSetItem: () => void }).__restoreSetItem = () => {
      Storage.prototype.setItem = original
    }
    Storage.prototype.setItem = function () {
      const error = new DOMException('quota exceeded (injected)', 'QuotaExceededError')
      throw error
    }
  })

  // Autosave debounce fires; the status chip must report the failure.
  await expect(page.getByText('Autosave failed')).toBeVisible({ timeout: 20000 })

  const results = await page.evaluate(key => {
    const stored = localStorage.getItem(key) ?? ''
    ;(window as unknown as { __restoreSetItem: () => void }).__restoreSetItem()
    return { stored }
  }, DRAFTS_KEY)

  // Stored data untouched by the failed write.
  expect(results.stored).toBe(storedBefore)
  // The live edit is still in the editor.
  await expect(page.getByTestId('editor-host')).toContainText('quota probe content survives')

  // Recovery: with storage healthy again, the next autosave persists BOTH
  // the seeded draft and the new document.
  await page.getByTestId('editor-host').click()
  await page.keyboard.type(' and recovers')
  await expect.poll(
    () => page.evaluate(key => localStorage.getItem(key) ?? '', DRAFTS_KEY),
    { timeout: 20000 },
  ).toContain('quota probe content')
  const finalStored = await page.evaluate(key => localStorage.getItem(key) ?? '', DRAFTS_KEY)
  expect(finalStored).toContain('recovers')
  expect(finalStored).toContain('Probe 0')
})
