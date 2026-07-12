import { expect, test, type Page } from '@playwright/test'
import { expectEditorReady } from './helpers/editor'

test.describe.configure({ timeout: 60000 })

const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'
const SETTINGS_STORAGE_KEY = 'marktext-for-android:settings-ui'

async function openAppearanceSettings(page: Page) {
  await page.getByTestId('bottom-nav-settings').click()
  await expect(page.getByTestId('settings-screen')).toBeVisible()
  await page.getByTestId('settings-entry-appearance').click()
  await expect(page.getByTestId('settings-title')).toBeVisible()
}

test('uses the selected language in a newly created editor session', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await openAppearanceSettings(page)
  await page.getByTestId('settings-language-option-zh-cn').click()
  await expect(page.getByTestId('settings-title')).toContainText('外观')

  await page.getByTestId('settings-detail-back').click()
  await page.getByTestId('bottom-nav-documents').click()
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await expect(page.getByRole('heading', { name: '未命名-1' })).toBeVisible()
  await expect(page.getByText('就绪')).toBeVisible()
  await page.getByTestId('toolbar-expand-button').click()
  await expect(page.getByTestId('toolbar-group-switcher')).toContainText('格式')
  await expect(page.getByTestId('mobile-editor-toolbar')).toContainText('0 字 · 0 字符 · 0 行')
  await page.getByTestId('editor-host').click()
  await page.keyboard.type('```')
  await page.keyboard.press('Enter')
  await expect(page.locator('[hint]').first()).toHaveAttribute('hint', /输入程序语言标识/)
})

test('applies Appearance text settings without rewriting existing draft Markdown', async ({ page }) => {
  const markdown = '# Appearance Probe\r\n\r\n- [ ] untouched\r\n'
  const now = '2026-07-03T08:00:00.000Z'

  await page.goto('/')
  await page.evaluate(
    ({ markdown, now, draftsKey }) => {
      localStorage.clear()
      localStorage.setItem(
        draftsKey,
        JSON.stringify([
          {
            id: 'appearance-probe-draft',
            markdown,
            updatedAt: now,
            lastSavedAt: now,
          },
        ]),
      )
    },
    { markdown, now, draftsKey: DRAFTS_STORAGE_KEY },
  )
  await page.reload()

  await openAppearanceSettings(page)
  await page.getByTestId('settings-appearance-font-size').getByRole('slider').fill('18')
  await page.getByTestId('settings-appearance-line-height').getByRole('slider').fill('1.8')
  await page.getByTestId('settings-appearance-font-trigger').click()
  await page.getByTestId('settings-appearance-font-option-monospace').click()
  await page.getByTestId('settings-appearance-line-width').getByRole('textbox').fill('72ch')
  await page.getByTestId('settings-appearance-direction-option-rtl').click()

  await page.getByTestId('settings-detail-back').click()
  await page.getByTestId('bottom-nav-documents').click()
  await page.getByRole('button', { name: /Appearance Probe/ }).click()
  await expectEditorReady(page)

  const editorHost = page.getByTestId('editor-host')
  await expect(editorHost).toHaveAttribute('dir', 'rtl')
  // The line-width setting is the TEXT measure; both responsive gutters are
  // added on top (16px each at the phone breakpoint).
  await expect(editorHost).toHaveCSS('--editor-area-width', 'calc(2 * 16px + 72ch)')
  await expect(editorHost.locator('.muya-host')).toHaveCSS('--mu-font-size', '18px')
  await expect(editorHost.locator('.muya-host')).toHaveCSS('--mu-line-height', '1.8')
  await expect(editorHost.locator('.muya-host')).toHaveCSS('--mu-font-family', /DejaVu Sans Mono/)

  await expect
    .poll(() =>
      page.evaluate(draftsKey => {
        const drafts = JSON.parse(localStorage.getItem(draftsKey) ?? '[]') as Array<{
          markdown?: string
        }>
        return drafts[0]?.markdown
      }, DRAFTS_STORAGE_KEY),
    )
    .toBe(markdown)

  await expect
    .poll(() =>
      page.evaluate(settingsKey => {
        const settings = JSON.parse(localStorage.getItem(settingsKey) ?? '{}') as Record<
          string,
          unknown
        >
        return settings
      }, SETTINGS_STORAGE_KEY),
    )
    .toMatchObject({
      fontSize: 18,
      lineHeight: 1.8,
      editorFontFamily: 'monospace',
      editorLineWidth: '72ch',
      textDirection: 'rtl',
    })
})
