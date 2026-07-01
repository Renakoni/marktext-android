import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 60000 })

const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'

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

async function openLocalDraft(page: Page, markdown: string, title: RegExp) {
  const now = '2026-07-01T09:00:00.000Z'
  await page.goto('/')
  await page.evaluate(
    ({ markdown, now }) => {
      localStorage.clear()
      localStorage.setItem(
        'marktext-for-android:drafts',
        JSON.stringify([
          {
            id: 'markdown-editing-draft',
            markdown,
            updatedAt: now,
            lastSavedAt: now,
          },
        ]),
      )
    },
    { markdown, now },
  )
  await page.reload()

  await page.getByRole('button', { name: title }).click()
  await expectEditorReady(page)
}

async function getDraftStorage(page: Page) {
  return page.evaluate(key => localStorage.getItem(key) ?? '', DRAFTS_STORAGE_KEY)
}

test('toggles a task list checkbox and persists the checked markdown state', async ({ page }) => {
  await openLocalDraft(
    page,
    `# Task Probe

- [ ] Tap this task
`,
    /Task Probe/,
  )

  const checkbox = page.locator('.mu-task-list-checkbox').first()
  await expect(checkbox).toBeVisible()
  await checkbox.click()

  await expect.poll(() => getDraftStorage(page)).toContain('- [x] Tap this task')
})

test('continues unordered and ordered lists from mobile keyboard input', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('- first bullet')
  await page.keyboard.press('Enter')
  await page.keyboard.type('second bullet')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('1. first step')
  await page.keyboard.press('Enter')
  await page.keyboard.type('second step')

  await expect(page.locator('ul').filter({ hasText: 'second bullet' })).toHaveCount(1)
  await expect(page.locator('ol').filter({ hasText: 'second step' })).toHaveCount(1)
  await expect.poll(() => getDraftStorage(page)).toContain('- first bullet')
  await expect.poll(() => getDraftStorage(page)).toContain('- second bullet')
  await expect.poll(() => getDraftStorage(page)).toContain('1. first step')
  await expect.poll(() => getDraftStorage(page)).toContain('2. second step')
})

test('converts a typed pipe row into a persisted Markdown table', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('| A | B |')
  await page.keyboard.press('Enter')
  await page.keyboard.type('alpha')

  const table = page.locator('figure.mu-table')
  await expect(table).toHaveCount(1)
  await expect(table).toContainText('A')
  await expect(table).toContainText('B')
  await expect(table).toContainText('alpha')
  await expect.poll(() => getDraftStorage(page)).toContain('| A')
  await expect.poll(() => getDraftStorage(page)).toContain('| B')
  await expect.poll(() => getDraftStorage(page)).toContain('| ----- | --- |')
  await expect.poll(() => getDraftStorage(page)).toContain('| alpha')
})
