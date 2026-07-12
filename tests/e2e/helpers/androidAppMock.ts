import type { Locator, Page } from '@playwright/test'

export interface MockCapacitorWindow {
  androidBridge?: unknown
  __emitCapacitorAppBackButton?: () => void
  __emitCapacitorAppPause?: () => void
  __emitCapacitorAppStateChange?: (isActive: boolean) => void
  __emitAndroidOpenWithDocument?: (event: MockAndroidOpenWithEvent) => void
  __emitAndroidSelectionContextRequest?: () => void
  __appListenerCount?: (eventName: string) => number
  __androidDocumentListenerCount?: (eventName: string) => number
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

export interface MockAndroidOpenWithEvent {
  document?: {
    sourceUri: string
    displayName: string
    providerName?: string
    pathHint?: string
    mimeType?: string
    markdown: string
    canWrite?: boolean
    persisted?: boolean
  }
  errorCode?: string
  message?: string
}

export interface MockAndroidDocument {
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
  renameResult?: {
    sourceUri: string
    displayName: string
    canWrite?: boolean
    persisted?: boolean
  }
}

interface MockAndroidAppOptions {
  pendingOpenWithEvent?: MockAndroidOpenWithEvent
}

export async function longPress(page: Page, target: Locator) {
  const box = await target.boundingBox()
  if (!box) {
    throw new Error('Long-press target is not visible')
  }

  const client = await page.context().newCDPSession(page)
  const touchPoint = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }
  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [touchPoint],
    })
    await page.waitForTimeout(700)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
  } finally {
    await client.detach()
  }
}

export async function installTransientAndroidCreateMock(page: Page) {
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
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'createMarkdownDocument', rtype: 'promise' },
            { name: 'openMarkdownDocument', rtype: 'promise' },
            { name: 'readMarkdownDocument', rtype: 'promise' },
            { name: 'renameMarkdownDocument', rtype: 'promise' },
            { name: 'writeMarkdownDocument', rtype: 'promise' },
          ],
        },
      ],
      nativeCallback(pluginName, methodName, options) {
        if (pluginName === 'App' && methodName === 'addListener') {
          return Promise.resolve(`app-listener-${String(options.eventName)}`)
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'addListener') {
          return Promise.resolve(`android-documents-listener-${String(options.eventName)}`)
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

        if (pluginName === 'AndroidDocuments' && methodName === 'removeListener') {
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

export async function installAndroidAppMock(
  page: Page,
  androidDocument?: MockAndroidDocument,
  options: MockAndroidAppOptions = {},
) {
  await page.addInitScript(({ documentMock, mockOptions }) => {
    const win = window as unknown as MockCapacitorWindow
    const appListeners = new Map<string, Array<(data: unknown) => void>>()
    const androidDocumentListeners = new Map<string, Array<(data: unknown) => void>>()
    const androidSelectionListeners = new Map<string, Array<(data: unknown) => void>>()
    let pendingOpenWithEvent = mockOptions.pendingOpenWithEvent ?? null
    const emitAppEvent = (eventName: string, data: unknown) => {
      for (const listener of appListeners.get(eventName) ?? []) {
        listener(data)
      }
    }
    const emitAndroidDocumentEvent = (eventName: string, data: unknown) => {
      for (const listener of androidDocumentListeners.get(eventName) ?? []) {
        listener(data)
      }
    }
    const emitAndroidSelectionEvent = (eventName: string, data: unknown) => {
      for (const listener of androidSelectionListeners.get(eventName) ?? []) {
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
    win.__emitAndroidOpenWithDocument = (event: MockAndroidOpenWithEvent) => {
      emitAndroidDocumentEvent('openWithDocument', event)
    }
    // Simulates MainActivity.notifySelectionContextRequest: the suppressed
    // native floating ActionMode started (long-press / double-tap select).
    win.__emitAndroidSelectionContextRequest = () => {
      emitAndroidSelectionEvent('selectionContextRequest', {})
    }
    win.__appListenerCount = (eventName: string) => appListeners.get(eventName)?.length ?? 0
    win.__androidDocumentListenerCount = (eventName: string) =>
      androidDocumentListeners.get(eventName)?.length ?? 0
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
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'createMarkdownDocument', rtype: 'promise' },
            { name: 'openMarkdownDocument', rtype: 'promise' },
            { name: 'readMarkdownDocument', rtype: 'promise' },
            { name: 'renameMarkdownDocument', rtype: 'promise' },
            { name: 'writeMarkdownDocument', rtype: 'promise' },
          ],
        },
        {
          name: 'AndroidSelection',
          methods: [
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'setEditorSelectionActionModeSuppressed', rtype: 'promise' },
            { name: 'getEditorSelectionActionModeState', rtype: 'promise' },
            { name: 'finishEditorSelectionActionMode', rtype: 'promise' },
            { name: 'performNativeSelectAll', rtype: 'promise' },
            { name: 'readClipboardText', rtype: 'promise' },
            { name: 'writeClipboardText', rtype: 'promise' },
          ],
        },
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

        if (pluginName === 'AndroidSelection' && methodName === 'addListener') {
          if (typeof options.eventName === 'string' && callback) {
            const listeners = androidSelectionListeners.get(options.eventName) ?? []
            listeners.push(callback)
            androidSelectionListeners.set(options.eventName, listeners)
          }
          return Promise.resolve(`android-selection-listener-${String(options.eventName)}`)
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'addListener') {
          if (typeof options.eventName === 'string' && callback) {
            const listeners = androidDocumentListeners.get(options.eventName) ?? []
            listeners.push(callback)
            androidDocumentListeners.set(options.eventName, listeners)
            if (options.eventName === 'openWithDocument' && pendingOpenWithEvent) {
              window.setTimeout(() => {
                if (pendingOpenWithEvent) {
                  callback(pendingOpenWithEvent)
                  pendingOpenWithEvent = null
                }
              }, 0)
            }
          }
          return Promise.resolve(`android-documents-listener-${String(options.eventName)}`)
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

        if (pluginName === 'AndroidDocuments' && methodName === 'removeListener') {
          return Promise.resolve()
        }

        if (pluginName === 'AndroidSelection') {
          if (methodName === 'removeListener') {
            return Promise.resolve()
          }

          if (
            methodName === 'setEditorSelectionActionModeSuppressed' ||
            methodName === 'getEditorSelectionActionModeState'
          ) {
            return Promise.resolve({
              suppressed: Boolean(options.suppressed),
              hookInstalled: true,
              suppressedCreateCount: 0,
              suppressedStartCount: 0,
              allowedCreateCount: 0,
              allowedStartCount: 0,
              finishCount: 0,
              nativeEvents: '',
            })
          }

          if (methodName === 'finishEditorSelectionActionMode') {
            return Promise.resolve({ finished: false })
          }

          // Fall through to Muya's JS select-all: no native ActionMode exists.
          if (methodName === 'performNativeSelectAll') {
            return Promise.resolve({ performed: false })
          }

          // Bridge the mock clipboard onto the page clipboard so the state
          // table can be exercised with real clipboard content.
          if (methodName === 'readClipboardText') {
            return navigator.clipboard.readText().then(
              text => ({ text, available: text.length > 0 }),
              () => ({ text: '', available: false }),
            )
          }

          if (methodName === 'writeClipboardText') {
            const text = typeof options.text === 'string' ? options.text : ''
            return navigator.clipboard.writeText(text).then(
              () => ({ written: true }),
              () => ({ written: false }),
            )
          }
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

          if (
            methodName === 'renameMarkdownDocument' &&
            options.sourceUri === documentMock.sourceUri &&
            documentMock.renameResult
          ) {
            return Promise.resolve({
              sourceUri: documentMock.renameResult.sourceUri,
              displayName: documentMock.renameResult.displayName,
              providerName: 'Test Documents',
              pathHint: documentMock.renameResult.displayName,
              canWrite: documentMock.renameResult.canWrite ?? true,
              persisted: documentMock.renameResult.persisted ?? true,
            })
          }
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
    }
  }, { documentMock: androidDocument ?? null, mockOptions: options })
}
