import { expect, test } from '@playwright/test'
import {
  installAndroidAppMock,
  installTransientAndroidCreateMock,
  type MockCapacitorWindow,
} from './helpers/androidAppMock'
import { expectEditorReady } from './helpers/editor'

test.describe.configure({ timeout: 60000 })

test('saves a writable Android document as a copy and switches to the new document', async ({
  page,
}) => {
  const now = '2026-06-29T06:30:00.000Z'
  const document = {
    sourceUri: 'content://test/original-save-copy',
    displayName: 'Original Save Copy.md',
    markdown: '# Original Save Copy\n\nInitial text.',
    createResult: {
      sourceUri: 'content://test/copied-save-copy',
      displayName: 'Copied Save Copy.md',
    },
  }

  await installAndroidAppMock(page, document)
  await page.goto('/')
  await page.evaluate(({ now, document }) => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:recent-documents',
      JSON.stringify([
        {
          id: `android-document:${document.sourceUri}`,
          kind: 'android-document',
          displayName: document.displayName,
          title: 'Original Save Copy',
          sourceUri: document.sourceUri,
          providerName: 'Test Documents',
          pathHint: document.displayName,
          markdownPreview: null,
          updatedAt: now,
          lastOpenedAt: now,
          lastSavedAt: null,
          autosaveState: 'clean',
          canWrite: true,
        },
        {
          id: 'android-document:content://test/existing-save-copy',
          kind: 'android-document',
          displayName: 'Original Save Copy copy.md',
          title: 'Existing Save Copy',
          sourceUri: 'content://test/existing-save-copy',
          providerName: 'Test Documents',
          pathHint: 'Original Save Copy copy.md',
          markdownPreview: null,
          updatedAt: '2026-06-29T06:00:00.000Z',
          lastOpenedAt: '2026-06-29T06:00:00.000Z',
          lastSavedAt: '2026-06-29T06:00:00.000Z',
          autosaveState: 'clean',
          canWrite: true,
        },
      ]),
    )
  }, { now, document })
  await page.reload()

  await page.getByRole('button', { name: /Original Save Copy/ }).click()
  await expectEditorReady(page)
  await page.getByTestId('editor-host').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('copy target text')

  await page.getByTestId('editor-menu-button').click()
  const actionSheet = page.getByTestId('editor-action-sheet')
  await expect(actionSheet).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Document actions' })).toBeVisible()
  await expect(page.getByTestId('save-copy-button')).toBeVisible()
  const viewport = page.viewportSize()
  const sheetBox = await actionSheet.boundingBox()
  const panelBox = await page.locator('.editor-action-panel').boundingBox()
  expect(viewport).not.toBeNull()
  expect(sheetBox).not.toBeNull()
  expect(panelBox).not.toBeNull()
  expect(sheetBox!.width).toBeGreaterThanOrEqual(viewport!.width - 2)
  expect(sheetBox!.height).toBeGreaterThanOrEqual(viewport!.height - 2)
  expect(panelBox!.y).toBeGreaterThan(viewport!.height / 2)
  expect(panelBox!.y + panelBox!.height).toBeGreaterThanOrEqual(viewport!.height - 2)
  await page.getByTestId('save-copy-button').click()

  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  const createOptions = await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    return win.__lastAndroidCreateOptions
  })
  expect(createOptions?.suggestedName).toBe('Original Save Copy copy 2.md')

  const storage = await page.evaluate(() => ({
    drafts: localStorage.getItem('marktext-for-android:drafts') ?? '',
    recentDocuments: localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  }))
  expect(storage.recentDocuments).toContain('content://test/copied-save-copy')
  expect(storage.recentDocuments).toContain('Copied Save Copy.md')
  expect(storage.drafts).not.toContain('android-recovery:content://test/original-save-copy')
})

test('increments the save-copy name when the current Android document is already a copy', async ({
  page,
}) => {
  const now = '2026-06-29T06:35:00.000Z'
  const document = {
    sourceUri: 'content://test/original-copy-name',
    displayName: 'Original Copy Name copy.md',
    markdown: 'Initial text without a heading.',
    createResult: {
      sourceUri: 'content://test/original-copy-name-copy-3',
      displayName: 'Original Copy Name copy 3.md',
    },
  }

  await installAndroidAppMock(page, document)
  await page.goto('/')
  await page.evaluate(({ now, document }) => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:recent-documents',
      JSON.stringify([
        {
          id: `android-document:${document.sourceUri}`,
          kind: 'android-document',
          displayName: document.displayName,
          title: 'Original Copy Name copy',
          sourceUri: document.sourceUri,
          providerName: 'Test Documents',
          pathHint: document.displayName,
          markdownPreview: null,
          updatedAt: now,
          lastOpenedAt: now,
          lastSavedAt: null,
          autosaveState: 'clean',
          canWrite: true,
        },
        {
          id: 'android-document:content://test/original-copy-name-copy-2',
          kind: 'android-document',
          displayName: 'Original Copy Name copy 2.md',
          title: 'Original Copy Name copy 2',
          sourceUri: 'content://test/original-copy-name-copy-2',
          providerName: 'Test Documents',
          pathHint: 'Original Copy Name copy 2.md',
          markdownPreview: null,
          updatedAt: '2026-06-29T06:00:00.000Z',
          lastOpenedAt: '2026-06-29T06:00:00.000Z',
          lastSavedAt: '2026-06-29T06:00:00.000Z',
          autosaveState: 'clean',
          canWrite: true,
        },
      ]),
    )
  }, { now, document })
  await page.reload()

  await page.getByRole('button', { name: /Original Copy Name copy/ }).first().click()
  await expectEditorReady(page)

  await page.getByTestId('editor-menu-button').click()
  await page.getByTestId('save-copy-button').click()

  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  const createOptions = await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    return win.__lastAndroidCreateOptions
  })
  expect(createOptions?.suggestedName).toBe('Original Copy Name copy 3.md')
})

test('saves a read-only Android document as a writable copy', async ({ page }) => {
  const now = '2026-06-29T06:40:00.000Z'
  const document = {
    sourceUri: 'content://test/read-only-original',
    displayName: 'Read Only Original.md',
    markdown: '# Read Only Original\n\nInitial text.',
    canWrite: false,
    createResult: {
      sourceUri: 'content://test/read-only-copy',
      displayName: 'Read Only Copy.md',
      canWrite: true,
    },
  }

  await installAndroidAppMock(page, document)
  await page.goto('/')
  await page.evaluate(({ now, document }) => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:recent-documents',
      JSON.stringify([
        {
          id: `android-document:${document.sourceUri}`,
          kind: 'android-document',
          displayName: document.displayName,
          title: 'Read Only Original',
          sourceUri: document.sourceUri,
          providerName: 'Test Documents',
          pathHint: document.displayName,
          markdownPreview: null,
          updatedAt: now,
          lastOpenedAt: now,
          lastSavedAt: null,
          autosaveState: 'clean',
          canWrite: false,
        },
      ]),
    )
  }, { now, document })
  await page.reload()

  await page.getByRole('button', { name: /Read Only Original/ }).click()
  await expect(page.getByText('Read only', { exact: true })).toBeVisible()
  await expectEditorReady(page)
  await page.getByTestId('editor-host').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('saved through copy')

  await page.getByTestId('editor-menu-button').click()
  await page.getByTestId('save-copy-button').click()

  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await page.getByTestId('back-button').click()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('Read Only Original').first()).toBeVisible()

  const recentDocuments = await page.evaluate(
    () => localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  )
  expect(recentDocuments).toContain('content://test/read-only-copy')
  expect(recentDocuments).toContain('Read Only Copy.md')
  expect(recentDocuments).toContain('"canWrite":true')
})

test('keeps the local draft when Android document access is not persisted', async ({ page }) => {
  await installTransientAndroidCreateMock(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Transient grant note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('this should stay recoverable as a local draft')

  await page.getByTestId('back-button').click()
  await expect(page.getByTestId('draft-save-prompt')).toBeVisible()
  await expect(page.getByTestId('prompt-save-to-device-button')).toBeVisible()
  await page.getByTestId('prompt-save-to-device-button').click()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(
    page.getByText('Saved to device. Kept local draft because Android did not grant long-term access.'),
  ).toBeVisible()
  await expect(page.getByText('Transient grant note')).toBeVisible()

  const storage = await page.evaluate(() => ({
    drafts: localStorage.getItem('marktext-for-android:drafts') ?? '',
    androidRecentDocuments: localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  }))
  expect(storage.drafts).toContain('Transient grant note')
  expect(storage.androidRecentDocuments).not.toContain('content://test/transient-document')
})

test('keeps the Android open-file action nonfatal in the browser shell', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByTestId('open-file-button').click()

  await expect(page.getByText('Open Markdown files from the Android app build.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByTestId('new-document-button')).toBeVisible()
})
