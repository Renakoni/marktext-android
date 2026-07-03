import { expect, type Page } from '@playwright/test'

const MUYA_READY_SELECTOR = [
  '.mu-editor .mu-paragraph',
  '.mu-editor .mu-atx-heading',
  '.mu-editor .mu-setext-heading',
  '.mu-editor .mu-block-quote',
  '.mu-editor .mu-bullet-list',
  '.mu-editor .mu-order-list',
  '.mu-editor .mu-task-list',
  '.mu-editor .mu-code-block',
  '.mu-editor .mu-math-block',
  '.mu-editor .mu-diagram-block',
  '.mu-editor .mu-html-block',
  '.mu-editor pre.mu-frontmatter',
  '.mu-editor figure.mu-table',
].join(', ')

export async function expectEditorReady(page: Page, timeout = 30000) {
  await expect(page.getByTestId('editor-loading-host')).toBeHidden({ timeout })

  const host = page.getByTestId('editor-host')
  await expect(host).toBeVisible({ timeout })
  await expect(host.locator('.mu-editor')).toBeVisible({ timeout })
  await expect(host.locator(MUYA_READY_SELECTOR).first()).toBeAttached({ timeout })
}
