import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 60000 })

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
