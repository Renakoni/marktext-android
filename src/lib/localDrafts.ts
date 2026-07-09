export interface LocalDraftRecord {
  id: string
  markdown: string
  createdAt: string
  updatedAt: string
  lastSavedAt: string | null
  /** Explicit user-chosen name; when set it beats content-derived titles. */
  displayName?: string
}

type StoredLocalDraftRecord = Omit<LocalDraftRecord, 'createdAt'> & {
  createdAt?: string
}

const DEFAULT_DRAFT_LIMIT = 20

function isStoredLocalDraftRecord(value: unknown): value is StoredLocalDraftRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<LocalDraftRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.markdown === 'string' &&
    (typeof record.createdAt === 'string' || record.createdAt === undefined) &&
    typeof record.updatedAt === 'string' &&
    (typeof record.lastSavedAt === 'string' || record.lastSavedAt === null) &&
    (typeof record.displayName === 'string' || record.displayName === undefined)
  )
}

function normalizeLocalDraftRecord(record: StoredLocalDraftRecord): LocalDraftRecord {
  return {
    ...record,
    createdAt: record.createdAt ?? record.updatedAt,
  }
}

function compareDraftsByUpdateTime(left: StoredLocalDraftRecord, right: StoredLocalDraftRecord) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
}

export function normalizeLocalDrafts(
  records: StoredLocalDraftRecord[],
  limit = DEFAULT_DRAFT_LIMIT,
) {
  const seen = new Set<string>()
  const normalized: LocalDraftRecord[] = []

  for (const rawRecord of [...records].sort(compareDraftsByUpdateTime)) {
    const record = normalizeLocalDraftRecord(rawRecord)
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

    return normalizeLocalDrafts(parsed.filter(isStoredLocalDraftRecord))
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
  const existingDraft = records.find(record => record.id === draft.id)
  const nextDraft = {
    ...draft,
    createdAt: existingDraft?.createdAt ?? draft.createdAt,
    displayName: draft.displayName ?? existingDraft?.displayName,
  }

  return normalizeLocalDrafts(
    [nextDraft, ...records.filter(record => record.id !== draft.id)],
    limit,
  )
}

export function removeLocalDraft(records: LocalDraftRecord[], id: string) {
  return records.filter(record => record.id !== id)
}

export function renameLocalDraft(records: LocalDraftRecord[], id: string, displayName: string) {
  const trimmedName = displayName.trim()

  // A rename needs a name; the rename sheet enforces this, and treating an
  // empty one as a no-op keeps the helper safe for any caller.
  if (!trimmedName) {
    return records
  }

  return records.map(record =>
    record.id === id ? { ...record, displayName: trimmedName } : record,
  )
}
