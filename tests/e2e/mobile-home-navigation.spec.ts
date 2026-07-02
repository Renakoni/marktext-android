import { expect, test, type Page } from '@playwright/test'

interface MockCapacitorWindow {
  __emitCapacitorAppBackButton?: () => void
  __appExitCount?: () => number
  __appListenerCount?: (eventName: string) => number
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

async function installAndroidBackButtonMock(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as MockCapacitorWindow
    const appListeners = new Map<string, Array<(data: unknown) => void>>()
    let appExitCount = 0

    win.__emitCapacitorAppBackButton = () => {
      for (const listener of appListeners.get('backButton') ?? []) {
        listener({ canGoBack: false })
      }
    }
    win.__appExitCount = () => appExitCount
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
      nativePromise(pluginName, methodName) {
        if (pluginName === 'App' && methodName === 'exitApp') {
          appExitCount += 1
          return Promise.resolve()
        }

        if (pluginName === 'App' && methodName === 'removeListener') {
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

test('switches between document home and the settings about screen', async ({ page }) => {
  await page.route('https://api.github.com/repos/Renakoni/marktext-android/releases/latest', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tag_name: 'v0.1.0',
        html_url: 'https://github.com/Renakoni/marktext-android/releases/tag/v0.1.0',
      }),
    }),
  )
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await expect(page.getByTestId('documents-screen')).toBeVisible()
  await expect(page.getByTestId('new-document-button')).toBeVisible()
  await expect(page.getByTestId('bottom-nav-documents')).toHaveAttribute('aria-current', 'page')

  await page.getByTestId('bottom-nav-settings').click()

  await expect(page.getByTestId('settings-screen')).toBeVisible()
  await expect(page.getByTestId('settings-index')).toBeVisible()
  await expect(page.getByTestId('new-document-button')).toBeHidden()
  await expect(page.getByTestId('bottom-nav-settings')).toHaveAttribute('aria-current', 'page')

  await page.getByTestId('settings-entry-about').click()
  await expect(page.getByTestId('settings-title')).toContainText('About MarkText')
  await expect(page.getByTestId('settings-about-app')).toBeVisible()
  await expect(page.getByTestId('settings-about-version')).toBeVisible()

  await page.getByTestId('settings-check-updates').click()
  await expect(page.getByTestId('settings-check-updates')).toContainText(
    'Update available: v0.1.0',
  )
  await expect(page.getByTestId('settings-latest-release')).toHaveAttribute(
    'href',
    'https://github.com/Renakoni/marktext-android/releases/tag/v0.1.0',
  )

  await page.getByTestId('settings-detail-back').click()
  await expect(page.getByTestId('settings-index')).toBeVisible()

  await page.getByTestId('settings-entry-references').click()
  await expect(page.getByTestId('settings-title')).toContainText('References')
  await expect(page.getByTestId('settings-reference-repository')).toHaveAttribute(
    'href',
    'https://github.com/Renakoni/marktext-android',
  )
  await expect(page.getByTestId('settings-reference-issues')).toHaveAttribute(
    'href',
    'https://github.com/Renakoni/marktext-android/issues',
  )

  await page.getByTestId('bottom-nav-documents').click()

  await expect(page.getByTestId('documents-screen')).toBeVisible()
  await expect(page.getByTestId('new-document-button')).toBeVisible()
})

test('uses Android back to return from settings to documents before exiting', async ({ page }) => {
  await installAndroidBackButtonMock(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__appListenerCount?.('backButton') ?? 0) > 0
  })

  await page.getByTestId('bottom-nav-settings').click()
  await expect(page.getByTestId('settings-screen')).toBeVisible()
  await page.getByTestId('settings-entry-about').click()
  await expect(page.getByTestId('settings-title')).toContainText('About MarkText')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppBackButton?.()
  })

  await expect(page.getByTestId('settings-index')).toBeVisible()
  const exitCountAfterDetailBack = await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    return win.__appExitCount?.() ?? 0
  })
  expect(exitCountAfterDetailBack).toBe(0)

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppBackButton?.()
  })

  await expect(page.getByTestId('documents-screen')).toBeVisible()
  const exitCountAfterSettingsBack = await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    return win.__appExitCount?.() ?? 0
  })
  expect(exitCountAfterSettingsBack).toBe(0)

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppBackButton?.()
  })

  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as MockCapacitorWindow
      return win.__appExitCount?.() ?? 0
    })
  }).toBe(1)
})
