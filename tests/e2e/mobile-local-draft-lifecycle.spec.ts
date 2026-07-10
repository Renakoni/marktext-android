import { expect, test } from '@playwright/test'
import {
  installAndroidAppMock,
  type MockCapacitorWindow,
} from './helpers/androidAppMock'
import { expectEditorReady } from './helpers/editor'

test.describe.configure({ timeout: 60000 })

test('creates a local draft from real editor input and returns it to the recent home', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByText('No recent Markdown files')).toBeVisible()
  await expect(page.getByTestId('open-file-button')).toBeVisible()
  await expect(page.getByTestId('new-document-button')).toBeVisible()

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
  await expect(page.getByTestId('back-button')).toHaveAttribute('aria-label', 'Back')

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Fresh mobile note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('hello from playwright')

  await expect
    .poll(async () => {
      return page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
    })
    .toContain('Fresh mobile note')

  await page.getByTestId('back-button').click()

  await expect(page.getByTestId('draft-save-prompt')).toBeVisible()
  await expect(page.getByText('Save this draft to your device?')).toBeVisible()
  await expect(page.getByTestId('prompt-save-to-device-button')).toBeHidden()
  await page.getByTestId('prompt-keep-draft-button').click()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Continue writing' })).toBeVisible()
  await expect(page.getByText('Fresh mobile note')).toBeVisible()
  await expect(page.getByText('No recent Markdown files')).toBeHidden()
  await expect(page.getByTestId('new-document-button')).toBeVisible()
})

test('preserves repeated ordered-list markers when a draft is opened and saved', async ({ page }) => {
  const now = '2026-07-01T08:00:00.000Z'
  const markdown = '# List marker note\n\n1. one\n1. two\n1. three\n'

  await page.goto('/')
  await page.evaluate(({ markdown, now }) => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:drafts',
      JSON.stringify([
        {
          id: 'doc-repeated-list-marker',
          markdown,
          updatedAt: now,
          lastSavedAt: now,
        },
      ]),
    )
  }, { markdown, now })
  await page.reload()

  await page.getByRole('button', { name: /List marker note/ }).click()
  await expectEditorReady(page)
  await page.getByTestId('back-button').click()

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('1. one\\n1. two\\n1. three')
  expect(drafts).not.toContain('1. one\\n2. two\\n3. three')
})

test('preserves leading whitespace inside front matter when a draft is opened and saved', async ({ page }) => {
  const now = '2026-07-01T08:00:00.000Z'
  const markdown = '---\n  title: indented\n---\n\n# Front matter note\n'

  await page.goto('/')
  await page.evaluate(({ markdown, now }) => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:drafts',
      JSON.stringify([
        {
          id: 'doc-indented-frontmatter',
          markdown,
          updatedAt: now,
          lastSavedAt: now,
        },
      ]),
    )
  }, { markdown, now })
  await page.reload()

  await page.getByRole('button', { name: /Front matter note/ }).click()
  await expectEditorReady(page)
  await page.getByTestId('back-button').click()

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('---\\n  title: indented\\n---')
  expect(drafts).not.toContain('---\\ntitle: indented\\n---')
})

test('flushes local draft edits when the WebView becomes hidden', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Pause flush note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('saved before the debounce timer fires')

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(100)

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('Pause flush note')
})

test('flushes local draft edits when the WebView page is hidden', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Pagehide flush note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('pagehide extension')
  await expect(page.getByTestId('editor-host')).toContainText('pagehide extension')
  await page.waitForFunction(
    () =>
      new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )

  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'))
  })
  await page.waitForTimeout(100)

  const draftsAfterPageHide = await page.evaluate(
    () => localStorage.getItem('marktext-for-android:drafts') ?? '',
  )
  expect(draftsAfterPageHide).toContain('pagehide extension')
})

test('flushes local draft edits on Capacitor app pause', async ({ page }) => {
  await installAndroidAppMock(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__appListenerCount?.('pause') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Capacitor pause note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('pause should save without waiting for debounce')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppPause?.()
  })
  await page.waitForTimeout(100)

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('Capacitor pause note')
})

test('flushes local draft edits on Capacitor app inactive', async ({ page }) => {
  await installAndroidAppMock(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__appListenerCount?.('appStateChange') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Capacitor inactive note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('inactive should save without waiting for debounce')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppStateChange?.(false)
  })
  await page.waitForTimeout(100)

  const draftsAfterInactive = await page.evaluate(
    () => localStorage.getItem('marktext-for-android:drafts') ?? '',
  )
  expect(draftsAfterInactive).toContain('Capacitor inactive note')
})

test('opens the draft exit prompt from the Android back button', async ({ page }) => {
  await installAndroidAppMock(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__appListenerCount?.('backButton') ?? 0) > 0
  })

  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)

  await page.getByTestId('editor-host').click()
  await page.keyboard.type('# Android back note')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('system back should reuse the editor back flow')

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitCapacitorAppBackButton?.()
  })

  await expect(page.getByTestId('draft-save-prompt')).toBeVisible()
  await expect(page.getByText('Save this draft to your device?')).toBeVisible()

  const drafts = await page.evaluate(() => localStorage.getItem('marktext-for-android:drafts') ?? '')
  expect(drafts).toContain('Android back note')
})
