export const RESUME_POSITIONS_STORAGE_KEY = 'marktext-for-android:resume-positions'
export const RESUME_POSITION_SCHEMA_VERSION = 1
// Bounded retention: positions are convenience state, not documents. The
// newest records by capture time win; orphans (deleted drafts, renamed URIs)
// age out through the same cap instead of hooking into delete/rename flows.
export const MAX_RESUME_POSITIONS = 30
export const RESUME_DISPLAY_TEXT_MAX_LENGTH = 64

/**
 * One saved reading/editing position. The identity guarantee is the SHA-256
 * of the canonicalized Markdown plus its length as a fast pre-check;
 * `displayText` is presentation-only and must never participate in
 * validation or target resolution.
 */
export interface ResumePositionRecord {
  schemaVersion: typeof RESUME_POSITION_SCHEMA_VERSION
  capturedAt: string
  normalizedLength: number
  markdownSha256: string
  /** Index into the FULL top-level block sequence, front matter included. */
  topBlockIndex: number
  /** Viewport-top position inside that block, 0..1. */
  topBlockRatio: number
  displayText: string
}

interface ResumePositionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const SHA256_HEX_REGEXP = /^[0-9a-f]{64}$/

/**
 * Canonical form for hashing. Both sides of the comparison read the live
 * Muya instance (`getMarkdown()` always emits LF), so this only has to
 * neutralize churn the save pipeline may add on disk and the reopen path
 * feeds back through Muya: CRLF conversion and trailing-newline trimming
 * (`prepareMarkdownForSave` modes). Interior content differences always
 * change the hash.
 */
export function canonicalizeMarkdownForResume(markdown: string) {
  return markdown.replace(/\r\n|\r/g, '\n').replace(/\n+$/, '')
}

/** Collapse whitespace and cap at a code-point length that fits the card. */
export function normalizeResumeDisplayText(text: string) {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  // Slice by code points so a CJK/emoji boundary never yields a lone surrogate.
  return [...collapsed].slice(0, RESUME_DISPLAY_TEXT_MAX_LENGTH).join('').trim()
}

/**
 * SHA-256 hex digest via WebCrypto. Returns null when the runtime has no
 * SubtleCrypto — callers must treat that as "no identity guarantee" and
 * skip capture/restore entirely rather than fall back to a weaker hash.
 */
export async function sha256Hex(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    return null
  }

  try {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function isStoredResumePositionRecord(value: unknown): value is ResumePositionRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Partial<ResumePositionRecord>
  return (
    record.schemaVersion === RESUME_POSITION_SCHEMA_VERSION &&
    typeof record.capturedAt === 'string' &&
    Number.isInteger(record.normalizedLength) &&
    (record.normalizedLength as number) >= 0 &&
    typeof record.markdownSha256 === 'string' &&
    SHA256_HEX_REGEXP.test(record.markdownSha256) &&
    Number.isInteger(record.topBlockIndex) &&
    (record.topBlockIndex as number) >= 0 &&
    typeof record.topBlockRatio === 'number' &&
    Number.isFinite(record.topBlockRatio) &&
    record.topBlockRatio >= 0 &&
    record.topBlockRatio <= 1 &&
    typeof record.displayText === 'string'
  )
}

function parseStoredResumePositions(value: string | null): Record<string, ResumePositionRecord> {
  if (!value) {
    return {}
  }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const records: Record<string, ResumePositionRecord> = {}
    for (const [docKey, record] of Object.entries(parsed)) {
      if (isStoredResumePositionRecord(record)) {
        records[docKey] = record
      }
    }

    return records
  } catch {
    return {}
  }
}

function pruneResumePositions(records: Record<string, ResumePositionRecord>) {
  const entries = Object.entries(records)
  if (entries.length <= MAX_RESUME_POSITIONS) {
    return records
  }

  entries.sort(([, left], [, right]) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt))
  return Object.fromEntries(entries.slice(0, MAX_RESUME_POSITIONS))
}

// Storage failures (quota, disabled storage) must never break an exit or
// open flow; a lost position only costs one resume opportunity.
function writeResumePositionsSafely(
  records: Record<string, ResumePositionRecord>,
  storage: ResumePositionStorage,
) {
  try {
    if (Object.keys(records).length > 0) {
      storage.setItem(RESUME_POSITIONS_STORAGE_KEY, JSON.stringify(records))
    } else {
      storage.removeItem(RESUME_POSITIONS_STORAGE_KEY)
    }
  } catch {
    // Fail safe: keep whatever was stored before.
  }
}

export function readStoredResumePosition(
  docKey: string,
  storage: ResumePositionStorage = localStorage,
): ResumePositionRecord | null {
  try {
    return parseStoredResumePositions(storage.getItem(RESUME_POSITIONS_STORAGE_KEY))[docKey] ?? null
  } catch {
    return null
  }
}

export function writeStoredResumePosition(
  docKey: string,
  record: ResumePositionRecord,
  storage: ResumePositionStorage = localStorage,
) {
  try {
    const records = parseStoredResumePositions(storage.getItem(RESUME_POSITIONS_STORAGE_KEY))
    records[docKey] = record
    writeResumePositionsSafely(pruneResumePositions(records), storage)
  } catch {
    // Fail safe: a position that cannot be stored is silently dropped.
  }
}

export function removeStoredResumePosition(
  docKey: string,
  storage: ResumePositionStorage = localStorage,
) {
  try {
    const records = parseStoredResumePositions(storage.getItem(RESUME_POSITIONS_STORAGE_KEY))
    if (!(docKey in records)) {
      return
    }

    delete records[docKey]
    writeResumePositionsSafely(records, storage)
  } catch {
    // Fail safe.
  }
}

export interface CreateResumePositionRecordOptions {
  markdown: string
  topBlockIndex: number
  topBlockRatio: number
  displayText: string
  capturedAt?: string
}

/**
 * Build a validated record from a live capture. Returns null when no
 * SHA-256 implementation is available — no record beats an unverifiable one.
 */
export async function createResumePositionRecord({
  markdown,
  topBlockIndex,
  topBlockRatio,
  displayText,
  capturedAt,
}: CreateResumePositionRecordOptions): Promise<ResumePositionRecord | null> {
  const canonical = canonicalizeMarkdownForResume(markdown)
  const markdownSha256 = await sha256Hex(canonical)
  if (!markdownSha256) {
    return null
  }

  return {
    schemaVersion: RESUME_POSITION_SCHEMA_VERSION,
    capturedAt: capturedAt ?? new Date().toISOString(),
    normalizedLength: canonical.length,
    markdownSha256,
    topBlockIndex: Math.max(0, Math.floor(topBlockIndex)),
    topBlockRatio: Math.min(Math.max(topBlockRatio, 0), 1),
    displayText: normalizeResumeDisplayText(displayText),
  }
}

/**
 * Strict identity check for restore: canonicalized length as the fast path,
 * then the exact SHA-256. Any doubt (missing WebCrypto included) is a
 * mismatch — a missing resume card is preferable to a convincing but
 * incorrect jump.
 */
export async function matchesResumeDocument(
  record: Pick<ResumePositionRecord, 'normalizedLength' | 'markdownSha256'>,
  markdown: string,
): Promise<boolean> {
  const canonical = canonicalizeMarkdownForResume(markdown)
  if (canonical.length !== record.normalizedLength) {
    return false
  }

  const hash = await sha256Hex(canonical)
  return hash !== null && hash === record.markdownSha256
}
