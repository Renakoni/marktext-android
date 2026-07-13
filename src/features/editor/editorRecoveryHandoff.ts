import type { MarkdownDocumentState } from '../../lib/documentState'

const RECOVERY_HANDOFF_KEY = 'marktext-for-android:editor-recovery-handoff'

// A one-shot snapshot the recovery flow persists immediately before a page
// reload. A reload is the only way to clear a cached module-load failure, but a
// temporary Open With / shared session (URI permission not persisted) and
// shared text with local-draft persistence off have NO Recents entry or local
// draft to fall back on — and with no live editor the normal save path is a
// no-op. Carrying the live document here lets the app reopen the exact session
// after boot instead of losing it to the reload.
export interface EditorRecoveryHandoff {
  documentState: MarkdownDocumentState
  status: string
  currentAndroidDocumentCanWrite: boolean
  promptLocalDraftSaveOnExit: boolean
}

export function persistEditorRecoveryHandoff(handoff: EditorRecoveryHandoff): boolean {
  try {
    window.localStorage.setItem(RECOVERY_HANDOFF_KEY, JSON.stringify(handoff))
    return true
  } catch {
    return false
  }
}

// Read AND clear the handoff in one step: it must fire exactly once, or a
// document that keeps failing to initialize would reopen on every boot.
export function consumeEditorRecoveryHandoff(): EditorRecoveryHandoff | null {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(RECOVERY_HANDOFF_KEY)
    window.localStorage.removeItem(RECOVERY_HANDOFF_KEY)
  } catch {
    return null
  }

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as EditorRecoveryHandoff
    if (
      !parsed
      || typeof parsed !== 'object'
      || typeof parsed.documentState !== 'object'
      || parsed.documentState === null
      || typeof parsed.documentState.markdown !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
