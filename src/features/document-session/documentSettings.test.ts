import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOCUMENT_SETTINGS,
  getDocumentSettings,
  getSortedRecentDocumentListItems,
  normalizeAutoSaveDelaySeconds,
  normalizeDocumentSettingValue,
} from './documentSettings'
import type { RecentDocumentRecord } from '../../lib/recentDocuments'
import { SETTINGS_DETAIL_SECTIONS } from '../settings/settingsContent'
import { SETTINGS_PAGES } from '../settings/settingsNavigation'

const baseRecord: RecentDocumentRecord = {
  id: 'base',
  kind: 'android-document',
  displayName: 'base.md',
  title: 'Base',
  sourceUri: 'content://documents/base.md',
  providerName: 'Documents',
  pathHint: 'Documents/base.md',
  markdownPreview: null,
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:00.000Z',
  lastOpenedAt: '2026-06-29T00:00:00.000Z',
  lastSavedAt: null,
  autosaveState: 'clean',
  canWrite: true,
}

function createRecord(record: Partial<RecentDocumentRecord> & Pick<RecentDocumentRecord, 'id'>) {
  return {
    ...baseRecord,
    sourceUri: `content://documents/${record.id}.md`,
    ...record,
  }
}

describe('documentSettings', () => {
  it('uses the mobile Documents page defaults as runtime defaults', () => {
    const settings = getDocumentSettings((_, defaultValue) => defaultValue)

    expect(settings).toEqual(DEFAULT_DOCUMENT_SETTINGS)
  })

  it('keeps Documents UI defaults aligned with runtime defaults', () => {
    const defaults = new Map(
      (SETTINGS_DETAIL_SECTIONS[SETTINGS_PAGES.DOCUMENTS] ?? [])
        .flatMap(section => section.rows)
        .filter(row => 'defaultValue' in row)
        .map(row => [row.id, row.defaultValue]),
    )

    expect(defaults.get('localDrafts')).toBe(DEFAULT_DOCUMENT_SETTINGS.localDrafts)
    expect(defaults.get('recoveryDrafts')).toBe(DEFAULT_DOCUMENT_SETTINGS.recoveryDrafts)
    expect(defaults.get('autoSave')).toBe(DEFAULT_DOCUMENT_SETTINGS.autoSave)
    expect(defaults.get('autoSaveDelay')).toBe(DEFAULT_DOCUMENT_SETTINGS.autoSaveDelaySeconds)
    expect(defaults.get('startUpAction')).toBe(DEFAULT_DOCUMENT_SETTINGS.startUpAction)
    expect(defaults.get('fileSortBy')).toBe(DEFAULT_DOCUMENT_SETTINGS.fileSortBy)
    expect(defaults.get('fileSortOrder')).toBe(DEFAULT_DOCUMENT_SETTINGS.fileSortOrder)
  })

  it('normalizes stored values before applying document behavior', () => {
    const values = new Map<string, boolean | number | string>([
      ['localDrafts', false],
      ['recoveryDrafts', false],
      ['autoSave', false],
      ['autoSaveDelay', '8'],
      ['startUpAction', 'lastEdit'],
      ['fileSortBy', 'title'],
      ['fileSortOrder', 'desc'],
    ])

    const settings = getDocumentSettings((key, defaultValue) =>
      values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue,
    )

    expect(settings).toEqual({
      localDrafts: false,
      recoveryDrafts: false,
      autoSave: false,
      autoSaveDelaySeconds: 8,
      autoSaveDelayMs: 8000,
      startUpAction: 'lastEdit',
      fileSortBy: 'title',
      fileSortOrder: 'desc',
    })
  })

  it('falls back on invalid document values and clamps save delay', () => {
    const values = new Map<string, boolean | number | string>([
      ['localDrafts', 'false'],
      ['recoveryDrafts', 'false'],
      ['autoSave', 'false'],
      ['autoSaveDelay', 99],
      ['startUpAction', 'restoreAll'],
      ['fileSortBy', 'path'],
      ['fileSortOrder', 'newest'],
    ])

    const settings = getDocumentSettings((key, defaultValue) =>
      values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue,
    )

    expect(settings).toEqual({
      ...DEFAULT_DOCUMENT_SETTINGS,
      autoSaveDelaySeconds: 10,
      autoSaveDelayMs: 10000,
    })
    expect(normalizeAutoSaveDelaySeconds(0)).toBe(1)
    expect(normalizeDocumentSettingValue('autoSaveDelay', '2')).toBe(2)
  })

  it('sorts recent documents by the selected mobile document setting', () => {
    const records = [
      createRecord({
        id: 'bravo',
        title: 'Note 10',
        createdAt: '2026-06-29T00:02:00.000Z',
        updatedAt: '2026-06-29T00:01:00.000Z',
        lastOpenedAt: '2026-06-29T00:01:00.000Z',
      }),
      createRecord({
        id: 'alpha',
        title: 'Note 2',
        createdAt: '2026-06-29T00:01:00.000Z',
        updatedAt: '2026-06-29T00:03:00.000Z',
        lastOpenedAt: '2026-06-29T00:03:00.000Z',
      }),
      createRecord({
        id: 'charlie',
        title: 'Archive',
        createdAt: '2026-06-29T00:03:00.000Z',
        updatedAt: '2026-06-29T00:02:00.000Z',
        lastOpenedAt: '2026-06-29T00:02:00.000Z',
      }),
    ]

    expect(
      getSortedRecentDocumentListItems(records, { fileSortBy: 'created', fileSortOrder: 'asc' })
        .map(record => record.id),
    ).toEqual(['alpha', 'bravo', 'charlie'])
    expect(
      getSortedRecentDocumentListItems(records, { fileSortBy: 'modified', fileSortOrder: 'desc' })
        .map(record => record.id),
    ).toEqual(['alpha', 'charlie', 'bravo'])
    expect(
      getSortedRecentDocumentListItems(records, { fileSortBy: 'title', fileSortOrder: 'asc' })
        .map(record => record.id),
    ).toEqual(['charlie', 'alpha', 'bravo'])
  })
})
