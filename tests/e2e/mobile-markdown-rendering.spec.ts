import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ timeout: 60000 })

const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'

async function expectEditorReady(page: Page) {
  await expect(page.getByTestId('editor-host')).toBeVisible({ timeout: 30000 })
}

async function openLocalDraft(page: Page, markdown: string, title: RegExp) {
  const now = '2026-07-01T10:00:00.000Z'
  await page.goto('/')
  await page.evaluate(
    ({ markdown, now }) => {
      localStorage.clear()
      localStorage.setItem(
        'marktext-for-android:drafts',
        JSON.stringify([
          {
            id: 'markdown-rendering-draft',
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

async function getStoredMarkdown(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return ''
    }
    const [draft] = JSON.parse(raw) as Array<{ markdown: string }>
    return draft?.markdown ?? ''
  }, DRAFTS_STORAGE_KEY)
}

test('renders loaded CommonMark and GFM blocks as Muya editor structures', async ({ page }) => {
  await openLocalDraft(
    page,
    `# Rendering Matrix

> Quoted **strong** and *emphasized* text with \`inline code\`.

---

- Bullet item
- [x] Checked item
- [ ] Unchecked item

1. First item
2. Second item

[MarkText](https://github.com/marktext/marktext)

| Feature | State |
| --- | --- |
| Table | Ready |
`,
    /Rendering Matrix/,
  )

  const editor = page.getByTestId('editor-host')
  await expect(editor.locator('h1.mu-atx-heading')).toContainText('Rendering Matrix')
  await expect(editor.locator('.mu-block-quote')).toContainText('Quoted')
  await expect(editor.locator('.mu-thematic-break')).toHaveCount(1)
  await expect(editor.locator('ul').filter({ hasText: 'Bullet item' })).toHaveCount(1)
  await expect(editor.locator('ol').filter({ hasText: 'Second item' })).toHaveCount(1)
  await expect(editor.locator('.mu-task-list-checkbox')).toHaveCount(2)
  await expect(editor.locator('.mu-task-list-checkbox.mu-checkbox-checked')).toHaveCount(1)
  await expect(editor.locator('.mu-link').filter({ hasText: 'MarkText' })).toBeVisible()
  await expect(editor.locator('figure.mu-table')).toHaveCount(1)
  await expect(editor.locator('figure.mu-table')).toContainText('Ready')
})

test('renders loaded math, fenced code, and Mermaid previews', async ({ page }) => {
  await openLocalDraft(
    page,
    `# Preview Matrix

Inline math $x^2 + y^2$.

$$
E = mc^2
$$

\`\`\`ts
const ready: boolean = true
\`\`\`

\`\`\`mermaid
graph TD
  A[Start] --> B[Done]
\`\`\`
`,
    /Preview Matrix/,
  )

  const editor = page.getByTestId('editor-host')
  await expect.poll(() => editor.locator('.katex').count()).toBeGreaterThan(0)
  await expect(editor.locator('.mu-math-block')).toHaveCount(1)
  await expect(editor.locator('.mu-math-error')).toHaveCount(0)
  await expect(editor.locator('.mu-code-block')).toHaveCount(1)
  await expect(editor.locator('.mu-code-block .token.keyword').first()).toBeVisible()
  await expect(editor.locator('.mu-diagram-block')).toHaveCount(1)
  await expect(editor.locator('.mu-diagram-error')).toHaveCount(0)
  await expect
    .poll(() => editor.locator('.mu-diagram-preview svg').count(), { timeout: 30000 })
    .toBeGreaterThan(0)
})

test('renders all supported diagram previews without rewriting the Markdown source', async ({ page }) => {
  await page.route('https://www.plantuml.com/plantuml/svg/**', route =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="4" y="24">PlantUML</text></svg>',
    }),
  )

  const markdown = `# Diagram Matrix

\`\`\`mermaid
graph TD
  A[Start] --> B[Done]
\`\`\`

\`\`\`plantuml
@startuml
Alice -> Bob: Hello
@enduml
\`\`\`

\`\`\`vega-lite
{
  "data": { "values": [{ "category": "A", "value": 1 }, { "category": "B", "value": 2 }] },
  "mark": "bar",
  "encoding": {
    "x": { "field": "category", "type": "nominal" },
    "y": { "field": "value", "type": "quantitative" }
  }
}
\`\`\`

\`\`\`flowchart
st=>start: Start
op=>operation: Process
e=>end: End
st->op->e
\`\`\`

\`\`\`sequence
Alice->Bob: Hello Bob
Bob-->Alice: Hello Alice
\`\`\`
`

  await openLocalDraft(page, markdown, /Diagram Matrix/)

  const editor = page.getByTestId('editor-host')
  await expect(editor.locator('.mu-diagram-block')).toHaveCount(5)
  await expect(editor.locator('.mu-code-block')).toHaveCount(0)
  await expect(editor.locator('.mu-diagram-error')).toHaveCount(0)
  await expect(editor.locator('.mu-diagram-preview img[src^="https://www.plantuml.com/plantuml/svg/"]')).toHaveCount(1)
  await expect
    .poll(() => editor.locator('.mu-diagram-preview svg').count(), { timeout: 45000 })
    .toBeGreaterThanOrEqual(4)
  await expect.poll(() => getStoredMarkdown(page)).toBe(markdown)
})

test('renders loaded front matter, footnotes, HTML blocks, and inline images', async ({ page }) => {
  await page.goto('/')
  const appIconUrl = await page.evaluate(() => new URL('/favicon.svg', location.href).href)

  await openLocalDraft(
    page,
    `---
title: Mobile Render Probe
---

# Extended Matrix

Reference with footnote.[^note]

Inline image: ![App icon](${appIconUrl})

<div class="html-probe"><strong>HTML Rendered</strong></div>

[^note]: Footnote body text.
`,
    /Extended Matrix/,
  )

  const editor = page.getByTestId('editor-host')
  await expect(editor.locator('pre.mu-frontmatter')).toHaveCount(1)
  await expect(editor.locator('pre.mu-frontmatter')).toContainText('Mobile Render Probe')
  await expect(editor.locator('.mu-footnote')).toHaveCount(1)
  await expect(editor.locator('.mu-footnote')).toContainText('Footnote body text')
  await expect(editor.locator('.mu-html-block')).toHaveCount(1)
  await expect(editor.locator('.mu-html-preview')).toContainText('HTML Rendered')
  await expect(editor.locator('.mu-inline-image img[alt="App icon"]')).toHaveCount(1)
  await expect.poll(() => editor.locator('.mu-inline-image.mu-image-success').count()).toBeGreaterThan(0)
})
