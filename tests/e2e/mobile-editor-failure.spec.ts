import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 60000 })

const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'
const RECOVERY_HANDOFF_KEY = 'marktext-for-android:editor-recovery-handoff'
const RECENT_DOCUMENTS_KEY = 'marktext-for-android:recent-documents'

// A one-shot handoff for a TEMPORARY Android session: no Recents entry and no
// local draft, exactly the volatile case a bare reload would lose.
const RECOVERY_HANDOFF_FIXTURE = {
  documentState: {
    id: 'carried-temp-doc',
    markdown: '# Carried Across Reload\n\nvolatile temporary session',
    displayName: 'Carried Across Reload.md',
    title: 'Carried Across Reload',
    sourceUri: 'content://test/carried-temp',
    isDirty: false,
    lineEnding: 'lf',
    isMixedLineEndings: false,
    adjustLineEndingOnSave: false,
    trimTrailingNewline: 1,
    encoding: 'utf8',
    hasEncodingBom: false,
    autosaveTarget: 'android-document',
    autosaveState: 'clean',
    lastSavedAt: null,
    lastSaveError: null,
    createdAt: '2026-07-01T09:00:00.000Z',
    updatedAt: '2026-07-01T09:00:00.000Z',
    stats: { words: 5, characters: 40, lines: 3 },
  },
  status: 'Opened temporarily',
  currentAndroidDocumentCanWrite: false,
  promptLocalDraftSaveOnExit: false,
}

// Break the lazy @muyajs/core import so every init attempt fails — a real init
// failure, minus the dev-only fetch cause — then open the seeded draft and wait
// for the recovery panel. NOTE: a genuinely failed dynamic import is cached by
// the browser and cannot re-resolve in the same page, so full retry-to-success
// recovery is a full page reload (covered below); here we prove the UI contract.
async function openWithBrokenEditor(page: Page) {
  await page.route(/muyajs/, route => route.abort())

  await page.goto('/')
  await page.evaluate(draftsKey => {
    localStorage.clear()
    localStorage.setItem(
      draftsKey,
      JSON.stringify([
        {
          id: 'editor-failure-probe',
          markdown: '# Failure probe\n\nbody text',
          updatedAt: '2026-07-01T09:00:00.000Z',
          lastSavedAt: '2026-07-01T09:00:00.000Z',
        },
      ]),
    )
  }, DRAFTS_STORAGE_KEY)
  await page.reload()

  await page.getByRole('button', { name: /Failure probe/ }).click()

  const panel = page.getByTestId('editor-failure-panel')
  await expect(panel).toBeVisible({ timeout: 20000 })
  return panel
}

test('surfaces a calm recovery panel instead of a silent dead editor when init fails', async ({
  page,
}) => {
  await openWithBrokenEditor(page)

  // The bottom toolbar stands down and the empty host never poses as a ready,
  // editable editor.
  await expect(page.getByTestId('editor-failure-retry')).toBeVisible()
  await expect(page.getByTestId('mobile-editor-toolbar')).toBeHidden()
  await expect(page.getByTestId('editor-host')).toBeHidden()

  // Back to files: the user is never trapped on the failure screen.
  await page.getByTestId('editor-failure-back').click()
  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
})

test('carries the current document across a recovery reload when Retry cannot recover in-page', async ({
  page,
}) => {
  await openWithBrokenEditor(page)

  // Fix the import for the NEXT page; the current page's rejection stays cached,
  // so the in-app retry still cannot recover and must fall back to a reload.
  await page.unroute(/muyajs/)

  // Retry's in-app re-init fails on the cached rejection, so it persists the live
  // document as a one-shot handoff and reloads. After the reload the handoff
  // reopens the SAME document — with the default 'home' startup, nothing else
  // would, so this proves the reload never drops the in-memory copy.
  await page.getByTestId('editor-failure-retry').click()

  await expect(page.getByTestId('editor-host')).toContainText('Failure probe', { timeout: 30000 })
  await expect(page.locator('.document-heading p')).toHaveText('Ready')

  // The one-shot handoff was consumed by the restore.
  const remaining = await page.evaluate(key => localStorage.getItem(key), RECOVERY_HANDOFF_KEY)
  expect(remaining).toBeNull()
})

test('keeps the recovery panel when the reload handoff cannot be persisted', async ({ page }) => {
  await openWithBrokenEditor(page)

  // Model a real quota/storage denial for this one key. The current page's
  // failed dynamic import remains cached, so Retry reaches the handoff path.
  await page.evaluate(handoffKey => {
    ;(window as unknown as { __recoveryPageSentinel?: boolean }).__recoveryPageSentinel = true
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === handoffKey) {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
      }
      return originalSetItem.call(this, key, value)
    }
  }, RECOVERY_HANDOFF_KEY)

  await page.getByTestId('editor-failure-retry').click()

  // With no durable handoff, reload is canceled and the user stays on the
  // recoverable failure surface instead of losing the in-memory document.
  await expect(page.getByTestId('editor-failure-panel')).toBeVisible({ timeout: 20000 })
  const pageState = await page.evaluate(handoffKey => ({
    sentinel: (window as unknown as { __recoveryPageSentinel?: boolean }).__recoveryPageSentinel,
    handoff: localStorage.getItem(handoffKey),
  }), RECOVERY_HANDOFF_KEY)
  expect(pageState.sentinel).toBe(true)
  expect(pageState.handoff).toBeNull()
})

test('reopens a temporary document carried across a recovery reload', async ({ page }) => {
  await page.goto('/')
  // Seed the one-shot handoff a recovery reload would have written, then reload
  // to exercise the boot restore.
  await page.evaluate(
    ({ handoffKey, handoff }) => {
      localStorage.clear()
      localStorage.setItem(handoffKey, JSON.stringify(handoff))
    },
    { handoffKey: RECOVERY_HANDOFF_KEY, handoff: RECOVERY_HANDOFF_FIXTURE },
  )
  await page.reload()

  // Boot consumes the handoff and reopens the exact document instead of Home —
  // the temporary session survives the reload.
  await expect(page.getByTestId('editor-host')).toContainText('Carried Across Reload', {
    timeout: 30000,
  })
  await expect(page.locator('.document-heading p')).toHaveText('Opened temporarily')

  // The one-shot handoff was consumed, so a persistently failing document can't
  // reopen on every boot.
  const remaining = await page.evaluate(key => localStorage.getItem(key), RECOVERY_HANDOFF_KEY)
  expect(remaining).toBeNull()

  // It was restored from the handoff, not from Recents (a temporary session has
  // no Recents entry) — proof the content survived via the handoff, not storage.
  const recents = await page.evaluate(key => localStorage.getItem(key) ?? '', RECENT_DOCUMENTS_KEY)
  expect(recents).not.toContain('content://test/carried-temp')
})
