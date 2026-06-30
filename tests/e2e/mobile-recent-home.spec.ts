import { expect, test, type Page } from '@playwright/test'

interface MockCapacitorWindow {
  androidBridge?: unknown
  __emitCapacitorAppBackButton?: () => void
  __emitCapacitorAppPause?: () => void
  __emitCapacitorAppStateChange?: (isActive: boolean) => void
  __appListenerCount?: (eventName: string) => number
  __lastAndroidCreateOptions?: Record<string, unknown>
  Capacitor?: {
    PluginHeaders?: Array<{
      name: string
      methods: Array<{ name: string; rtype: string }>
    }>
    nativeCallback?: (
      pluginName: string,
      methodName: string,
      options: Record<string, unknown>,
      callback?: (data: unknown) => void,
    ) => Promise<string>
    nativePromise?: (
      pluginName: string,
      methodName: string,
      options?: Record<string, unknown>,
    ) => Promise<unknown>
  }
}

interface MockAndroidDocument {
  sourceUri: string
  displayName: string
  markdown: string
  canWrite?: boolean
  createResult?: {
    sourceUri: string
    displayName: string
    canWrite?: boolean
    persisted?: boolean
  }
  createError?: {
    code: string
    message: string
  }
  readError?: {
    code: string
    message: string
  }
  writeError?: {
    code: string
    message: string
  }
}

async function installTransientAndroidCreateMock(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as MockCapacitorWindow

    win.androidBridge = {}
    win.Capacitor = {
      ...(win.Capacitor ?? {}),
      PluginHeaders: [
        ...((win.Capacitor?.PluginHeaders ?? []).filter(header => header.name !== 'App')),
        {
          name: 'App',
          methods: [
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'exitApp', rtype: 'promise' },
          ],
        },
        {
          name: 'AndroidDocuments',
          methods: [
            { name: 'createMarkdownDocument', rtype: 'promise' },
            { name: 'openMarkdownDocument', rtype: 'promise' },
            { name: 'readMarkdownDocument', rtype: 'promise' },
            { name: 'writeMarkdownDocument', rtype: 'promise' },
          ],
        },
      ],
      nativeCallback(pluginName, methodName, options) {
        if (pluginName === 'App' && methodName === 'addListener') {
          return Promise.resolve(`app-listener-${String(options.eventName)}`)
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
      nativePromise(pluginName, methodName, options = {}) {
        if (pluginName === 'AndroidDocuments' && methodName === 'createMarkdownDocument') {
          const markdown = typeof options.markdown === 'string' ? options.markdown : ''
          const displayName =
            typeof options.suggestedName === 'string' ? options.suggestedName : 'Transient.md'
          return Promise.resolve({
            canceled: false,
            sourceUri: 'content://test/transient-document',
            displayName,
            providerName: 'Test Documents',
            pathHint: displayName,
            mimeType: 'text/markdown',
            markdown,
            canWrite: true,
            persisted: false,
          })
        }

        if (pluginName === 'App' && (methodName === 'removeListener' || methodName === 'exitApp')) {
          return Promise.resolve()
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
    }
  })
}

async function installAndroidAppMock(page: Page, androidDocument?: MockAndroidDocument) {
  await page.addInitScript((documentMock: MockAndroidDocument | null) => {
    const win = window as unknown as MockCapacitorWindow
    const appListeners = new Map<string, Array<(data: unknown) => void>>()
    const emitAppEvent = (eventName: string, data: unknown) => {
      for (const listener of appListeners.get(eventName) ?? []) {
        listener(data)
      }
    }

    win.androidBridge = {}
    win.__emitCapacitorAppBackButton = () => {
      emitAppEvent('backButton', { canGoBack: false })
    }
    win.__emitCapacitorAppPause = () => {
      emitAppEvent('pause', undefined)
    }
    win.__emitCapacitorAppStateChange = (isActive: boolean) => {
      emitAppEvent('appStateChange', { isActive })
    }
    win.__appListenerCount = (eventName: string) => appListeners.get(eventName)?.length ?? 0
    win.Capacitor = {
      ...(win.Capacitor ?? {}),
      PluginHeaders: [
        ...((win.Capacitor?.PluginHeaders ?? []).filter(header => header.name !== 'App')),
        {
          name: 'App',
          methods: [
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'exitApp', rtype: 'promise' },
          ],
        },
        ...(documentMock
          ? [
              {
                name: 'AndroidDocuments',
                methods: [
                  { name: 'createMarkdownDocument', rtype: 'promise' },
                  { name: 'openMarkdownDocument', rtype: 'promise' },
                  { name: 'readMarkdownDocument', rtype: 'promise' },
                  { name: 'writeMarkdownDocument', rtype: 'promise' },
                ],
              },
            ]
          : []),
      ],
      nativeCallback(pluginName, methodName, options, callback) {
        if (pluginName === 'App' && methodName === 'addListener') {
          if (typeof options.eventName === 'string' && callback) {
            const listeners = appListeners.get(options.eventName) ?? []
            listeners.push(callback)
            appListeners.set(options.eventName, listeners)
          }
          return Promise.resolve(`app-listener-${String(options.eventName)}`)
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
      nativePromise(pluginName, methodName, options = {}) {
        if (pluginName === 'App' && (methodName === 'removeListener' || methodName === 'exitApp')) {
          return Promise.resolve()
        }

        if (documentMock && pluginName === 'AndroidDocuments') {
          const documentResult = {
            canceled: false,
            sourceUri: documentMock.sourceUri,
            displayName: documentMock.displayName,
            providerName: 'Test Documents',
            pathHint: documentMock.displayName,
            mimeType: 'text/markdown',
            markdown: documentMock.markdown,
            canWrite: documentMock.canWrite ?? true,
            persisted: true,
          }

          if (methodName === 'createMarkdownDocument') {
            win.__lastAndroidCreateOptions = options
            if (documentMock.createError) {
              return Promise.reject(documentMock.createError)
            }

            const markdown = typeof options.markdown === 'string' ? options.markdown : ''
            const displayName =
              documentMock.createResult?.displayName ??
              (typeof options.suggestedName === 'string' ? options.suggestedName : 'Saved Copy.md')

            return Promise.resolve({
              canceled: false,
              sourceUri: documentMock.createResult?.sourceUri ?? 'content://test/saved-copy',
              displayName,
              providerName: 'Test Documents',
              pathHint: displayName,
              mimeType: 'text/markdown',
              markdown,
              canWrite: documentMock.createResult?.canWrite ?? true,
              persisted: documentMock.createResult?.persisted ?? true,
            })
          }

          if (methodName === 'openMarkdownDocument') {
            return Promise.resolve(documentResult)
          }

          if (
            methodName === 'readMarkdownDocument' &&
            options.sourceUri === documentMock.sourceUri
          ) {
            if (documentMock.readError) {
              return Promise.reject(documentMock.readError)
            }
            return Promise.resolve(documentResult)
          }

          if (
            methodName === 'writeMarkdownDocument' &&
            options.sourceUri === documentMock.sourceUri
          ) {
            if (documentMock.writeError) {
              return Promise.reject(documentMock.writeError)
            }
            return Promise.resolve({
              ...documentResult,
              markdown: undefined,
            })
          }
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
    }
  }, androidDocument ?? null)
}

test('creates a local draft from real editor input and returns it to the recent home', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('No recent Markdown files')).toBeVisible()
  await expect(page.getByTestId('open-file-button')).toBeVisible()
  await expect(page.getByTestId('new-document-button')).toBeVisible()

  await page.getByTestId('new-document-button').click()
  await expect(page.getByTestId('editor-host')).toBeVisible()
  await expect(page.getByTestId('back-button')).toHaveText('Back')

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Fresh mobile note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('hello from playwright')

  await expect
    .poll(async () => {
      return page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
    })
    .toContain('Fresh mobile note')

  await page.getByTestId('back-button').click()

  await expect(page.getByTestId('draft-save-prompt')).toBeVisible()
  await expect(page.getByText('Save this draft to your device?')).toBeVisible()
  await expect(page.getByTestId('prompt-save-to-device-button')).toBeHidden()
  await page.getByTestId('prompt-keep-draft-button').click()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('Continue writing')).toBeVisible()
  await expect(page.getByText('Fresh mobile note')).toBeVisible()
  await expect(page.getByText('No recent Markdown files')).toBeHidden()
  await expect(page.getByTestId('new-document-button')).toBeVisible()
})

test('flushes local draft edits when the WebView becomes hidden', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByTestId('new-document-button').click()
  await expect(page.getByTestId('editor-host')).toBeVisible()

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Pause flush note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('saved before the debounce timer fires')

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(100)

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('Pause flush note')
})

test('flushes local draft edits when the WebView page is hidden', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByTestId('new-document-button').click()
  await expect(page.getByTestId('editor-host')).toBeVisible()

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Pagehide flush note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('pagehide extension')
  await expect(page.getByTestId('editor-host')).toContainText('pagehide extension')

  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'))
  })
  await page.waitForTimeout(100)

  const draftsAfterPageHide = await page.evaluate(
    () => localStorage.getItem('marktext-for-android:drafts') ?? '',
  )
  expect(draftsAfterPageHide).toContain('pagehide extension')
})

test('flushes local draft edits on Capacitor app pause', async ({ page }) => {
  await installAndroidAppMock(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__appListenerCount?.('pause') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expect(page.getByTestId('editor-host')).toBeVisible()

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Capacitor pause note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('pause should save without waiting for debounce')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppPause?.()
  })
  await page.waitForTimeout(100)

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('Capacitor pause note')
})

test('flushes local draft edits on Capacitor app inactive', async ({ page }) => {
  await installAndroidAppMock(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__appListenerCount?.('appStateChange') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expect(page.getByTestId('editor-host')).toBeVisible()

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Capacitor inactive note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('inactive should save without waiting for debounce')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppStateChange?.(false)
  })
  await page.waitForTimeout(100)

  const draftsAfterInactive = await page.evaluate(
    () => localStorage.getItem('marktext-for-android:drafts') ?? '',
  )
  expect(draftsAfterInactive).toContain('Capacitor inactive note')
})

test('opens the draft exit prompt from the Android back button', async ({ page }) => {
  await installAndroidAppMock(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__appListenerCount?.('backButton') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expect(page.getByTestId('editor-host')).toBeVisible()

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Android back note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('system back should reuse the editor back flow')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppBackButton?.()
  })

  await expect(page.getByTestId('draft-save-prompt')).toBeVisible()
  await expect(page.getByText('Save this draft to your device?')).toBeVisible()

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('Android back note')
})

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
  await expect(page.getByTestId('editor-host')).toBeVisible()

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
  await expect(page.getByTestId('editor-host')).toBeVisible()

  await page.getByTestId('editor-host').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('unsaved recovery line')
  await expect(page.getByTestId('editor-host')).toContainText('unsaved recovery line')

  await page.getByTestId('back-button').click()

  await expect(page.getByTestId('editor-host')).toBeVisible()
  await expect(
    page.getByText(/Reopen this file from Android before saving again/),
  ).toBeVisible()

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('android-recovery:content://test/write-fails')
  expect(drafts).toContain('unsaved recovery line')
})

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
  await expect(page.getByTestId('editor-host')).toBeVisible()
  await page.getByTestId('editor-host').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('copy target text')

  await page.getByTestId('editor-menu-button').click()
  await expect(page.getByTestId('save-copy-button')).toBeVisible()
  const menuButtonBox = await page.getByTestId('editor-menu-button').boundingBox()
  const menuBox = await page.locator('.editor-menu').boundingBox()
  expect(menuButtonBox).not.toBeNull()
  expect(menuBox).not.toBeNull()
  expect(
    Math.abs(menuBox!.x + menuBox!.width - (menuButtonBox!.x + menuButtonBox!.width)),
  ).toBeLessThanOrEqual(2)
  expect(menuBox!.width).toBeLessThanOrEqual(150)
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
  await expect(page.getByTestId('editor-host')).toBeVisible()

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
  await expect(page.getByTestId('editor-host')).toBeVisible()

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
