import { describe, expect, it } from 'vitest'
import {
  canonicalizeMarkdownForResume,
  createResumePositionRecord,
  matchesResumeDocument,
  normalizeResumeDisplayText,
  MAX_RESUME_POSITIONS,
  readStoredResumePosition,
  removeStoredResumePosition,
  RESUME_DISPLAY_TEXT_MAX_LENGTH,
  RESUME_POSITIONS_STORAGE_KEY,
  sha256Hex,
  writeStoredResumePosition,
  type ResumePositionRecord,
} from './resumePositions'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    dump: () => Object.fromEntries(values),
  }
}

function createRecord(overrides: Partial<ResumePositionRecord> = {}): ResumePositionRecord {
  return {
    schemaVersion: 1,
    capturedAt: '2026-07-11T08:00:00.000Z',
    normalizedLength: 10,
    markdownSha256: 'a'.repeat(64),
    topBlockIndex: 3,
    topBlockRatio: 0.5,
    displayText: 'Chapter',
    ...overrides,
  }
}

describe('canonicalizeMarkdownForResume', () => {
  it('normalizes CRLF/CR to LF and strips trailing newlines', () => {
    expect(canonicalizeMarkdownForResume('a\r\nb\rc\n\n\n')).toBe('a\nb\nc')
  })

  it('keeps interior blank lines intact', () => {
    expect(canonicalizeMarkdownForResume('a\n\nb\n')).toBe('a\n\nb')
  })
})

describe('normalizeResumeDisplayText', () => {
  it('collapses whitespace runs', () => {
    expect(normalizeResumeDisplayText('  hello\n\t world  ')).toBe('hello world')
  })

  it('caps at the display limit by code points', () => {
    const text = '汉'.repeat(RESUME_DISPLAY_TEXT_MAX_LENGTH + 20)
    expect([...normalizeResumeDisplayText(text)]).toHaveLength(RESUME_DISPLAY_TEXT_MAX_LENGTH)
  })

  it('never splits a surrogate pair at the cap', () => {
    const text = '😀'.repeat(RESUME_DISPLAY_TEXT_MAX_LENGTH)
    const truncated = normalizeResumeDisplayText(text)
    expect([...truncated]).toHaveLength(RESUME_DISPLAY_TEXT_MAX_LENGTH)
    expect(truncated.endsWith('😀')).toBe(true)
  })
})

describe('sha256Hex', () => {
  it('produces the SHA-256 test vector for "abc"', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('createResumePositionRecord / matchesResumeDocument', () => {
  it('round-trips a capture against identical content', async () => {
    const record = await createResumePositionRecord({
      markdown: '# Title\n\nBody\n',
      topBlockIndex: 1,
      topBlockRatio: 0.25,
      displayText: 'Body',
    })

    expect(record).not.toBeNull()
    await expect(matchesResumeDocument(record!, '# Title\n\nBody\n')).resolves.toBe(true)
  })

  it('tolerates trailing-newline and CRLF churn from the save pipeline', async () => {
    const record = await createResumePositionRecord({
      markdown: '# Title\n\nBody\n',
      topBlockIndex: 0,
      topBlockRatio: 0,
      displayText: '',
    })

    await expect(matchesResumeDocument(record!, '# Title\r\n\r\nBody')).resolves.toBe(true)
  })

  it('rejects different content of the same length via the hash', async () => {
    const record = await createResumePositionRecord({
      markdown: 'abcdef',
      topBlockIndex: 0,
      topBlockRatio: 0,
      displayText: '',
    })

    await expect(matchesResumeDocument(record!, 'abcdeg')).resolves.toBe(false)
  })

  it('rejects different lengths through the fast path', async () => {
    const record = await createResumePositionRecord({
      markdown: 'abc',
      topBlockIndex: 0,
      topBlockRatio: 0,
      displayText: '',
    })

    await expect(matchesResumeDocument(record!, 'abcd')).resolves.toBe(false)
  })

  it('clamps ratio, floors the index, and truncates display text', async () => {
    const record = await createResumePositionRecord({
      markdown: 'content',
      topBlockIndex: 4.9,
      topBlockRatio: 1.7,
      displayText: `  padded ${'x'.repeat(200)}`,
    })

    expect(record!.topBlockIndex).toBe(4)
    expect(record!.topBlockRatio).toBe(1)
    expect([...record!.displayText].length).toBeLessThanOrEqual(RESUME_DISPLAY_TEXT_MAX_LENGTH)
  })
})

describe('resume position storage', () => {
  it('round-trips a record by document key', () => {
    const storage = createMemoryStorage()
    const record = createRecord()

    writeStoredResumePosition('local-draft:a', record, storage)

    expect(readStoredResumePosition('local-draft:a', storage)).toEqual(record)
    expect(readStoredResumePosition('local-draft:other', storage)).toBeNull()
  })

  it('updates an existing key in place', () => {
    const storage = createMemoryStorage()
    writeStoredResumePosition('k', createRecord({ topBlockIndex: 1 }), storage)
    writeStoredResumePosition('k', createRecord({ topBlockIndex: 9 }), storage)

    expect(readStoredResumePosition('k', storage)?.topBlockIndex).toBe(9)
    const stored = JSON.parse(storage.dump()[RESUME_POSITIONS_STORAGE_KEY]) as object
    expect(Object.keys(stored)).toHaveLength(1)
  })

  it('removes a record and clears the storage key when empty', () => {
    const storage = createMemoryStorage()
    writeStoredResumePosition('k', createRecord(), storage)
    removeStoredResumePosition('k', storage)

    expect(readStoredResumePosition('k', storage)).toBeNull()
    expect(storage.dump()[RESUME_POSITIONS_STORAGE_KEY]).toBeUndefined()
  })

  it('evicts the oldest captures beyond the retention cap', () => {
    const storage = createMemoryStorage()
    for (let index = 0; index <= MAX_RESUME_POSITIONS; index += 1) {
      const capturedAt = new Date(Date.UTC(2026, 0, 1 + index)).toISOString()
      writeStoredResumePosition(`doc-${index}`, createRecord({ capturedAt }), storage)
    }

    const stored = JSON.parse(storage.dump()[RESUME_POSITIONS_STORAGE_KEY]) as Record<
      string,
      unknown
    >
    expect(Object.keys(stored)).toHaveLength(MAX_RESUME_POSITIONS)
    // doc-0 carries the oldest capturedAt and is the one evicted.
    expect(readStoredResumePosition('doc-0', storage)).toBeNull()
    expect(readStoredResumePosition(`doc-${MAX_RESUME_POSITIONS}`, storage)).not.toBeNull()
  })

  it('drops malformed entries and survives corrupted JSON', () => {
    const good = createRecord()
    const storage = createMemoryStorage({
      [RESUME_POSITIONS_STORAGE_KEY]: JSON.stringify({
        good,
        wrongVersion: { ...good, schemaVersion: 2 },
        badHash: { ...good, markdownSha256: 'nope' },
        negativeIndex: { ...good, topBlockIndex: -1 },
        fractionalIndex: { ...good, topBlockIndex: 1.5 },
        ratioOutOfRange: { ...good, topBlockRatio: 1.2 },
        notAnObject: 'text',
      }),
    })

    expect(readStoredResumePosition('good', storage)).toEqual(good)
    for (const key of [
      'wrongVersion',
      'badHash',
      'negativeIndex',
      'fractionalIndex',
      'ratioOutOfRange',
      'notAnObject',
    ]) {
      expect(readStoredResumePosition(key, storage)).toBeNull()
    }

    const corrupted = createMemoryStorage({ [RESUME_POSITIONS_STORAGE_KEY]: '{not json' })
    expect(readStoredResumePosition('good', corrupted)).toBeNull()
    // A write over corrupted storage recovers instead of throwing.
    writeStoredResumePosition('good', good, corrupted)
    expect(readStoredResumePosition('good', corrupted)).toEqual(good)
  })

  it('never throws when storage itself fails', () => {
    const failing = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }

    expect(() => writeStoredResumePosition('k', createRecord(), failing)).not.toThrow()
    expect(() => removeStoredResumePosition('k', failing)).not.toThrow()
    expect(readStoredResumePosition('k', failing)).toBeNull()
  })
})
