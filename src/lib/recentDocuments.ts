import {
  getCustomDisplayName,
  getDocumentStats,
  getDocumentTitle,
  type AutosaveState,
  type DocumentStats,
} from './documentState'

export type RecentDocumentKind = 'local-draft' | 'android-document' | 'incoming-document'

export interface RecentDocumentRecord {
  id: string
  kind: RecentDocumentKind
  displayName: string
  title: string
  sourceUri: string | null
  providerName: string | null
  pathHint: string | null
  markdownPreview: string | null
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  lastSavedAt: string | null
  autosaveState: AutosaveState
  canWrite: boolean | null
}

export interface RecentDocumentListItem extends RecentDocumentRecord {
  stats: DocumentStats | null
}

interface LocalDraftSource {
  id: string
  markdown: string
  createdAt?: string
  updatedAt: string
  lastSavedAt: string | null
  displayName?: string
}

interface AndroidDocumentSource {
  sourceUri: string
  displayName: string
  providerName: string | null
  pathHint: string | null
  markdown: string
  canWrite: boolean
  openedAt?: string
}

interface SavedDocumentOptions {
  markdown: string
  savedAt?: string
  canWrite?: boolean
}

type StoredRecentDocumentRecord = Omit<RecentDocumentRecord, 'createdAt'> & {
  createdAt?: string
}

const DEFAULT_RECENT_LIMIT = 50

function isRecentDocumentKind(value: unknown): value is RecentDocumentKind {
  return value === 'local-draft' || value === 'android-document' || value === 'incoming-document'
}

function isAutosaveState(value: unknown): value is AutosaveState {
  return value === 'clean' || value === 'dirty' || value === 'saving' || value === 'save-failed'
}

function isStoredRecentDocumentRecord(value: unknown): value is StoredRecentDocumentRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<RecentDocumentRecord>
  return (
    typeof record.id === 'string' &&
    isRecentDocumentKind(record.kind) &&
    typeof record.displayName === 'string' &&
    typeof record.title === 'string' &&
    (typeof record.sourceUri === 'string' || record.sourceUri === null) &&
    (typeof record.providerName === 'string' || record.providerName === null) &&
    (typeof record.pathHint === 'string' || record.pathHint === null) &&
    (typeof record.markdownPreview === 'string' || record.markdownPreview === null) &&
    (typeof record.createdAt === 'string' || record.createdAt === undefined) &&
    typeof record.updatedAt === 'string' &&
    typeof record.lastOpenedAt === 'string' &&
    (typeof record.lastSavedAt === 'string' || record.lastSavedAt === null) &&
    isAutosaveState(record.autosaveState) &&
    (typeof record.canWrite === 'boolean' || record.canWrite === null)
  )
}

function normalizeRecentDocumentRecord(record: StoredRecentDocumentRecord): RecentDocumentRecord {
  return {
    ...record,
    createdAt: record.createdAt ?? record.lastOpenedAt ?? record.updatedAt,
  }
}

function getRecentDocumentKey(record: Pick<RecentDocumentRecord, 'id' | 'kind' | 'sourceUri'>) {
  return record.sourceUri ? `${record.kind}:${record.sourceUri}` : `${record.kind}:${record.id}`
}

function getRecentDocumentSortTime(
  record: Pick<RecentDocumentRecord, 'updatedAt' | 'lastOpenedAt'>,
) {
  return Math.max(Date.parse(record.updatedAt), Date.parse(record.lastOpenedAt))
}

function compareRecentDocuments(
  left: Pick<RecentDocumentRecord, 'updatedAt' | 'lastOpenedAt'>,
  right: Pick<RecentDocumentRecord, 'updatedAt' | 'lastOpenedAt'>,
) {
  return getRecentDocumentSortTime(right) - getRecentDocumentSortTime(left)
}

export function createRecentDocumentFromLocalDraft(draft: LocalDraftSource): RecentDocumentRecord {
  // An explicit rename is the draft's identity: it wins over content-derived
  // titles, headings included. A stored Untitled-N is not a rename — it is the
  // draft's placeholder identity, so a content title still wins over it, and
  // it only surfaces (via getDocumentTitle's own fallback) when the draft has
  // no title of its own.
  const customName = getCustomDisplayName(draft.displayName ?? '')
  const title = customName || getDocumentTitle(draft.markdown, draft.displayName ?? undefined)

  return {
    id: draft.id,
    kind: 'local-draft',
    displayName: title,
    title,
    sourceUri: null,
    providerName: 'Local draft',
    pathHint: null,
    markdownPreview: draft.markdown,
    createdAt: draft.createdAt ?? draft.updatedAt,
    updatedAt: draft.updatedAt,
    lastOpenedAt: draft.updatedAt,
    lastSavedAt: draft.lastSavedAt,
    autosaveState: 'clean',
    canWrite: true,
  }
}

export function createRecentDocumentFromAndroidDocument(
  document: AndroidDocumentSource,
): RecentDocumentRecord {
  const openedAt = document.openedAt ?? new Date().toISOString()
  const title = getDocumentTitle(document.markdown, document.displayName)

  return {
    id: `android-document:${document.sourceUri}`,
    kind: 'android-document',
    displayName: document.displayName,
    title,
    sourceUri: document.sourceUri,
    providerName: document.providerName,
    pathHint: document.pathHint,
    markdownPreview: null,
    createdAt: openedAt,
    updatedAt: openedAt,
    lastOpenedAt: openedAt,
    lastSavedAt: null,
    autosaveState: 'clean',
    canWrite: document.canWrite,
  }
}

export function normalizeRecentDocuments(
  records: StoredRecentDocumentRecord[],
  limit = DEFAULT_RECENT_LIMIT,
) {
  const seen = new Set<string>()
  const normalized: RecentDocumentRecord[] = []

  for (const rawRecord of [...records].sort(compareRecentDocuments)) {
    const record = normalizeRecentDocumentRecord(rawRecord)
    const key = getRecentDocumentKey(record)
    if (seen.has(key)) {
      continue
    }

    if (record.kind === 'local-draft' && !record.markdownPreview?.trim()) {
      continue
    }

    seen.add(key)
    normalized.push(record)
  }

  return normalized.slice(0, limit)
}

export function parseRecentDocuments(value: string | null) {
  if (!value) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return normalizeRecentDocuments(parsed.filter(isStoredRecentDocumentRecord))
  } catch {
    return []
  }
}

export function serializeRecentDocuments(records: RecentDocumentRecord[]) {
  return JSON.stringify(normalizeRecentDocuments(records))
}

export function upsertRecentDocument(
  records: RecentDocumentRecord[],
  nextRecord: RecentDocumentRecord,
  limit = DEFAULT_RECENT_LIMIT,
) {
  const nextKey = getRecentDocumentKey(nextRecord)
  const existingRecord = records.find(record => getRecentDocumentKey(record) === nextKey)
  const nextRecordWithCreatedAt = {
    ...nextRecord,
    createdAt: existingRecord?.createdAt ?? nextRecord.createdAt,
  }

  return normalizeRecentDocuments(
    [
      nextRecordWithCreatedAt,
      ...records.filter(record => getRecentDocumentKey(record) !== nextKey),
    ],
    limit,
  )
}

export function markRecentDocumentSaved(
  record: RecentDocumentRecord,
  options: SavedDocumentOptions,
): RecentDocumentRecord {
  const savedAt = options.savedAt ?? new Date().toISOString()

  return {
    ...record,
    title: getDocumentTitle(options.markdown, record.displayName),
    updatedAt: savedAt,
    lastSavedAt: savedAt,
    autosaveState: 'clean',
    canWrite: options.canWrite ?? record.canWrite,
  }
}

export function getRecentDocumentListItems(
  records: RecentDocumentRecord[],
): RecentDocumentListItem[] {
  return normalizeRecentDocuments(records).map(record => ({
    ...record,
    stats: record.markdownPreview ? getDocumentStats(record.markdownPreview) : null,
  }))
}
