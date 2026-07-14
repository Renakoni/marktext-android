import { expect, test, type Locator, type Page } from '@playwright/test'
import { installAndroidAppMock, longPress, type MockCapacitorWindow } from './helpers/androidAppMock'
import { newBlankDocument, openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60_000 })

async function expectModalContract(page: Page, modal: Locator) {
  await expect(modal).toBeVisible()
  await expect.poll(() => modal.evaluate(element => element.contains(document.activeElement))).toBe(true)

  const unisolatedBackground = await modal.evaluate(element => {
    const boundary = element.closest('.app-shell')
    const failures: string[] = []
    let branch: Element | null = element
    while (branch && branch !== boundary && branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) {
          continue
        }
        if (!sibling.hasAttribute('inert') || sibling.getAttribute('aria-hidden') !== 'true') {
          failures.push(sibling.getAttribute('data-testid') ?? sibling.tagName.toLowerCase())
        }
      }
      branch = branch.parentElement
    }
    return failures
  })
  expect(unisolatedBackground).toEqual([])

  const focusableCount = await modal.locator(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  ).count()
  for (let index = 0; index < focusableCount + 2; index += 1) {
    await page.keyboard.press('Tab')
    expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Shift+Tab')
  expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true)
}

async function expectBackgroundRestored(page: Page) {
  await expect(page.locator('.app-shell [inert]')).toHaveCount(0)
}

test('document actions and local-exit prompts isolate the editor', async ({ page }) => {
  await installAndroidAppMock(page)
  await openLocalDraft(page, {
    id: 'modal-editor-draft',
    markdown: '# Modal editor draft\n\nbody',
    title: /Modal editor draft/,
  })

  const menuButton = page.getByTestId('editor-menu-button')
  await menuButton.click()
  const actionSheet = page.getByTestId('editor-action-sheet')
  await expectModalContract(page, actionSheet)
  await page.keyboard.press('Escape')
  await expect(actionSheet).toHaveCount(0)
  await expect(menuButton).toBeFocused()
  await expectBackgroundRestored(page)

  await newBlankDocument(page)
  await page.getByTestId('editor-host').click()
  await page.keyboard.type('new draft that needs an exit decision')
  await page.getByTestId('back-button').click()
  const exitPrompt = page.getByTestId('draft-save-prompt')
  await expectModalContract(page, exitPrompt)
  await page.getByTestId('prompt-keep-draft-button').click()
  await expect(exitPrompt).toHaveCount(0)
  await expectBackgroundRestored(page)
})

test('incoming-open safety prompt isolates the unsaved editor', async ({ page }) => {
  await installAndroidAppMock(page)
  await newBlankDocument(page, { localDrafts: false })
  await page.getByTestId('editor-host').click()
  await page.keyboard.type('unsaved incoming modal content')
  await page.waitForFunction(() => {
    const win = window as unknown as MockCapacitorWindow
    return (win.__androidDocumentListenerCount?.('openWithDocument') ?? 0) > 0
  })

  await page.evaluate(() => {
    const win = window as unknown as MockCapacitorWindow
    win.__emitAndroidOpenWithDocument?.({
      document: {
        sourceUri: 'content://test/modal-incoming',
        displayName: 'Incoming modal.md',
        markdown: '# Incoming modal',
        canWrite: true,
        persisted: true,
      },
    })
  })

  const prompt = page.getByTestId('incoming-open-prompt')
  await expectModalContract(page, prompt)
  await page.getByTestId('prompt-keep-editing-button').click()
  await expect(prompt).toHaveCount(0)
  await expect(page.getByTestId('editor-host')).toContainText('unsaved incoming modal content')
  await expectBackgroundRestored(page)
})

test('delete and rename dialogs isolate the document home and bottom navigation', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('marktext-for-android:drafts', JSON.stringify([{
      id: 'modal-home-draft',
      markdown: '# Modal home draft\n\nbody',
      updatedAt: '2026-07-14T08:00:00.000Z',
      lastSavedAt: '2026-07-14T08:00:00.000Z',
    }]))
  })
  await page.reload()
  await longPress(page, page.getByRole('button', { name: /Modal home draft/ }))

  const deleteButton = page.getByTestId('home-selection-delete')
  await deleteButton.click()
  const deleteSheet = page.getByTestId('home-delete-sheet')
  await expectModalContract(page, deleteSheet)
  await page.keyboard.press('Escape')
  await expect(deleteSheet).toHaveCount(0)
  await expect(deleteButton).toBeFocused()
  await expectBackgroundRestored(page)

  await page.getByTestId('home-selection-menu').click()
  const renameButton = page.getByTestId('home-selection-rename')
  await renameButton.click()
  const renameSheet = page.getByTestId('home-rename-sheet')
  await expectModalContract(page, renameSheet)
  await page.keyboard.press('Escape')
  await expect(renameSheet).toHaveCount(0)
  await expect(page.getByTestId('home-selection-menu')).toBeFocused()
  await expectBackgroundRestored(page)
})

test('maintenance dialogs isolate settings navigation and restore the trigger', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByTestId('bottom-nav-settings').click()
  await page.getByTestId('settings-entry-advanced').click()

  const trigger = page.getByTestId('settings-advanced-clear-drafts-action')
  await trigger.click()
  const sheet = page.getByTestId('settings-maintenance-sheet')
  await expectModalContract(page, sheet)
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expectBackgroundRestored(page)
})
