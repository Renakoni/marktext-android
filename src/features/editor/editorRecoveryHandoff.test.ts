// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumeEditorRecoveryHandoff,
  persistEditorRecoveryHandoff,
  type EditorRecoveryHandoff,
} from './editorRecoveryHandoff'
import { createUntitledDocument } from '../../lib/documentState'

const HANDOFF_KEY = 'marktext-for-android:editor-recovery-handoff'

function sampleHandoff(): EditorRecoveryHandoff {
  return {
    documentState: createUntitledDocument({
      markdown: '# Carried\n\nvolatile body',
      autosaveTarget: 'android-document',
      sourceUri: 'content://test/carried',
      displayName: 'Carried.md',
    }),
    status: 'Opened temporarily',
    currentAndroidDocumentCanWrite: false,
    promptLocalDraftSaveOnExit: false,
  }
}

describe('editorRecoveryHandoff', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips the persisted document session', () => {
    const handoff = sampleHandoff()
    expect(persistEditorRecoveryHandoff(handoff)).toBe(true)

    const restored = consumeEditorRecoveryHandoff()
    expect(restored?.documentState.markdown).toBe(handoff.documentState.markdown)
    expect(restored?.documentState.sourceUri).toBe('content://test/carried')
    expect(restored?.documentState.autosaveTarget).toBe('android-document')
    expect(restored?.status).toBe('Opened temporarily')
    expect(restored?.currentAndroidDocumentCanWrite).toBe(false)
    expect(restored?.promptLocalDraftSaveOnExit).toBe(false)
  })

  it('reports when storage rejects the handoff', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    })

    try {
      expect(persistEditorRecoveryHandoff(sampleHandoff())).toBe(false)
    } finally {
      setItem.mockRestore()
    }
  })

  it('consumes the handoff exactly once so a failing document cannot reopen every boot', () => {
    persistEditorRecoveryHandoff(sampleHandoff())
    expect(consumeEditorRecoveryHandoff()).not.toBeNull()
    // The key was cleared on the first read.
    expect(consumeEditorRecoveryHandoff()).toBeNull()
    expect(localStorage.getItem(HANDOFF_KEY)).toBeNull()
  })

  it('returns null when there is no handoff', () => {
    expect(consumeEditorRecoveryHandoff()).toBeNull()
  })

  it('discards a malformed payload instead of throwing, clearing it so it cannot wedge boot', () => {
    localStorage.setItem(HANDOFF_KEY, '{ not valid json')
    expect(consumeEditorRecoveryHandoff()).toBeNull()
    expect(localStorage.getItem(HANDOFF_KEY)).toBeNull()

    // Syntactically valid but shapeless payloads are rejected too.
    localStorage.setItem(HANDOFF_KEY, JSON.stringify({ status: 'x' }))
    expect(consumeEditorRecoveryHandoff()).toBeNull()
  })
})
