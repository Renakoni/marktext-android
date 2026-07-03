import { expect, test } from '@playwright/test'
import { expectEditorReady } from './helpers/editor'

const SETTINGS_STORAGE_KEY = 'marktext-for-android:settings-ui'
const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'

test('opens the last edited visible draft when Documents startup uses last edit', async ({
  page,
}) => {
  await page.addInitScript(({ settingsKey, draftsKey }) => {
    localStorage.clear()
    localStorage.setItem(settingsKey, JSON.stringify({ startUpAction: 'lastEdit' }))
    localStorage.setItem(
      draftsKey,
      JSON.stringify([
        {
          id: 'older-draft',
          markdown: '# Older Startup Draft\n\nbody',
          createdAt: '2026-06-29T00:00:00.000Z',
          updatedAt: '2026-06-29T00:00:00.000Z',
          lastSavedAt: '2026-06-29T00:00:00.000Z',
        },
        {
          id: 'newer-draft',
          markdown: '# Newer Startup Draft\n\nbody',
          createdAt: '2026-06-29T00:01:00.000Z',
          updatedAt: '2026-06-29T00:05:00.000Z',
          lastSavedAt: '2026-06-29T00:05:00.000Z',
        },
      ]),
    )
  }, { settingsKey: SETTINGS_STORAGE_KEY, draftsKey: DRAFTS_STORAGE_KEY })

  await page.goto('/')

  await expectEditorReady(page)
  await expect(page.getByTestId('editor-host')).toContainText('Newer Startup Draft')
})

test('sorts the recent home using the Documents sort setting', async ({ page }) => {
  await page.addInitScript(({ settingsKey, draftsKey }) => {
    localStorage.clear()
    localStorage.setItem(
      settingsKey,
      JSON.stringify({ fileSortBy: 'title', fileSortOrder: 'asc' }),
    )
    localStorage.setItem(
      draftsKey,
      JSON.stringify([
        {
          id: 'zulu-draft',
          markdown: '# Zulu Draft\n\nbody',
          createdAt: '2026-06-29T00:00:00.000Z',
          updatedAt: '2026-06-29T00:03:00.000Z',
          lastSavedAt: '2026-06-29T00:03:00.000Z',
        },
        {
          id: 'alpha-draft',
          markdown: '# Alpha Draft\n\nbody',
          createdAt: '2026-06-29T00:01:00.000Z',
          updatedAt: '2026-06-29T00:01:00.000Z',
          lastSavedAt: '2026-06-29T00:01:00.000Z',
        },
        {
          id: 'bravo-draft',
          markdown: '# Bravo Draft\n\nbody',
          createdAt: '2026-06-29T00:02:00.000Z',
          updatedAt: '2026-06-29T00:02:00.000Z',
          lastSavedAt: '2026-06-29T00:02:00.000Z',
        },
      ]),
    )
  }, { settingsKey: SETTINGS_STORAGE_KEY, draftsKey: DRAFTS_STORAGE_KEY })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Continue writing' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Alpha Draft/ }).first()).toBeVisible()
  await page.getByRole('button', { name: /Alpha Draft/ }).first().click()
  await expectEditorReady(page)
  await expect(page.getByTestId('editor-host')).toContainText('Alpha Draft')
})

test('does not keep local drafts when the Documents local draft setting is disabled', async ({
  page,
}) => {
  await page.addInitScript(({ settingsKey }) => {
    localStorage.clear()
    localStorage.setItem(
      settingsKey,
      JSON.stringify({ localDrafts: false, autoSave: true, autoSaveDelay: 1 }),
    )
  }, { settingsKey: SETTINGS_STORAGE_KEY })

  await page.goto('/')
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Hidden Local Draft')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('local drafts are disabled')
  await page.waitForTimeout(1500)

  const draftsBeforeExit = await page.evaluate(
    key => localStorage.getItem(key) ?? '',
    DRAFTS_STORAGE_KEY,
  )
  expect(draftsBeforeExit).not.toContain('Hidden Local Draft')

  await page.getByTestId('back-button').click()
  await expect(page.getByTestId('draft-save-prompt')).toBeVisible()
  await expect(page.getByTestId('prompt-keep-draft-button')).toBeHidden()
  await page.getByTestId('prompt-discard-draft-button').click()
  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
})
