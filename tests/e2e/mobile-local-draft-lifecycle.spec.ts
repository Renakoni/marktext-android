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

test('gives each genuinely untitled draft a distinct, stable number', async ({ page }) => {
  // Two drafts with content but no derivable title (empty-bodied code fences)
  // plus a heading-titled one, all saved before per-draft numbering.
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:drafts',
      JSON.stringify([
        {
          id: 'code-old',
          markdown: '```\n```',
          createdAt: '2026-07-01T08:00:00.000Z',
          updatedAt: '2026-07-01T08:00:00.000Z',
          lastSavedAt: '2026-07-01T08:00:00.000Z',
        },
        {
          id: 'code-new',
          markdown: '```js\n```',
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
          lastSavedAt: '2026-07-01T09:00:00.000Z',
        },
        {
          id: 'titled',
          markdown: '# A real heading\n\nbody',
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-01T10:00:00.000Z',
          lastSavedAt: '2026-07-01T10:00:00.000Z',
        },
      ]),
    )
  })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'MarkText' })).toBeVisible()
  // The two code-only drafts get distinct numbers (oldest first); the titled
  // one keeps its heading — normal derivation is untouched.
  await expect(page.getByText('Untitled-1', { exact: true })).toBeVisible()
  await expect(page.getByText('Untitled-2', { exact: true })).toBeVisible()
  await expect(page.getByText('A real heading', { exact: true })).toBeVisible()

  // The numbers are frozen into storage as each draft's stable identity, and
  // only the genuinely untitled drafts carry one.
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('marktext-for-android:drafts') ?? '[]'),
  )
  const displayNamesById = Object.fromEntries(
    (stored as { id: string; displayName?: string }[]).map(draft => [draft.id, draft.displayName]),
  )
  expect(displayNamesById['code-old']).toBe('Untitled-1')
  expect(displayNamesById['code-new']).toBe('Untitled-2')
  expect(displayNamesById['titled']).toBeUndefined()
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
