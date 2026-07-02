import {
  parseLocalDrafts,
  serializeLocalDrafts,
  type LocalDraftRecord,
} from './localDrafts'
import {
  parseRecentDocuments,
  serializeRecentDocuments,
  type RecentDocumentRecord,
} from './recentDocuments'

export const LEGACY_DRAFT_STORAGE_KEY = 'marktext-for-android:draft'
export const LOCAL_DRAFTS_STORAGE_KEY = 'marktext-for-android:drafts'
export const ANDROID_RECENT_DOCUMENTS_STORAGE_KEY =
  'marktext-for-android:recent-documents'

interface DocumentStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function readStoredLocalDrafts(storage: DocumentStorage = localStorage) {
  return parseLocalDrafts(storage.getItem(LOCAL_DRAFTS_STORAGE_KEY))
}

export function writeStoredLocalDrafts(
  records: LocalDraftRecord[],
  storage: DocumentStorage = localStorage,
) {
  if (records.length > 0) {
    storage.setItem(LOCAL_DRAFTS_STORAGE_KEY, serializeLocalDrafts(records))
  } else {
    storage.removeItem(LOCAL_DRAFTS_STORAGE_KEY)
  }

  storage.removeItem(LEGACY_DRAFT_STORAGE_KEY)
}

export function readLegacyDraft(storage: DocumentStorage = localStorage) {
  return storage.getItem(LEGACY_DRAFT_STORAGE_KEY)
}

export function readStoredAndroidRecentDocuments(
  storage: DocumentStorage = localStorage,
) {
  return parseRecentDocuments(storage.getItem(ANDROID_RECENT_DOCUMENTS_STORAGE_KEY)).filter(
    record => record.kind === 'android-document',
  )
}

export function writeStoredAndroidRecentDocuments(
  records: RecentDocumentRecord[],
  storage: DocumentStorage = localStorage,
) {
  const androidDocuments = records.filter(record => record.kind === 'android-document')

  if (androidDocuments.length > 0) {
    storage.setItem(
      ANDROID_RECENT_DOCUMENTS_STORAGE_KEY,
      serializeRecentDocuments(androidDocuments),
    )
  } else {
    storage.removeItem(ANDROID_RECENT_DOCUMENTS_STORAGE_KEY)
  }

  return androidDocuments
}
