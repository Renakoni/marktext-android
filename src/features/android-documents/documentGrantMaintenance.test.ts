import { describe, expect, it, vi } from 'vitest'

import {
  collectReferencedDocumentUris,
  createDocumentGrantSync,
} from './documentGrantMaintenance'

const CLEAN_RESULT = { grantCount: 3, releasedGrantCount: 0, failedReleaseCount: 0 }

describe('collectReferencedDocumentUris', () => {
  it('unions the current document with recents, dropping nulls and duplicates', () => {
    const referenced = collectReferencedDocumentUris({
      currentDocument: { sourceUri: 'content://docs/current' },
      recentDocuments: [
        { sourceUri: 'content://docs/b' },
        { sourceUri: null },
        { sourceUri: 'content://docs/a' },
        { sourceUri: 'content://docs/current' },
      ],
    })

    expect(referenced).toEqual([
      'content://docs/a',
      'content://docs/b',
      'content://docs/current',
    ])
  })

  it('handles a local-draft current document', () => {
    expect(
      collectReferencedDocumentUris({
        currentDocument: { sourceUri: null },
        recentDocuments: [],
      }),
    ).toEqual([])
  })
})

describe('createDocumentGrantSync', () => {
  it('does nothing off Android', async () => {
    const cleanup = vi.fn()
    const sync = createDocumentGrantSync({ cleanup, isAvailable: () => false })

    await expect(
      sync({ currentDocument: { sourceUri: 'content://docs/a' }, recentDocuments: [] }),
    ).resolves.toBeNull()
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('pushes the sorted unique referenced set to the cleanup', async () => {
    const cleanup = vi.fn().mockResolvedValue(CLEAN_RESULT)
    const sync = createDocumentGrantSync({ cleanup, isAvailable: () => true })

    const result = await sync({
      currentDocument: { sourceUri: 'content://docs/current' },
      recentDocuments: [{ sourceUri: 'content://docs/a' }],
    })

    expect(result).toEqual(CLEAN_RESULT)
    expect(cleanup).toHaveBeenCalledWith(['content://docs/a', 'content://docs/current'])
  })

  it('suppresses repeat calls for an unchanged referenced set', async () => {
    const cleanup = vi.fn().mockResolvedValue(CLEAN_RESULT)
    const sync = createDocumentGrantSync({ cleanup, isAvailable: () => true })
    const options = {
      currentDocument: { sourceUri: null },
      recentDocuments: [{ sourceUri: 'content://docs/a' }],
    }

    await sync(options)
    await expect(sync(options)).resolves.toBeNull()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('fires again when the referenced set changes', async () => {
    const cleanup = vi.fn().mockResolvedValue(CLEAN_RESULT)
    const sync = createDocumentGrantSync({ cleanup, isAvailable: () => true })

    await sync({
      currentDocument: { sourceUri: null },
      recentDocuments: [{ sourceUri: 'content://docs/a' }],
    })
    await sync({
      currentDocument: { sourceUri: null },
      recentDocuments: [{ sourceUri: 'content://docs/a' }, { sourceUri: 'content://docs/b' }],
    })

    expect(cleanup).toHaveBeenCalledTimes(2)
    expect(cleanup).toHaveBeenLastCalledWith(['content://docs/a', 'content://docs/b'])
  })

  it('retries after a failed cleanup instead of memoizing it', async () => {
    const cleanup = vi
      .fn()
      .mockRejectedValueOnce(new Error('bridge down'))
      .mockResolvedValue(CLEAN_RESULT)
    const sync = createDocumentGrantSync({ cleanup, isAvailable: () => true })
    const options = {
      currentDocument: { sourceUri: null },
      recentDocuments: [{ sourceUri: 'content://docs/a' }],
    }

    await expect(sync(options)).rejects.toThrow('bridge down')
    await expect(sync(options)).resolves.toEqual(CLEAN_RESULT)
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it('retries a resolved cleanup that reported failed releases', async () => {
    // The native side resolves (not rejects) when a provider refuses a
    // release, restoring the ledger entry and reporting the count — the
    // memo must not swallow the retry.
    const failedResult = { grantCount: 3, releasedGrantCount: 0, failedReleaseCount: 1 }
    const cleanup = vi
      .fn()
      .mockResolvedValueOnce(failedResult)
      .mockResolvedValue(CLEAN_RESULT)
    const sync = createDocumentGrantSync({ cleanup, isAvailable: () => true })
    const options = {
      currentDocument: { sourceUri: null },
      recentDocuments: [{ sourceUri: 'content://docs/a' }],
    }

    await expect(sync(options)).resolves.toEqual(failedResult)
    await expect(sync(options)).resolves.toEqual(CLEAN_RESULT)
    await expect(sync(options)).resolves.toBeNull()
    expect(cleanup).toHaveBeenCalledTimes(2)
  })
})
