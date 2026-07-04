import type { LocalDraftRecord } from '../../lib/localDrafts'

const ANDROID_RECOVERY_DRAFT_PREFIX = 'android-recovery:'

export function getAndroidRecoveryDraftId(sourceUri: string) {
  return `${ANDROID_RECOVERY_DRAFT_PREFIX}${sourceUri}`
}

export function isAndroidRecoveryDraftId(id: string) {
  return id.startsWith(ANDROID_RECOVERY_DRAFT_PREFIX)
}

export function createAndroidRecoveryDraft(
  sourceUri: string,
  markdown: string,
  updatedAt: string,
): LocalDraftRecord | null {
  if (!markdown.trim()) {
    return null
  }

  return {
    id: getAndroidRecoveryDraftId(sourceUri),
    markdown,
    createdAt: updatedAt,
    updatedAt,
    lastSavedAt: null,
  }
}
