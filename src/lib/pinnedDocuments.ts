export interface PinnedDocumentRecord {
  id: string
  pinnedAt: string
}

const DEFAULT_PINNED_LIMIT = 50

function isPinnedDocumentRecord(value: unknown): value is PinnedDocumentRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<PinnedDocumentRecord>
  return typeof record.id === 'string' && typeof record.pinnedAt === 'string'
}

function comparePinsByPinTime(left: PinnedDocumentRecord, right: PinnedDocumentRecord) {
  return Date.parse(right.pinnedAt) - Date.parse(left.pinnedAt)
}

export function normalizePinnedDocuments(
  records: PinnedDocumentRecord[],
  limit = DEFAULT_PINNED_LIMIT,
) {
  const seen = new Set<string>()
  const normalized: PinnedDocumentRecord[] = []

  for (const record of [...records].sort(comparePinsByPinTime)) {
    if (seen.has(record.id) || !record.id) {
      continue
    }

    seen.add(record.id)
    normalized.push(record)
  }

  return normalized.slice(0, limit)
}

export function parsePinnedDocuments(value: string | null) {
  if (!value) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    return normalizePinnedDocuments(parsed.filter(isPinnedDocumentRecord))
  } catch {
    return []
  }
}

export function serializePinnedDocuments(records: PinnedDocumentRecord[]) {
  return JSON.stringify(normalizePinnedDocuments(records))
}

export function getPinnedDocumentIds(records: PinnedDocumentRecord[]) {
  return new Set(records.map(record => record.id))
}

export function areAllDocumentsPinned(records: PinnedDocumentRecord[], ids: readonly string[]) {
  if (ids.length === 0) {
    return false
  }

  const pinnedIds = getPinnedDocumentIds(records)
  return ids.every(id => pinnedIds.has(id))
}

/**
 * Pins every id that is not pinned yet; if the whole selection is already
 * pinned, unpins it instead (Telegram semantics). Existing pin times are
 * preserved so re-pinning part of a selection never reshuffles the block.
 */
export function togglePinnedDocuments(
  records: PinnedDocumentRecord[],
  ids: readonly string[],
  pinnedAt: string,
) {
  if (areAllDocumentsPinned(records, ids)) {
    const removed = new Set(ids)
    return records.filter(record => !removed.has(record.id))
  }

  const pinnedIds = getPinnedDocumentIds(records)
  const added = ids
    .filter(id => !pinnedIds.has(id))
    .map(id => ({ id, pinnedAt }))

  return normalizePinnedDocuments([...added, ...records])
}

export function prunePinnedDocuments(
  records: PinnedDocumentRecord[],
  existingIds: Iterable<string>,
) {
  const keep = new Set(existingIds)
  return records.filter(record => keep.has(record.id))
}
