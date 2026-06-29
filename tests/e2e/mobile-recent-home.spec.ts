import { expect, test, type Page } from '@playwright/test'

async function installTransientAndroidCreateMock(page: Page) {
  await page.addInitScript(() => {
    const win = window as unknown as {
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
      }
    }

    win.androidBridge = {}
    win.Capacitor = {
      ...(win.Capacitor ?? {}),
      PluginHeaders: [
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

        return Promise.reject({
          code: 'UNIMPLEMENTED',
          message: `${pluginName}.${methodName} is not mocked`,
        })
      },
    }
  })
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
