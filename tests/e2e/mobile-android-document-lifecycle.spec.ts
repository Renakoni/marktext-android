import { expect, test } from '@playwright/test'
import {
  installAndroidAppMock,
  type MockCapacitorWindow,
} from './helpers/androidAppMock'
import { expectEditorReady } from './helpers/editor'

test.describe.configure({ timeout: 60000 })

test('returns a clean Android document to recent home from the Android back button', async ({
  page,
}) => {
  const now = '2026-06-29T06:00:00.000Z'
  const document = {
    sourceUri: 'content://test/clean-document',
    displayName: 'Clean Android Note.md',
    markdown: '# Clean Android Note\n\nNo edits yet.',
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
          title: 'Clean Android Note',
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
      ]),
    )
  }, { now, document })
  await page.reload()
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__appListenerCount?.('backButton') ?? 0) > 0
  })

  await page.getByRole('button', { name: /Clean Android Note/ }).click()
  await expectEditorReady(page)

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppBackButton?.()
  })

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByTestId('editor-host')).toBeHidden()
  await expect(page.getByText('Clean Android Note')).toBeVisible()
})

test('keeps a stale Android recent file on home with a recovery notice', async ({ page }) => {
  const now = '2026-06-29T06:10:00.000Z'
  const document = {
    sourceUri: 'content://test/missing-document',
    displayName: 'Missing Android Note.md',
    markdown: '# Missing Android Note\n\nThis provider will reject reads.',
    readError: {
      code: 'DOCUMENT_NOT_FOUND',
      message: 'missing',
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
          title: 'Missing Android Note',
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
      ]),
    )
  }, { now, document })
  await page.reload()

  await page.getByRole('button', { name: /Missing Android Note/ }).click()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByTestId('editor-host')).toBeHidden()
  await expect(
    page.getByText('This file was moved or deleted. Open it again from Android.'),
  ).toBeVisible()
  await expect(page.getByText('Missing Android Note')).toBeVisible()
})

test('opens a Markdown document delivered by Android open-with on app launch', async ({
  page,
}) => {
  await installAndroidAppMock(page, undefined, {
    pendingOpenWithEvent: {
      document: {
        sourceUri: 'content://test/open-with-cold',
        displayName: 'Open With Cold.md',
        providerName: 'Test Documents',
        pathHint: 'Open With Cold.md',
        mimeType: 'text/markdown',
        markdown: '# Open With Cold\n\nfrom Android chooser',
        canWrite: false,
        persisted: true,
      },
    },
  })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')

  await expectEditorReady(page)
  await expect(page.getByTestId('editor-host')).toContainText('Open With Cold')
  await expect(page.getByText('Read only', { exact: true })).toBeVisible()

  const recentDocuments = await page.evaluate(
    () => localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  )
  expect(recentDocuments).toContain('content://test/open-with-cold')
  expect(recentDocuments).toContain('Open With Cold.md')
})

test('opens a warm Android open-with document after preserving the current draft', async ({
  page,
}) => {
  await installAndroidAppMock(page)
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__androidDocumentListenerCount?.('openWithDocument') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Draft Before Open With')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('preserve this local draft before switching')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitAndroidOpenWithDocument?.({
      document: {
        sourceUri: 'content://test/open-with-warm-transient',
        displayName: 'Open With Warm.md',
        providerName: 'Test Documents',
        pathHint: 'Open With Warm.md',
        mimeType: 'text/markdown',
        markdown: '# Open With Warm\n\nopened while app was alive',
        canWrite: false,
        persisted: false,
      },
    })
  })

  await expect(page.getByTestId('editor-host')).toContainText('Open With Warm')
  await expect(page.getByText('Opened temporarily')).toBeVisible()

  const storage = await page.evaluate(() => ({
    drafts: localStorage.getItem('marktext-for-android:drafts') ?? '',
    recentDocuments: localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  }))
  expect(storage.drafts).toContain('Draft Before Open With')
  expect(storage.recentDocuments).not.toContain('content://test/open-with-warm-transient')
})

test('shows a safe home notice when Android open-with rejects a non-Markdown file', async ({
  page,
}) => {
  await installAndroidAppMock(page, undefined, {
    pendingOpenWithEvent: {
      errorCode: 'UNSUPPORTED_OPEN_WITH_DOCUMENT',
      message: 'Open a Markdown document',
    },
  })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByTestId('editor-host')).toBeHidden()
  await expect(page.getByText('Open a Markdown file.')).toBeVisible()
})

test('keeps dirty Android edits in the editor and in a recovery draft when save fails', async ({
  page,
}) => {
  const now = '2026-06-29T06:20:00.000Z'
  const document = {
    sourceUri: 'content://test/write-fails',
    displayName: 'Write Fails.md',
    markdown: '# Write Fails\n\nInitial text.',
    writeError: {
      code: 'DOCUMENT_PERMISSION_LOST',
      message: 'permission lost',
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
          title: 'Write Fails',
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
      ]),
    )
  }, { now, document })
  await page.reload()

  await page.getByRole('button', { name: /Write Fails/ }).click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('unsaved recovery line')
  await expect(page.getByTestId('editor-host')).toContainText('unsaved recovery line')

  await page.getByTestId('back-button').click()

  await expectEditorReady(page)
  await expect(page.getByTestId('android-exit-prompt')).toBeVisible()
  await expect(
    page.getByText(/Reopen this file from Android before saving again/),
  ).toBeVisible()
  await page.getByTestId('prompt-keep-recovery-button').click()
  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('Unsaved changes were kept as a recovery draft.')).toBeVisible()

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('android-recovery:content://test/write-fails')
  expect(drafts).toContain('unsaved recovery line')
})

test('offers save-copy when leaving a dirty read-only Android document', async ({ page }) => {
  const now = '2026-06-29T06:25:00.000Z'
  const document = {
    sourceUri: 'content://test/read-only-exit',
    displayName: 'Read Only Exit.md',
    markdown: '# Read Only Exit\n\nInitial text.',
    canWrite: false,
    createResult: {
      sourceUri: 'content://test/read-only-exit-copy',
      displayName: 'Read Only Exit copy.md',
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
          title: 'Read Only Exit',
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

  await page.getByRole('button', { name: /Read Only Exit/ }).click()
  await expect(page.getByText('Read only', { exact: true })).toBeVisible()
  await expectEditorReady(page)
  await page.getByTestId('editor-host').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('exit through save copy')

  await page.getByTestId('back-button').click()
  await expect(page.getByTestId('android-exit-prompt')).toBeVisible()
  await expect(page.getByText('This file cannot be saved directly.')).toBeVisible()
  await page.getByTestId('prompt-save-copy-button').click()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('Read Only Exit').first()).toBeVisible()

  const storage = await page.evaluate(() => ({
    createOptions: (window as unknown as MockCapacitorWindow).__lastAndroidCreateOptions,
    recentDocuments: localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  }))
  expect(storage.createOptions?.suggestedName).toBe('Read Only Exit copy.md')
  expect(storage.recentDocuments).toContain('content://test/read-only-exit-copy')
  expect(storage.recentDocuments).toContain('Read Only Exit copy.md')
})

test('keeps temporary open-with edits as a recovery draft when leaving', async ({ page }) => {
  await installAndroidAppMock(page, undefined, {
    pendingOpenWithEvent: {
      document: {
        sourceUri: 'content://test/open-with-temporary-exit',
        displayName: 'Temporary Exit.md',
        providerName: 'Test Documents',
        pathHint: 'Temporary Exit.md',
        mimeType: 'text/markdown',
        markdown: '# Temporary Exit\n\nInitial text.',
        canWrite: false,
        persisted: false,
      },
    },
  })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')

  await expectEditorReady(page)
  await expect(page.getByText('Opened temporarily')).toBeVisible()
  await page.getByTestId('editor-host').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('temporary open-with edit')

  await page.getByTestId('back-button').click()
  await expect(page.getByTestId('android-exit-prompt')).toBeVisible()
  await page.getByTestId('prompt-keep-recovery-button').click()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('Unsaved changes were kept as a recovery draft.')).toBeVisible()

  const storage = await page.evaluate(() => ({
    drafts: localStorage.getItem('marktext-for-android:drafts') ?? '',
    recentDocuments: localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  }))
  expect(storage.drafts).toContain('android-recovery:content://test/open-with-temporary-exit')
  expect(storage.drafts).toContain('temporary open-with edit')
  expect(storage.recentDocuments).not.toContain('content://test/open-with-temporary-exit')
})
