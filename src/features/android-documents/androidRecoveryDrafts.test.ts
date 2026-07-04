import { describe, expect, it } from 'vitest'
import { createAndroidRecoveryDraft, getAndroidRecoveryDraftId } from './androidRecoveryDrafts'

describe('androidRecoveryDrafts', () => {
  it('uses a stable draft id derived from the Android source URI', () => {
    expect(getAndroidRecoveryDraftId('content://test/document')).toBe(
      'android-recovery:content://test/document',
    )
  })

  it('creates local draft records for non-empty Android recovery content', () => {
    expect(
      createAndroidRecoveryDraft('content://test/document', '# Kept edits', '2026-07-02T00:00:00Z'),
    ).toEqual({
      id: 'android-recovery:content://test/document',
      markdown: '# Kept edits',
      createdAt: '2026-07-02T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
      lastSavedAt: null,
    })
  })

  it('does not create recovery drafts for blank Markdown', () => {
    expect(createAndroidRecoveryDraft('content://test/document', '  \n', '2026-07-02T00:00:00Z'))
      .toBeNull()
  })
})
