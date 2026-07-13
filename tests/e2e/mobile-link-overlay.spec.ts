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

test('confirms in place after copying the link', async ({ page }) => {
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
  await expect(copyButton.locator('.link-action-icon-check')).toBeVisible()
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
