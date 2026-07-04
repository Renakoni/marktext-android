import { getRecentDocumentListItems, type RecentDocumentRecord } from '../../lib/recentDocuments'
import type { SettingsValue } from '../settings/settingsState'

export type DocumentSettingKey =
  | 'localDrafts'
  | 'recoveryDrafts'
  | 'autoSave'
  | 'autoSaveDelay'
  | 'startUpAction'
  | 'fileSortBy'
  | 'fileSortOrder'

export type DocumentStartupAction = 'home' | 'lastEdit' | 'blank'
export type DocumentSortBy = 'created' | 'modified' | 'title'
export type DocumentSortOrder = 'asc' | 'desc'

export interface DocumentSettings {
  localDrafts: boolean
  recoveryDrafts: boolean
  autoSave: boolean
  autoSaveDelaySeconds: number
  autoSaveDelayMs: number
  startUpAction: DocumentStartupAction
  fileSortBy: DocumentSortBy
  fileSortOrder: DocumentSortOrder
}

export const DOCUMENT_SETTING_KEYS = [
  'localDrafts',
  'recoveryDrafts',
  'autoSave',
  'autoSaveDelay',
  'startUpAction',
  'fileSortBy',
  'fileSortOrder',
] as const satisfies readonly DocumentSettingKey[]

export const DEFAULT_DOCUMENT_SETTINGS = {
  localDrafts: true,
  recoveryDrafts: true,
  autoSave: true,
  autoSaveDelaySeconds: 1,
  autoSaveDelayMs: 1000,
  startUpAction: 'home',
  fileSortBy: 'modified',
  fileSortOrder: 'desc',
} as const satisfies DocumentSettings

const STARTUP_ACTIONS = new Set<DocumentStartupAction>(['home', 'lastEdit', 'blank'])
const DOCUMENT_SORT_BY_VALUES = new Set<DocumentSortBy>(['created', 'modified', 'title'])
const DOCUMENT_SORT_ORDER_VALUES = new Set<DocumentSortOrder>(['asc', 'desc'])

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeChoice<T extends string>(value: unknown, options: Set<T>, fallback: T): T {
  return options.has(value as T) ? (value as T) : fallback
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number) {
  return Math.round(clamp(normalizeNumber(value, fallback), min, max))
}

function safeTime(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

function naturalCompare(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

export function normalizeAutoSaveDelaySeconds(value: unknown) {
  return normalizeInteger(value, DEFAULT_DOCUMENT_SETTINGS.autoSaveDelaySeconds, 1, 10)
}

export function normalizeDocumentSettingValue(key: DocumentSettingKey, value: SettingsValue) {
  switch (key) {
    case 'localDrafts':
    case 'recoveryDrafts':
    case 'autoSave':
      return normalizeBoolean(value, DEFAULT_DOCUMENT_SETTINGS[key])
    case 'autoSaveDelay':
      return normalizeAutoSaveDelaySeconds(value)
    case 'startUpAction':
      return normalizeChoice(value, STARTUP_ACTIONS, DEFAULT_DOCUMENT_SETTINGS.startUpAction)
    case 'fileSortBy':
      return normalizeChoice(value, DOCUMENT_SORT_BY_VALUES, DEFAULT_DOCUMENT_SETTINGS.fileSortBy)
    case 'fileSortOrder':
      return normalizeChoice(
        value,
        DOCUMENT_SORT_ORDER_VALUES,
        DEFAULT_DOCUMENT_SETTINGS.fileSortOrder,
      )
  }
}

export function getDocumentSettings(
  getValue: <T extends SettingsValue>(key: string, defaultValue: T) => T,
): DocumentSettings {
  const autoSaveDelaySeconds = normalizeAutoSaveDelaySeconds(
    getValue('autoSaveDelay', DEFAULT_DOCUMENT_SETTINGS.autoSaveDelaySeconds),
  )

  return {
    localDrafts: normalizeBoolean(
      getValue('localDrafts', DEFAULT_DOCUMENT_SETTINGS.localDrafts),
      DEFAULT_DOCUMENT_SETTINGS.localDrafts,
    ),
    recoveryDrafts: normalizeBoolean(
      getValue('recoveryDrafts', DEFAULT_DOCUMENT_SETTINGS.recoveryDrafts),
      DEFAULT_DOCUMENT_SETTINGS.recoveryDrafts,
    ),
    autoSave: normalizeBoolean(
      getValue('autoSave', DEFAULT_DOCUMENT_SETTINGS.autoSave),
      DEFAULT_DOCUMENT_SETTINGS.autoSave,
    ),
    autoSaveDelaySeconds,
    autoSaveDelayMs: autoSaveDelaySeconds * 1000,
    startUpAction: normalizeChoice(
      getValue('startUpAction', DEFAULT_DOCUMENT_SETTINGS.startUpAction),
      STARTUP_ACTIONS,
      DEFAULT_DOCUMENT_SETTINGS.startUpAction,
    ),
    fileSortBy: normalizeChoice(
      getValue('fileSortBy', DEFAULT_DOCUMENT_SETTINGS.fileSortBy),
      DOCUMENT_SORT_BY_VALUES,
      DEFAULT_DOCUMENT_SETTINGS.fileSortBy,
    ),
    fileSortOrder: normalizeChoice(
      getValue('fileSortOrder', DEFAULT_DOCUMENT_SETTINGS.fileSortOrder),
      DOCUMENT_SORT_ORDER_VALUES,
      DEFAULT_DOCUMENT_SETTINGS.fileSortOrder,
    ),
  }
}

export function compareRecentDocumentsForSettings(
  left: RecentDocumentRecord,
  right: RecentDocumentRecord,
  settings: Pick<DocumentSettings, 'fileSortBy' | 'fileSortOrder'>,
) {
  let result: number

  if (settings.fileSortBy === 'created') {
    result = safeTime(left.createdAt) - safeTime(right.createdAt)
  } else if (settings.fileSortBy === 'modified') {
    result = safeTime(left.updatedAt) - safeTime(right.updatedAt)
  } else {
    result = naturalCompare(left.title || left.displayName, right.title || right.displayName)
  }

  const ordered = settings.fileSortOrder === 'desc' ? -result : result
  if (ordered !== 0) {
    return ordered
  }

  const byTitle = naturalCompare(left.title || left.displayName, right.title || right.displayName)
  return byTitle !== 0 ? byTitle : left.id.localeCompare(right.id)
}

export function getSortedRecentDocumentListItems(
  records: RecentDocumentRecord[],
  settings: Pick<DocumentSettings, 'fileSortBy' | 'fileSortOrder'>,
) {
  return getRecentDocumentListItems(records).sort((left, right) =>
    compareRecentDocumentsForSettings(left, right, settings),
  )
}
