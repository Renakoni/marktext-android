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
