import { expect, test } from '@playwright/test'
import {
  getDraftStorage,
  newBlankDocument,
  openLocalDraft,
} from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// The "/" quick-insert menu is deliberately not registered on Android (the
// toolbar is the insert surface), so the empty-paragraph hint must not
// advertise it.
test('the empty-paragraph hint does not promise the unregistered "/" menu', async ({ page }) => {
  await newBlankDocument(page)

  await expect(
    page.locator('[data-testid="editor-host"] [empty-hint]').first(),
  ).toHaveAttribute('empty-hint', 'Start writing...')
})

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

test('keeps broken image alt text visible and accessible', async ({ page }) => {
  await page.route('https://example.com/broken-alt.png', route => route.abort())
  await openLocalDraft(page, {
    id: 'broken-image-alt-draft',
    markdown: `# Broken image

![Descriptive broken image alternative](https://example.com/broken-alt.png)
`,
    title: /Broken image/,
  })

  const fallback = page.locator('.mu-inline-image.mu-image-fail')
  const failureText = 'Load image failed: Descriptive broken image alternative'
  await expect(fallback).toHaveAttribute('role', 'img')
  await expect(fallback).toHaveAttribute('aria-label', failureText)
  await expect.poll(() =>
    fallback.evaluate(element => getComputedStyle(element, '::before').content),
  ).toContain(failureText)
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

// The floating selection toolbar's visibility, action set, select-all
// retention, and dismissal behavior are owned by
// mobile-selection-toolbar.spec.ts; this file covers Markdown editing
// semantics only.
