import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 60000 })

const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'

async function expectEditorReady(page: Page) {
  await expect(page.getByTestId('editor-host')).toBeVisible({ timeout: 30000 })
}

async function openLocalDraft(page: Page, markdown: string, title: RegExp) {
  const now = '2026-07-01T08:00:00.000Z'
  await page.goto('/')
  await page.evaluate(
    ({ markdown, now }) => {
      localStorage.clear()
      localStorage.setItem(
        'marktext-for-android:drafts',
        JSON.stringify([
          {
            id: 'capability-draft',
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

async function newBlankDocument(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
}

async function getDraftStorage(page: Page) {
  return page.evaluate(key => localStorage.getItem(key) ?? '', DRAFTS_STORAGE_KEY)
}

test('renders loaded inline and block math with KaTeX', async ({ page }) => {
  await openLocalDraft(
    page,
    `# Math Probe

Inline math $x^2 + y^2$ stays rendered.

$$
E = mc^2
$$
`,
    /Math Probe/,
  )

  await expect(page.getByTestId('editor-host')).toContainText('Math Probe')
  await expect.poll(() => page.locator('.katex').count()).toBeGreaterThan(0)
  await expect(page.locator('.mu-math-block')).toHaveCount(1)
  await expect(page.locator('.mu-math-error')).toHaveCount(0)
})

test('renders loaded fenced code with editor code controls', async ({ page }) => {
  await openLocalDraft(
    page,
    `# Code Probe

\`\`\`js
const answer = 42
console.log(answer)
\`\`\`
`,
    /Code Probe/,
  )

  const codeBlock = page.locator('.mu-code-block')
  await expect(codeBlock).toHaveCount(1)
  await expect(codeBlock).toContainText('const answer = 42')
  await expect(codeBlock.locator('.mu-code-copy')).toBeVisible()
  await expect(codeBlock.locator('.token.keyword').first()).toBeVisible()
})

test('renders loaded lists, links, and tables as structured editor blocks', async ({ page }) => {
  await openLocalDraft(
    page,
    `# Structure Probe

- Bullet item

1. Ordered item

- [x] Checked task

[MarkText](https://github.com/marktext/marktext)

| Name | Value |
| --- | --- |
| Alpha | 1 |
`,
    /Structure Probe/,
  )

  const editor = page.getByTestId('editor-host')
  await expect(editor.locator('ul').filter({ hasText: 'Bullet item' })).toHaveCount(1)
  await expect(editor.locator('ol').filter({ hasText: 'Ordered item' })).toHaveCount(1)
  await expect(editor.locator('.mu-task-list-checkbox')).toHaveCount(1)
  await expect(editor.locator('.mu-link').filter({ hasText: 'MarkText' })).toBeVisible()
  await expect(editor.locator('figure.mu-table')).toHaveCount(1)
  await expect(editor.locator('figure.mu-table')).toContainText('Alpha')
})

test('renders loaded Mermaid diagrams without falling back to a code block', async ({ page }) => {
  await openLocalDraft(
    page,
    `# Diagram Probe

\`\`\`mermaid
graph TD
  A[Start] --> B[Done]
\`\`\`
`,
    /Diagram Probe/,
  )

  await expect(page.locator('.mu-diagram-block')).toHaveCount(1)
  await expect(page.locator('.mu-code-block')).toHaveCount(0)
  await expect(page.locator('.mu-diagram-error')).toHaveCount(0)
  await expect
    .poll(() => page.locator('.mu-diagram-preview svg').count(), { timeout: 30000 })
    .toBeGreaterThan(0)
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
