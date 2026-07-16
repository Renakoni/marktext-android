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
        tag_name: 'v1.0.0',
        html_url: 'https://github.com/Renakoni/marktext-android/releases/tag/v1.0.0',
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
  await expect(page.getByTestId('settings-entry-appearance')).toBeVisible()
  await expect(page.getByTestId('settings-entry-editing')).toBeVisible()
  await expect(page.getByTestId('settings-entry-toolbar')).toBeVisible()
  await expect(page.getByTestId('settings-entry-code')).toHaveCount(0)
  await expect(page.getByTestId('settings-entry-markdown')).toHaveCount(0)
  await expect(page.getByTestId('settings-entry-spelling')).toHaveCount(0)
  await expect(page.getByTestId('settings-entry-documents')).toBeVisible()
  await expect(page.getByTestId('settings-entry-images-sharing')).toBeVisible()
  await expect(page.getByTestId('settings-entry-advanced')).toBeVisible()

  await page.getByTestId('settings-entry-appearance').click()
  await expect(page.getByTestId('settings-title')).toContainText('Appearance')
  await expect(page.getByTestId('settings-language-app-trigger')).toContainText('Auto')
  await page.getByTestId('settings-language-app-trigger').click()
  await expect(page.getByTestId('settings-language-app-option-auto')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('option')).toHaveCount(11)
  await page.getByTestId('settings-language-app-option-auto').click()
  await expect(page.getByTestId('settings-appearance-theme-mode-option-system')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('settings-appearance-custom-theme')).toHaveCount(0)
  await page.getByTestId('settings-appearance-theme-mode-option-custom').click()
  await expect(page.getByTestId('settings-appearance-theme-mode-option-custom')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('settings-appearance-font-size')).toContainText('16px')
  await page.getByTestId('settings-appearance-font-size').getByRole('slider').fill('18')
  await expect(page.getByTestId('settings-appearance-font-size')).toContainText('18px')
  await page.getByTestId('settings-appearance-custom-theme-trigger').click()
  await page.getByTestId('settings-appearance-custom-theme-option-ayu-light').click()
  await expect(page.getByTestId('settings-appearance-custom-theme')).toContainText('Ayu Light')
  await page.getByTestId('settings-appearance-line-width').getByRole('textbox').fill('72ch')
  await expect(page.getByTestId('settings-appearance-line-width').getByRole('textbox')).toHaveValue(
    '72ch',
  )

  await page.getByTestId('settings-language-app-trigger').click()
  await page.getByTestId('settings-language-app-option-zh-CN').click()
  await expect(page.getByTestId('settings-title')).toContainText('外观')
  await expect(page.getByTestId('settings-language-app-trigger')).toContainText('简体中文')
  await expect(page.getByTestId('settings-appearance-theme-mode')).toContainText('模式')

  await page.getByTestId('settings-language-app-trigger').click()
  await page.getByTestId('settings-language-app-option-en').click()
  await expect(page.getByTestId('settings-title')).toContainText('Appearance')

  await page.getByTestId('settings-detail-back').click()
  await expect(page.getByTestId('settings-index')).toBeVisible()

  await page.getByTestId('settings-entry-editing').click()
  await expect(page.getByTestId('settings-title')).toContainText('Editing')
  await expect(page.getByTestId('settings-editing-brackets')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('settings-code-wrap-lines')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('settings-markdown-heading-style')).toContainText('ATX')
  await expect(page.getByTestId('settings-spelling-enabled')).toHaveAttribute(
    'aria-checked',
    'false',
  )

  await page.getByTestId('settings-detail-back').click()
  await expect(page.getByTestId('settings-index')).toBeVisible()

  await page.getByTestId('settings-entry-toolbar').click()
  await expect(page.getByTestId('settings-title')).toContainText('Toolbar')
  await expect(page.getByTestId('settings-editing-toolbar-display')).toContainText(
    'Docked at bottom',
  )
  await expect(page.getByTestId('settings-editing-toolbar-default')).toContainText('Format')
  await expect(page.getByTestId('settings-editing-quickbar-content')).toContainText('Default')
  await page.getByTestId('settings-editing-toolbar-display-option-hidden').click()
  await expect(page.getByTestId('settings-editing-toolbar-display-option-hidden')).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.getByTestId('settings-detail-back').click()
  await expect(page.getByTestId('settings-index')).toBeVisible()

  await page.getByTestId('settings-entry-documents').click()
  await expect(page.getByTestId('settings-title')).toContainText('Documents')
  await expect(page.getByTestId('settings-documents-local-drafts')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('settings-documents-recovery')).toContainText('Save failed drafts')
  await expect(page.getByTestId('settings-documents-startup-action')).toContainText('Home')
  await expect(page.getByTestId('settings-documents-sort-by')).toContainText('Modified')
  await expect(page.getByTestId('settings-documents-sort-order')).toContainText('Desc')
  await expect(page.getByTestId('settings-documents-folder-excludes')).toHaveCount(0)
  await expect(page.getByTestId('settings-documents-clear-recent')).toHaveCount(0)

  await page.getByTestId('settings-detail-back').click()
  await expect(page.getByTestId('settings-index')).toBeVisible()

  await page.getByTestId('settings-entry-images-sharing').click()
  await expect(page.getByTestId('settings-title')).toContainText('Images & Sharing')
  await expect(page.getByTestId('settings-images-copy')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('settings-images-share')).toContainText('Attach images')
  await page.getByTestId('settings-images-share-option-link-only').click()
  await expect(page.getByTestId('settings-images-share')).toContainText('Markdown only')
  await expect(page.getByTestId('settings-images-include-linked')).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await expect(page.getByTestId('settings-images-include-linked')).toContainText(
    'Linked images (unfinished)',
  )
  await expect(page.getByTestId('settings-images-import')).toHaveCount(0)
  await expect(page.getByTestId('settings-images-folder')).toHaveCount(0)
  await expect(page.getByTestId('settings-images-attach-local')).toHaveCount(0)

  await page.getByTestId('settings-detail-back').click()
  await expect(page.getByTestId('settings-index')).toBeVisible()

  await page.getByTestId('settings-entry-advanced').click()
  await expect(page.getByTestId('settings-title')).toContainText('Advanced')
  await expect(page.locator('.settings-content .settings-section h2')).toHaveText([
    'Files',
    'Diagnostics',
    'Maintenance',
  ])
  await expect(page.getByTestId('settings-advanced-diagnostics')).toContainText('web')
  await expect(page.getByTestId('settings-advanced-webview')).toContainText('Mozilla')
  await expect(page.getByTestId('settings-advanced-encoding')).toContainText('UTF-8')
  await expect(page.getByTestId('settings-advanced-auto-detect-encoding')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByTestId('settings-advanced-line-endings')).toContainText('Preserve')
  await expect(page.getByTestId('settings-advanced-trailing-newline')).toContainText('Preserve')
  await expect(page.getByTestId('settings-advanced-export-logs-action')).toContainText('Export')
  await expect(page.getByTestId('settings-advanced-clear-drafts-action')).toContainText('Clear')
  await expect(page.getByTestId('settings-advanced-reset-action')).toContainText('Reset')
  await page.getByTestId('settings-advanced-export-logs-action').click()
  await expect(page.getByTestId('settings-maintenance-sheet')).toContainText('ZIP to share')
  await expect(page.getByTestId('settings-maintenance-export-confirm')).toContainText('Export ZIP')
  await page.getByTestId('settings-maintenance-sheet').click({ position: { x: 12, y: 12 } })
  await expect(page.getByTestId('settings-maintenance-sheet')).toHaveCount(0)
  await page.getByTestId('settings-advanced-clear-drafts-action').click()
  await expect(page.getByTestId('settings-maintenance-sheet')).toContainText('Clear local drafts?')
  await expect(page.getByTestId('settings-maintenance-clear-confirm')).toContainText('Clear')
  await page.getByTestId('settings-maintenance-cancel').click()
  await page.getByTestId('settings-advanced-reset-action').click()
  await expect(page.getByTestId('settings-maintenance-sheet')).toContainText('Reset settings?')
  await expect(page.getByTestId('settings-maintenance-reset-confirm')).toContainText('Reset')
  await page.getByTestId('settings-maintenance-reset-confirm').click()
  await expect(page.getByTestId('settings-maintenance-sheet')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() =>
    localStorage.getItem('marktext-for-android:locale'),
  )).toBe('auto')
  await expect(page.getByTestId('settings-advanced-normalize-endings')).toHaveCount(0)
  await expect(page.getByTestId('settings-advanced-search-exclusions')).toHaveCount(0)
  await expect(page.getByTestId('settings-advanced-keybindings')).toHaveCount(0)
  await expect(page.getByTestId('settings-advanced-custom-css')).toHaveCount(0)

  await page.getByTestId('settings-detail-back').click()
  await expect(page.getByTestId('settings-index')).toBeVisible()

  await page.getByTestId('settings-entry-about').click()
  await expect(page.getByTestId('settings-title')).toContainText('About')
  await expect(page.getByTestId('settings-about-page')).toBeVisible()
  await expect(page.getByTestId('settings-about-app')).toBeVisible()
  await expect(page.getByTestId('settings-about-version')).toContainText('0.1.0')
  await expect(page.getByTestId('settings-about-github')).toHaveAttribute(
    'href',
    'https://github.com/Renakoni/marktext-android',
  )
  await expect(page.getByTestId('settings-about-releases')).toHaveCount(0)
  await expect(page.getByTestId('settings-about-report-issue')).toHaveCount(0)
  await expect(page.getByTestId('settings-reference-repository')).toHaveCount(0)
  await expect(page.getByTestId('settings-reference-upstream-marktext')).toHaveCount(0)
  await expect(page.getByTestId('settings-reference-muya')).toHaveCount(0)
  await expect(page.getByTestId('settings-about-notices')).toHaveCount(0)

  await expect(page.getByTestId('settings-open-release')).toHaveCount(0)

  await page.getByTestId('settings-check-updates').click()
  await expect(page.getByTestId('settings-check-updates')).toContainText(
    'Update available: v1.0.0',
  )
  await expect(page.getByTestId('settings-open-release')).toContainText('Open GitHub release')
  await expect(page.getByTestId('settings-open-release')).toHaveAttribute(
    'href',
    'https://github.com/Renakoni/marktext-android/releases/tag/v1.0.0',
  )

  await page.getByTestId('settings-detail-back').click()
  await expect(page.getByTestId('settings-index')).toBeVisible()

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
  await expect(page.getByTestId('settings-title')).toContainText('About')

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
