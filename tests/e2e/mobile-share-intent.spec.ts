import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 60000 })

interface MockCapacitorWindow {
  androidBridge?: unknown
  __emitAndroidShareDocument?: (event: MockAndroidShareEvent) => void
  __androidDocumentListenerCount?: (eventName: string) => number
  __lastAndroidShareOptions?: Record<string, unknown>
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

interface MockAndroidShareEvent {
  document?: {
    sourceUri: string | null
    displayName: string
    providerName?: string
    pathHint?: string
    mimeType?: string
    markdown: string
    canWrite?: boolean
    persisted?: boolean
    shareKind?: 'text' | 'stream'
  }
  errorCode?: string
  message?: string
}

interface MockAndroidShareOptions {
  pendingShareEvent?: MockAndroidShareEvent
}

async function expectEditorReady(page: Page) {
  await expect(page.getByTestId('editor-host')).toBeVisible({ timeout: 30000 })
}

async function installAndroidShareAppMock(
  page: Page,
  options: MockAndroidShareOptions = {},
) {
  await page.addInitScript(({ mockOptions }) => {
    const win = window as unknown as MockCapacitorWindow
    const appListeners = new Map<string, Array<(data: unknown) => void>>()
    const androidDocumentListeners = new Map<string, Array<(data: unknown) => void>>()
    let pendingShareEvent = mockOptions.pendingShareEvent ?? null

    const emitAndroidDocumentEvent = (eventName: string, data: unknown) => {
      for (const listener of androidDocumentListeners.get(eventName) ?? []) {
        listener(data)
      }
    }

    win.androidBridge = {}
    win.__emitAndroidShareDocument = (event: MockAndroidShareEvent) => {
      emitAndroidDocumentEvent('shareDocument', event)
    }
    win.__androidDocumentListenerCount = (eventName: string) =>
      androidDocumentListeners.get(eventName)?.length ?? 0
    win.Capacitor = {
      ...(win.Capacitor ?? {}),
      PluginHeaders: [
        ...((win.Capacitor?.PluginHeaders ?? []).filter(
          header => header.name !== 'App' && header.name !== 'AndroidDocuments',
        )),
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
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'createMarkdownDocument', rtype: 'promise' },
            { name: 'openMarkdownDocument', rtype: 'promise' },
            { name: 'readMarkdownDocument', rtype: 'promise' },
            { name: 'shareMarkdownDocument', rtype: 'promise' },
            { name: 'writeMarkdownDocument', rtype: 'promise' },
          ],
        },
      ],
      nativeCallback(pluginName, methodName, callbackOptions, callback) {
        if (pluginName === 'App' && methodName === 'addListener') {
          if (typeof callbackOptions.eventName === 'string' && callback) {
            const listeners = appListeners.get(callbackOptions.eventName) ?? []
            listeners.push(callback)
            appListeners.set(callbackOptions.eventName, listeners)
          }
          return Promise.resolve(`app-listener-${String(callbackOptions.eventName)}`)
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'addListener') {
          if (typeof callbackOptions.eventName === 'string' && callback) {
            const listeners = androidDocumentListeners.get(callbackOptions.eventName) ?? []
            listeners.push(callback)
            androidDocumentListeners.set(callbackOptions.eventName, listeners)
            if (callbackOptions.eventName === 'shareDocument' && pendingShareEvent) {
              window.setTimeout(() => {
                if (pendingShareEvent) {
                  callback(pendingShareEvent)
                  pendingShareEvent = null
                }
              }, 0)
            }
          }
          return Promise.resolve(`android-documents-listener-${String(callbackOptions.eventName)}`)
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
      nativePromise(pluginName, methodName, promiseOptions = {}) {
        if (pluginName === 'App' && (methodName === 'removeListener' || methodName === 'exitApp')) {
          return Promise.resolve()
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'removeListener') {
          return Promise.resolve()
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'shareMarkdownDocument') {
          win.__lastAndroidShareOptions = promiseOptions
          const markdown = typeof promiseOptions.markdown === 'string' ? promiseOptions.markdown : ''
          const displayName =
            typeof promiseOptions.suggestedName === 'string'
              ? promiseOptions.suggestedName
              : 'Shared Markdown.md'
          return Promise.resolve({
            displayName,
            mimeType: 'text/markdown',
            bytes: new TextEncoder().encode(markdown).length,
            imageCount: 0,
            sharedFileCount: 1,
          })
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
    }
  }, { mockOptions: options })
}

test('imports shared Android text as a local draft on app launch', async ({ page }) => {
  await installAndroidShareAppMock(page, {
    pendingShareEvent: {
      document: {
        sourceUri: null,
        displayName: 'Shared From QQ.md',
        providerName: 'Android share',
        pathHint: 'Shared From QQ.md',
        mimeType: 'text/plain',
        markdown: '# Shared From QQ\n\nreceived as plain text',
        canWrite: false,
        persisted: false,
        shareKind: 'text',
      },
    },
  })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')

  await expectEditorReady(page)
  await expect(page.getByTestId('editor-host')).toContainText('Shared From QQ')
  await expect(page.getByText('Imported shared text as a local draft.')).toBeVisible()

  const storage = await page.evaluate(() => ({
    drafts: localStorage.getItem('marktext-for-android:drafts') ?? '',
    recentDocuments: localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  }))
  expect(storage.drafts).toContain('received as plain text')
  expect(storage.recentDocuments).not.toContain('Shared From QQ')
})

test('opens a shared Markdown file with temporary Android access', async ({ page }) => {
  await installAndroidShareAppMock(page, {
    pendingShareEvent: {
      document: {
        sourceUri: 'content://test/share-stream',
        displayName: 'Shared Stream.md',
        providerName: 'Test Documents',
        pathHint: 'Shared Stream.md',
        mimeType: 'text/markdown',
        markdown: '# Shared Stream\n\nreceived as a content URI',
        canWrite: false,
        persisted: false,
        shareKind: 'stream',
      },
    },
  })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')

  await expectEditorReady(page)
  await expect(page.getByTestId('editor-host')).toContainText('Shared Stream')
  await expect(page.getByText('Opened temporarily')).toBeVisible()

  const recentDocuments = await page.evaluate(
    () => localStorage.getItem('marktext-for-android:recent-documents') ?? '',
  )
  expect(recentDocuments).not.toContain('content://test/share-stream')
})

test('shares the current draft as a Markdown file through Android', async ({ page }) => {
  await installAndroidShareAppMock(page)
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__androidDocumentListenerCount?.('shareDocument') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Share Out Note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('send to QQ or another Android target')
  await expect(page.getByTestId('editor-host')).toContainText('send to QQ')
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? ''))
    .toContain('Share Out Note')

  await page.getByTestId('editor-menu-button').click()
  await expect(page.getByTestId('share-document-button')).toBeVisible()
  await page.getByTestId('share-document-button').click()

  await expect(page.getByText('Share sheet opened')).toBeVisible()
  const shareOptions = await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    return win.__lastAndroidShareOptions
  })
  expect(shareOptions?.suggestedName).toBe('Share Out Note.md')
  expect(shareOptions?.markdown).toContain('send to QQ or another Android target')
})

test('preserves an active local draft before opening a warm Android share', async ({ page }) => {
  await installAndroidShareAppMock(page)
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__androidDocumentListenerCount?.('shareDocument') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Draft Before Share')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('preserve this draft')
  await expect(page.getByTestId('editor-host')).toContainText('preserve this draft')
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? ''))
    .toContain('Draft Before Share')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitAndroidShareDocument?.({
      document: {
        sourceUri: null,
        displayName: 'Warm Share.md',
        providerName: 'Android share',
        pathHint: 'Warm Share.md',
        mimeType: 'text/plain',
        markdown: '# Warm Share\n\nincoming while editing',
        canWrite: false,
        persisted: false,
        shareKind: 'text',
      },
    })
  })

  await expect(page.getByTestId('editor-host')).toContainText('Warm Share')
  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('Draft Before Share')
  expect(drafts).toContain('Warm Share')
})

test('shows a safe notice when an Android share is rejected', async ({ page }) => {
  await installAndroidShareAppMock(page, {
    pendingShareEvent: {
      errorCode: 'UNSUPPORTED_SHARE_DOCUMENT',
      message: 'Share a Markdown file',
    },
  })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('Share Markdown text or a Markdown file.')).toBeVisible()
  await expect(page.getByTestId('editor-host')).toBeHidden()
})

test('uses share-specific copy for unsupported shared file URIs', async ({ page }) => {
  await installAndroidShareAppMock(page, {
    pendingShareEvent: {
      errorCode: 'INVALID_SHARE_SOURCE_URI',
      message: 'This Android share did not provide a supported file URI',
    },
  })
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('This Android share did not provide a supported file URI.')).toBeVisible()
  await expect(page.getByText('This recent file can no longer be opened.')).toBeHidden()
})
