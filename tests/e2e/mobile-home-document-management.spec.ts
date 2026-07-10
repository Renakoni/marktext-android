import { expect, test } from '@playwright/test'
import { installAndroidAppMock, longPress } from './helpers/androidAppMock'

test.describe.configure({ timeout: 60000 })

test('manages home documents through long-press selection mode', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:drafts',
      JSON.stringify([
        {
          id: 'selection-newer',
          markdown: '# Continue selection note\n\nbody',
          updatedAt: '2026-07-01T08:00:00.000Z',
          lastSavedAt: '2026-07-01T08:00:00.000Z',
        },
        {
          id: 'selection-older',
          markdown: '# Earlier selection note\n\nbody',
          updatedAt: '2026-07-01T07:00:00.000Z',
          lastSavedAt: '2026-07-01T07:00:00.000Z',
        },
      ]),
    )
  })
  await page.reload()

  // Long-press an Earlier row: selection mode starts with that row selected,
  // and the release click must not immediately toggle it back off.
  const earlierRow = page.getByRole('button', { name: /Earlier selection note/ })
  await longPress(page, earlierRow)

  await expect(page.getByTestId('home-selection-bar')).toBeVisible()
  await expect(page.getByTestId('home-selection-count')).toHaveText('1')
  await expect(page.getByTestId('open-file-button')).not.toBeVisible()

  // Tapping the Continue masthead toggles it into the selection.
  const mastheadRow = page.getByRole('button', { name: /Continue selection note/ })
  await mastheadRow.click()
  await expect(page.getByTestId('home-selection-count')).toHaveText('2')

  // Canceling the delete confirmation keeps the selection intact.
  await page.getByTestId('home-selection-delete').click()
  await expect(page.getByTestId('home-delete-sheet')).toBeVisible()
  await page.getByTestId('home-delete-cancel').click()
  await expect(page.getByTestId('home-delete-sheet')).not.toBeVisible()
  await expect(page.getByTestId('home-selection-count')).toHaveText('2')

  // Deselect the masthead, then delete the remaining draft for real.
  await mastheadRow.click()
  await expect(page.getByTestId('home-selection-count')).toHaveText('1')
  await page.getByTestId('home-selection-delete').click()
  await page.getByTestId('home-delete-confirm').click()

  await expect(page.getByTestId('home-selection-bar')).not.toBeVisible()
  await expect(page.getByTestId('open-file-button')).toBeVisible()
  await expect(earlierRow).not.toBeVisible()
  await expect(mastheadRow).toBeVisible()

  const drafts = await page.evaluate(
    () => localStorage.getItem('marktext-for-android:drafts') ?? '',
  )
  expect(drafts).toContain('Continue selection note')
  expect(drafts).not.toContain('Earlier selection note')
})

test('drops a renamed Android recent when only temporary access remains', async ({ page }) => {
  const oldUri = 'content://test/rename-temporary'
  const newUri = 'content://test/renamed-trip-plan'
  const now = '2026-07-01T08:00:00.000Z'
  const document = {
    sourceUri: oldUri,
    displayName: 'notes.md',
    markdown: '# notes\n\nRecovered edits.',
    renameResult: {
      sourceUri: newUri,
      displayName: 'trip-plan.md',
      persisted: false,
    },
  }

  await installAndroidAppMock(page, document)
  await page.goto('/')
  await page.evaluate(({ document, now, oldUri }) => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:recent-documents',
      JSON.stringify([
        {
          id: `android-document:${oldUri}`,
          kind: 'android-document',
          displayName: document.displayName,
          title: 'notes',
          sourceUri: oldUri,
          providerName: 'Test Documents',
          pathHint: document.displayName,
          markdownPreview: null,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          lastSavedAt: null,
          autosaveState: 'clean',
          canWrite: true,
        },
      ]),
    )
    localStorage.setItem(
      'marktext-for-android:drafts',
      JSON.stringify([
        {
          id: `android-recovery:${oldUri}`,
          markdown: '# notes\n\nRecovered edits.',
          createdAt: now,
          updatedAt: now,
          lastSavedAt: null,
        },
      ]),
    )
    localStorage.setItem(
      'marktext-for-android:pinned-documents',
      JSON.stringify([{ id: `android-document:${oldUri}`, pinnedAt: now }]),
    )
  }, { document, now, oldUri })
  await page.reload()

  const row = page.getByRole('button', { name: /notes/ }).first()
  await longPress(page, row)
  await page.getByTestId('home-selection-menu').click()
  await page.getByTestId('home-selection-rename').click()
  await page.getByTestId('home-rename-input').fill('trip-plan')
  await page.getByTestId('home-rename-confirm').click()

  await expect(
    page.getByText(
      'Renamed, but Android only kept temporary access. Reopen it from Android to add it back to Recents.',
    ),
  ).toBeVisible()

  const storage = await page.evaluate(() => ({
    recents: localStorage.getItem('marktext-for-android:recent-documents') ?? '',
    drafts: localStorage.getItem('marktext-for-android:drafts') ?? '',
    pins: localStorage.getItem('marktext-for-android:pinned-documents') ?? '',
  }))
  expect(storage.recents).not.toContain(oldUri)
  expect(storage.recents).not.toContain(newUri)
  expect(storage.drafts).not.toContain(`android-recovery:${oldUri}`)
  expect(storage.drafts).toContain(`android-recovery:${newUri}`)
  expect(storage.pins).not.toContain(oldUri)
  expect(storage.pins).not.toContain(newUri)
})

test('keeps recovery content when removing an Android document from Recents', async ({ page }) => {
  const sourceUri = 'content://test/recovery-must-survive'
  const now = '2026-07-01T08:00:00.000Z'

  await page.goto('/')
  await page.evaluate(({ sourceUri, now }) => {
    localStorage.clear()
    localStorage.setItem(
      'marktext-for-android:recent-documents',
      JSON.stringify([
        {
          id: `android-document:${sourceUri}`,
          kind: 'android-document',
          displayName: 'Device note.md',
          title: 'Device note',
          sourceUri,
          providerName: 'Test Documents',
          pathHint: 'Device note.md',
          markdownPreview: null,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          lastSavedAt: null,
          autosaveState: 'save-failed',
          canWrite: true,
        },
      ]),
    )
    localStorage.setItem(
      'marktext-for-android:drafts',
      JSON.stringify([
        {
          id: `android-recovery:${sourceUri}`,
          markdown: '# Unsaved recovery\n\nOnly local copy.',
          createdAt: now,
          updatedAt: now,
          lastSavedAt: null,
        },
      ]),
    )
  }, { sourceUri, now })
  await page.reload()

  const row = page.getByRole('button', { name: /Device note/ })
  await longPress(page, row)

  const deleteButton = page.getByTestId('home-selection-delete')
  await deleteButton.click()
  await expect(page.getByTestId('home-delete-cancel')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('home-delete-confirm')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('home-delete-sheet')).not.toBeVisible()
  await expect(deleteButton).toBeFocused()

  await deleteButton.click()
  await page.getByTestId('home-delete-confirm').click()

  const storage = await page.evaluate(() => ({
    recents: localStorage.getItem('marktext-for-android:recent-documents') ?? '',
    drafts: localStorage.getItem('marktext-for-android:drafts') ?? '',
  }))
  expect(storage.recents).not.toContain(sourceUri)
  expect(storage.drafts).toContain(`android-recovery:${sourceUri}`)
  expect(storage.drafts).toContain('Only local copy.')
})
