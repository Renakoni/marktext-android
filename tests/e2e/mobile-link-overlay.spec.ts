import { expect, test } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

const OPENABLE_MARKDOWN = `# Link overlay probe

[Baidu](https://www.baidu.com/)

following paragraph
`

test('reveals the link overlay with the href when the caret enters an openable link', async ({
  page,
}) => {
  await openLocalDraft(page, {
    id: 'link-overlay-openable',
    markdown: OPENABLE_MARKDOWN,
    title: /Link overlay probe/,
  })

  const editor = page.getByTestId('editor-host')
  const overlay = page.getByTestId('link-action-overlay')

  // A caret outside every link keeps the overlay hidden.
  await editor.getByText('following paragraph').click()
  await expect(overlay).toBeHidden()

  // Entering the link surfaces the overlay anchored to it, offering both actions.
  await editor.locator('.mu-link').filter({ hasText: 'Baidu' }).click()
  await expect(overlay).toBeVisible()
  await expect(page.getByTestId('link-action-open')).toBeVisible()
  await expect(page.getByTestId('link-action-copy')).toBeVisible()

  // Leaving the link again dismisses it.
  await editor.getByText('following paragraph').click()
  await expect(overlay).toBeHidden()
})

test('keeps the overlay hidden for a relative link with no Android target', async ({ page }) => {
  await openLocalDraft(page, {
    id: 'link-overlay-relative',
    markdown: `# Relative probe

[Notes](./notes.md)

following paragraph
`,
    title: /Relative probe/,
  })

  const editor = page.getByTestId('editor-host')
  await editor.locator('.mu-link').filter({ hasText: 'Notes' }).click()
  await expect(page.getByTestId('link-action-overlay')).toBeHidden()
})

test('keeps the overlay hidden for an in-document anchor link', async ({ page }) => {
  await openLocalDraft(page, {
    id: 'link-overlay-anchor',
    markdown: `# Anchor probe

[Jump](#section)

following paragraph
`,
    title: /Anchor probe/,
  })

  const editor = page.getByTestId('editor-host')
  await editor.locator('.mu-link').filter({ hasText: 'Jump' }).click()
  await expect(page.getByTestId('link-action-overlay')).toBeHidden()
})

test('confirms in place and writes the link to the clipboard on a successful copy', async ({
  page,
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await openLocalDraft(page, {
    id: 'link-overlay-copy',
    markdown: OPENABLE_MARKDOWN,
    title: /Link overlay probe/,
  })

  const editor = page.getByTestId('editor-host')
  await editor.locator('.mu-link').filter({ hasText: 'Baidu' }).click()

  const copyButton = page.getByTestId('link-action-copy')
  await expect(copyButton).toBeVisible()
  await copyButton.click()

  // The confirmation appears only after a real write...
  await expect(copyButton.locator('.link-action-icon-check')).toBeVisible()
  // ...and the clipboard actually holds the link.
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('https://www.baidu.com/')
})

test('does not confirm when every copy channel fails', async ({ page }) => {
  // Force the web Clipboard API to reject on every navigation; there is no
  // Android bridge on the web, so the copy then has no working channel at all.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
  })
  await openLocalDraft(page, {
    id: 'link-overlay-copy-fail',
    markdown: OPENABLE_MARKDOWN,
    title: /Link overlay probe/,
  })

  const editor = page.getByTestId('editor-host')
  await editor.locator('.mu-link').filter({ hasText: 'Baidu' }).click()

  const copyButton = page.getByTestId('link-action-copy')
  await expect(copyButton).toBeVisible()
  await copyButton.click()

  // Let the async copy settle, then assert no confirmation was shown: a failed
  // write must never surface the "Copied" checkmark.
  await page.waitForTimeout(300)
  await expect(copyButton.locator('.link-action-icon-check')).toHaveCount(0)
  await expect(copyButton).toBeVisible()
})

test('honors the linkPopup setting: the overlay stays hidden when disabled', async ({ page }) => {
  await openLocalDraft(page, {
    id: 'link-overlay-disabled',
    markdown: OPENABLE_MARKDOWN,
    title: /Link overlay probe/,
    settings: { linkPopup: false },
  })

  const editor = page.getByTestId('editor-host')
  await editor.locator('.mu-link').filter({ hasText: 'Baidu' }).click()
  await expect(page.getByTestId('link-action-overlay')).toBeHidden()
})
