import { expect, test, type Page } from '@playwright/test'
import { getDraftStorage, openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// #180 / #149 — source code mode: a plain monospace textarea stands in for
// the WYSIWYG surface. The engine hand-off invariants (single undo boundary,
// caret mapping, canonical re-serialization) are pinned by the muya
// sourceModeHandoff spec; these tests cover the app-shell composition: the
// toggle, the surfaces that stand down, the autosave route through the
// textarea, and the wired sourceCodeModeEnabled setting.

const DRAFT = {
  id: 'source-mode-draft',
  markdown: '# Source Probe\n\nfirst paragraph\n',
  title: /Source Probe/,
}

async function toggleSourceMode(page: Page) {
  await page.getByTestId('editor-menu-button').click()
  await page.getByTestId('source-mode-toggle-button').click()
}

test('round-trips edits through source mode with one undo step back', async ({ page }) => {
  await openLocalDraft(page, DRAFT)

  await toggleSourceMode(page)
  const area = page.getByTestId('source-mode-editor')
  await expect(area).toBeVisible()
  await expect(area).toHaveValue(/# Source Probe/)

  // The WYSIWYG surfaces stand down: toolbar, search, outline.
  await expect(page.getByTestId('mobile-editor-toolbar')).toHaveCount(0)
  await expect(page.getByTestId('search-open-button')).toHaveCount(0)
  await expect(page.getByTestId('outline-open-button')).toHaveCount(0)

  // Edit the raw source: append a list the WYSIWYG must render on return.
  const original = await area.inputValue()
  await area.fill(`${original}\n- added item\n`)

  await toggleSourceMode(page)
  await expect(page.getByTestId('source-mode-editor')).toHaveCount(0)
  const host = page.getByTestId('editor-host')
  await expect(host).toBeVisible()
  await expect(host).toContainText('added item')
  await expect(page.getByTestId('mobile-editor-toolbar')).toBeVisible()

  // The whole source session is ONE undo step: a single undo restores the
  // entry document.
  await page.getByTestId('toolbar-command-edit.undo').click()
  await expect(host).not.toContainText('added item')
  await expect(host).toContainText('first paragraph')
})

test('autosaves the textarea content while the mode is active', async ({ page }) => {
  await openLocalDraft(page, DRAFT)

  await toggleSourceMode(page)
  const area = page.getByTestId('source-mode-editor')
  const original = await area.inputValue()
  await area.fill(`${original}\nsource-mode payload\n`)

  // The session's markdown override routes the SAME autosave pipeline to
  // the textarea — the durable draft picks the edit up without leaving the
  // mode.
  await expect.poll(() => getDraftStorage(page), { timeout: 15000 }).toContain(
    'source-mode payload',
  )
})

test('the wired setting opens documents in source mode without popping the keyboard', async ({ page }) => {
  await openLocalDraft(page, {
    ...DRAFT,
    settings: { sourceCodeModeEnabled: true },
    waitFor: 'source-mode',
  })

  const area = page.getByTestId('source-mode-editor')
  await expect(area).toBeVisible()
  await expect(area).toHaveValue(/# Source Probe/)

  // Setting-driven auto-entry must not focus the textarea (no keyboard pop
  // on open), matching the WYSIWYG surface's focus-release contract.
  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute('data-testid') ?? '',
  )
  expect(focused).not.toBe('source-mode-editor')

  // The menu row reads as active and toggles back to WYSIWYG.
  await toggleSourceMode(page)
  await expect(page.getByTestId('editor-host')).toBeVisible()
})

test('menu-driven entry focuses the textarea at the entry caret', async ({ page }) => {
  await openLocalDraft(page, DRAFT)

  await toggleSourceMode(page)
  const area = page.getByTestId('source-mode-editor')
  await expect(area).toBeVisible()
  await expect(area).toBeFocused()
})

test('the textarea colors ride the theme variables', async ({ page }) => {
  await openLocalDraft(page, DRAFT)
  await toggleSourceMode(page)
  await expect(page.getByTestId('source-mode-editor')).toBeVisible()

  const { areaBackground, surfaceToken } = await page.evaluate(() => {
    const area = document.querySelector('[data-testid="source-mode-editor"]')!
    const probe = document.createElement('div')
    probe.style.background = 'var(--surface)'
    document.body.appendChild(probe)
    const surface = getComputedStyle(probe).backgroundColor
    probe.remove()
    return {
      areaBackground: getComputedStyle(area).backgroundColor,
      surfaceToken: surface,
    }
  })

  expect(areaBackground).toBe(surfaceToken)
})
