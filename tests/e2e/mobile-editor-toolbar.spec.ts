import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 60000 })

interface MockCapacitorWindow {
  androidBridge?: unknown
  Capacitor?: {
    PluginHeaders?: Array<{
      name: string
      methods: Array<{ name: string; rtype: string }>
    }>
    nativePromise?: (
      pluginName: string,
      methodName: string,
      options?: Record<string, unknown>,
    ) => Promise<unknown>
    nativeCallback?: (
      pluginName: string,
      methodName: string,
      options: Record<string, unknown>,
      callback?: (data: unknown) => void,
    ) => Promise<string>
  }
}

async function expectEditorReady(page: Page) {
  await expect(page.getByTestId('editor-host')).toBeVisible({ timeout: 30000 })
}

async function newBlankDocument(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
}

async function getDraftStorage(page: Page) {
  return page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
}

async function installAndroidImagePickerMock(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as MockCapacitorWindow

    win.androidBridge = {}
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
            { name: 'getImportedImageDirectory', rtype: 'promise' },
            { name: 'pickImageDocument', rtype: 'promise' },
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
      nativePromise(pluginName, methodName) {
        if (pluginName === 'App' && methodName === 'exitApp') {
          return Promise.resolve()
        }

        if (methodName === 'removeListener') {
          return Promise.resolve()
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'getImportedImageDirectory') {
          return Promise.resolve({
            fileUri: 'file:///mock/images',
            webBaseUri: location.origin,
          })
        }

        if (pluginName === 'AndroidDocuments' && methodName === 'pickImageDocument') {
          return Promise.resolve({
            canceled: false,
            sourceUri: 'content://test/picked-image',
            displayName: 'favicon.svg',
            mimeType: 'image/svg+xml',
            markdownSrc: 'marktext-image://local/favicon.svg',
            fileUri: 'file:///mock/images/favicon.svg',
            bytes: 512,
          })
        }

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
    }
  })
}

test('applies quick toolbar inline formatting to selected editor text', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('bold from mobile toolbar')
  await page.keyboard.press('Control+A')
  await page.getByTestId('toolbar-command-format.strong').click()

  await expect.poll(() => getDraftStorage(page)).toContain('**bold from mobile toolbar**')
})

test('inserts a link from selected editor text through the mobile link sheet', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('MarkText for Android')
  await page.keyboard.press('Control+A')
  await page.getByTestId('toolbar-command-format.hyperlink').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeVisible()
  await expect(page.getByTestId('link-text-input')).toHaveValue('MarkText for Android')
  await page.getByTestId('link-url-input').fill('https://github.com/Renakoni/marktext-android')
  await page.getByTestId('link-insert-button').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeHidden()
  await expect.poll(() => getDraftStorage(page)).toContain(
    '[MarkText for Android](https://github.com/Renakoni/marktext-android)',
  )
})

test('inserts a link at a collapsed cursor through the mobile link sheet', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.getByTestId('toolbar-command-format.hyperlink').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeVisible()
  await expect(page.getByTestId('link-text-input')).toHaveValue('')
  await page.getByTestId('link-text-input').fill('Project repo')
  await page.getByTestId('link-url-input').fill('example.com')
  await page.getByTestId('link-insert-button').click()

  await expect(page.getByTestId('link-insert-sheet')).toBeHidden()
  await expect.poll(() => getDraftStorage(page)).toContain('[Project repo](example.com)')
})

test('inserts an Android-picked image from selected text through the format panel', async ({ page }) => {
  await installAndroidImagePickerMock(page)
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('Picked icon')
  await page.keyboard.press('Control+A')
  await page.getByTestId('toolbar-expand-button').click()
  await page.getByTestId('toolbar-panel-command-format.image').click()

  await expect.poll(() => getDraftStorage(page)).toContain(
    '![Picked icon](marktext-image://local/favicon.svg)',
  )

  const editor = page.getByTestId('editor-host')
  await expect(editor.locator('.mu-inline-image img[alt="Picked icon"]')).toHaveCount(1)
  await expect.poll(() => editor.locator('.mu-inline-image.mu-image-success').count()).toBeGreaterThan(0)
})

test('applies expanded toolbar block and list commands to the current paragraph', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('Toolbar heading')

  await page.getByTestId('toolbar-expand-button').click()
  await expect(page.getByTestId('mobile-editor-toolbar-panel')).toBeVisible()
  await page.getByTestId('toolbar-panel-tab-block').click()
  await page.getByTestId('toolbar-panel-command-paragraph.heading-1').click()

  await expect.poll(() => getDraftStorage(page)).toContain('# Toolbar heading')

  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('next action')
  await page.getByTestId('toolbar-panel-tab-list').click()
  await page.getByTestId('toolbar-panel-command-paragraph.task-list').click()

  await expect.poll(() => getDraftStorage(page)).toContain('- [ ] next action')
})
