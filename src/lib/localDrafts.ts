import { getDocumentStats, getDocumentTitle, type DocumentStats } from './documentState'

export interface LocalDraftRecord {
  id: string
  markdown: string
  updatedAt: string
  lastSavedAt: string | null
}

export interface LocalDraftListItem {
  id: string
  title: string
  markdown: string
  updatedAt: string
  lastSavedAt: string | null
  stats: DocumentStats
}

const DEFAULT_DRAFT_LIMIT = 20

function isLocalDraftRecord(value: unknown): value is LocalDraftRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<LocalDraftRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.markdown === 'string' &&
    typeof record.updatedAt === 'string' &&
    (typeof record.lastSavedAt === 'string' || record.lastSavedAt === null)
  )
}

function compareDraftsByUpdateTime(left: LocalDraftRecord, right: LocalDraftRecord) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
}

export function normalizeLocalDrafts(records: LocalDraftRecord[], limit = DEFAULT_DRAFT_LIMIT) {
  const seen = new Set<string>()
  const normalized: LocalDraftRecord[] = []

  for (const record of [...records].sort(compareDraftsByUpdateTime)) {
    if (seen.has(record.id) || !record.markdown.trim()) {
      continue
    }

    seen.add(record.id)
    normalized.push(record)
  }

  return normalized.slice(0, limit)
}

export function parseLocalDrafts(value: string | null) {
  if (!value) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return normalizeLocalDrafts(parsed.filter(isLocalDraftRecord))
  } catch {
    return []
  }
}

export function serializeLocalDrafts(records: LocalDraftRecord[]) {
  return JSON.stringify(normalizeLocalDrafts(records))
}

export function upsertLocalDraft(
  records: LocalDraftRecord[],
  draft: LocalDraftRecord,
  limit = DEFAULT_DRAFT_LIMIT,
) {
  return normalizeLocalDrafts(
    [draft, ...records.filter(record => record.id !== draft.id)],
    limit,
  )
}

export function removeLocalDraft(records: LocalDraftRecord[], id: string) {
  return records.filter(record => record.id !== id)
}

export function getLocalDraftListItems(records: LocalDraftRecord[]): LocalDraftListItem[] {
  return normalizeLocalDrafts(records).map(record => ({
    ...record,
    title: getDocumentTitle(record.markdown),
    stats: getDocumentStats(record.markdown),
  }))
}
