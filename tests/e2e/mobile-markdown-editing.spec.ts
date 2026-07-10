import { expect, test } from '@playwright/test'
import {
  getDraftStorage,
  newBlankDocument,
  openLocalDraft,
} from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

test('toggles a task list checkbox and persists the checked markdown state', async ({ page }) => {
  await openLocalDraft(
    page,
    {
      id: 'markdown-editing-draft',
      markdown: `# Task Probe

- [ ] Tap this task
`,
      title: /Task Probe/,
    },
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

test('converts typed dollar fences into a persisted math block', async ({ page }) => {
  await newBlankDocument(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('$$')
  await page.keyboard.press('Enter')
  await page.keyboard.type('a^2 + b^2 = c^2')

  await expect(page.locator('.mu-math-block')).toHaveCount(1)
  await expect.poll(() => page.locator('.katex').count()).toBeGreaterThan(0)
  await expect.poll(() => getDraftStorage(page)).toContain('a^2 + b^2 = c^2')
})

test('shows the MarkText selection toolbar only while editor text is selected', async ({
  page,
}) => {
  await openLocalDraft(
    page,
    {
      id: 'markdown-editing-draft',
      markdown: `# Selection Probe

Select this paragraph to reveal the toolbar
`,
      title: /Selection Probe/,
    },
  )

  const toolbar = page.getByTestId('mobile-selection-toolbar')
  await expect(toolbar).toBeHidden()

  await page.evaluate(() => {
    const paragraph = Array.from(
      document.querySelectorAll('[data-testid="editor-host"] .mu-editor p'),
    ).find(node => node.textContent?.includes('Select this paragraph'))
    if (!paragraph) {
      throw new Error('selection probe paragraph not found')
    }

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  })

  await expect(toolbar).toBeVisible()
  await expect(toolbar.getByTestId('selection-command-copy')).toBeVisible()
  await expect(toolbar.getByTestId('selection-command-cut')).toBeVisible()
  await expect(toolbar.getByTestId('selection-command-selectAll')).toBeVisible()

  // tap() exercises the touch dispatch path real Android devices use:
  // touchstart is suppressed by the toolbar and the command fires on touchend.
  await toolbar.getByTestId('selection-command-selectAll').tap()
  await expect(toolbar).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.toString() ?? ''))
    .toContain('Selection Probe')

  await page.evaluate(() => document.getSelection()?.removeAllRanges())
  await expect(toolbar).toBeHidden()
})
