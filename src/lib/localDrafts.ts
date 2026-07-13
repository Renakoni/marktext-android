import {
  getCustomDisplayName,
  getUntitledNumber,
  hasDerivedTitle,
} from './documentState'

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

/**
 * One-time migration for drafts saved before per-draft numbering: a draft with
 * no name of its own and no content title used to fall back to the shared
 * `Untitled-1`, so several read as the same thing. Give each such draft a
 * distinct, gap-filled `Untitled-N` (oldest first) alongside any numbers that
 * are already frozen, leaving named and content-titled drafts untouched.
 * Returns the same array reference when nothing needs assigning.
 */
export function assignUntitledDraftNames(records: LocalDraftRecord[]): LocalDraftRecord[] {
  const taken = new Set<number>()
  for (const record of records) {
    const number = getUntitledNumber(record.displayName)
    if (number !== null) {
      taken.add(number)
    }
  }

  const assigned = new Map<string, string>()
  const oldestFirst = [...records].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  )
  let next = 1
  for (const record of oldestFirst) {
    const needsNumber =
      getCustomDisplayName(record.displayName ?? '') === undefined &&
      getUntitledNumber(record.displayName) === null &&
      !hasDerivedTitle(record.markdown)
    if (!needsNumber) {
      continue
    }

    while (taken.has(next)) {
      next += 1
    }
    taken.add(next)
    assigned.set(record.id, `Untitled-${next}`)
  }

  if (assigned.size === 0) {
    return records
  }

  return records.map(record =>
    assigned.has(record.id) ? { ...record, displayName: assigned.get(record.id) } : record,
  )
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
