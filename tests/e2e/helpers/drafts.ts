import type { Page } from '@playwright/test'
import { expectEditorReady } from './editor'

export const DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'
export const SETTINGS_STORAGE_KEY = 'marktext-for-android:settings-ui'

interface OpenLocalDraftOptions {
  id: string
  markdown: string
  title: RegExp
  now?: string
  settings?: Record<string, boolean | number | string>
}

export async function newBlankDocument(
  page: Page,
  settings: Record<string, unknown> = {},
) {
  await page.goto('/')
  await page.evaluate(
    ({ settings, settingsStorageKey }) => {
      localStorage.clear()
      if (Object.keys(settings).length > 0) {
        localStorage.setItem(settingsStorageKey, JSON.stringify(settings))
      }
    },
    { settings, settingsStorageKey: SETTINGS_STORAGE_KEY },
  )
  await page.reload()
  await page.getByTestId('new-document-button').click()
  await expectEditorReady(page)
}

export async function openLocalDraft(
  page: Page,
  {
    id,
    markdown,
    title,
    now = '2026-07-01T09:00:00.000Z',
    settings = {},
  }: OpenLocalDraftOptions,
) {
  await page.goto('/')
  await page.evaluate(
    ({ draftsStorageKey, id, markdown, now, settings, settingsStorageKey }) => {
      localStorage.clear()
      localStorage.setItem(
        draftsStorageKey,
        JSON.stringify([{ id, markdown, updatedAt: now, lastSavedAt: now }]),
      )
      if (Object.keys(settings).length > 0) {
        localStorage.setItem(settingsStorageKey, JSON.stringify(settings))
      }
    },
    {
      draftsStorageKey: DRAFTS_STORAGE_KEY,
      id,
      markdown,
      now,
      settings,
      settingsStorageKey: SETTINGS_STORAGE_KEY,
    },
  )
  await page.reload()
  await page.getByRole('button', { name: title }).click()
  await expectEditorReady(page)
}

export function getDraftStorage(page: Page) {
  return page.evaluate(key => localStorage.getItem(key) ?? '', DRAFTS_STORAGE_KEY)
}

export function getStoredDraftMarkdown(page: Page) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return ''
    }
    const [draft] = JSON.parse(raw) as Array<{ markdown: string }>
    return draft?.markdown ?? ''
  }, DRAFTS_STORAGE_KEY)
}
