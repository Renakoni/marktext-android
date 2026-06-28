import {
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
  updatedAt: string
  lastSavedAt: string | null
}

const DEFAULT_RECENT_LIMIT = 50

function isRecentDocumentKind(value: unknown): value is RecentDocumentKind {
  return value === 'local-draft' || value === 'android-document' || value === 'incoming-document'
}

function isAutosaveState(value: unknown): value is AutosaveState {
  return value === 'clean' || value === 'dirty' || value === 'saving' || value === 'save-failed'
}

function isRecentDocumentRecord(value: unknown): value is RecentDocumentRecord {
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
    typeof record.updatedAt === 'string' &&
    typeof record.lastOpenedAt === 'string' &&
    (typeof record.lastSavedAt === 'string' || record.lastSavedAt === null) &&
    isAutosaveState(record.autosaveState) &&
    (typeof record.canWrite === 'boolean' || record.canWrite === null)
  )
}

function getRecentDocumentKey(record: RecentDocumentRecord) {
  return record.sourceUri ? `${record.kind}:${record.sourceUri}` : `${record.kind}:${record.id}`
}

function getRecentDocumentSortTime(record: RecentDocumentRecord) {
  return Math.max(Date.parse(record.updatedAt), Date.parse(record.lastOpenedAt))
}

function compareRecentDocuments(left: RecentDocumentRecord, right: RecentDocumentRecord) {
  return getRecentDocumentSortTime(right) - getRecentDocumentSortTime(left)
}

export function createRecentDocumentFromLocalDraft(
  draft: LocalDraftSource,
): RecentDocumentRecord {
  const title = getDocumentTitle(draft.markdown)

  return {
    id: draft.id,
    kind: 'local-draft',
    displayName: title,
    title,
    sourceUri: null,
    providerName: 'Local draft',
    pathHint: null,
    markdownPreview: draft.markdown,
    updatedAt: draft.updatedAt,
    lastOpenedAt: draft.updatedAt,
    lastSavedAt: draft.lastSavedAt,
    autosaveState: 'clean',
    canWrite: true,
  }
}

export function normalizeRecentDocuments(
  records: RecentDocumentRecord[],
  limit = DEFAULT_RECENT_LIMIT,
) {
  const seen = new Set<string>()
  const normalized: RecentDocumentRecord[] = []

  for (const record of [...records].sort(compareRecentDocuments)) {
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

    return normalizeRecentDocuments(parsed.filter(isRecentDocumentRecord))
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

  return normalizeRecentDocuments(
    [nextRecord, ...records.filter(record => getRecentDocumentKey(record) !== nextKey)],
    limit,
  )
}

export function getRecentDocumentListItems(
  records: RecentDocumentRecord[],
): RecentDocumentListItem[] {
  return normalizeRecentDocuments(records).map(record => ({
    ...record,
    stats: record.markdownPreview ? getDocumentStats(record.markdownPreview) : null,
  }))
}
