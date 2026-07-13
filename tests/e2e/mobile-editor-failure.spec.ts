import { expect, test } from '@playwright/test'

test.describe.configure({ timeout: 60000 })

const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'

test('surfaces a calm recovery panel instead of a silent dead editor when init fails', async ({
  page,
}) => {
  // Break the lazy @muyajs/core import so every init attempt fails — a real
  // init failure, minus the dev-only fetch cause. NOTE: a genuinely failed
  // dynamic import is cached by the browser and cannot re-resolve in the same
  // page, so full retry-to-success recovery is covered by the editorSession
  // unit test (which models the production init-throw). Here we prove the UI
  // contract: a failure surfaces a recovery panel, never a dead editor.
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

  // After the transparent auto-retry is exhausted, the recovery surface appears,
  // the bottom toolbar stands down, and the empty host never poses as a ready,
  // editable editor.
  const panel = page.getByTestId('editor-failure-panel')
  await expect(panel).toBeVisible({ timeout: 20000 })
  await expect(page.getByTestId('editor-failure-retry')).toBeVisible()
  await expect(page.getByTestId('mobile-editor-toolbar')).toBeHidden()
  await expect(page.getByTestId('editor-host')).toBeHidden()

  // Retry re-attempts the open; with the module still broken it fails again and
  // returns to the panel rather than crashing or stranding a dead editor.
  await page.getByTestId('editor-failure-retry').click()
  await expect(panel).toBeVisible()

  // Back to files: the user is never trapped on the failure screen.
  await page.getByTestId('editor-failure-back').click()
  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
})
