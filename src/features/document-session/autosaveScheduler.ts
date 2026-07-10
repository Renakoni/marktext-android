import type { Ref } from 'vue'
import type { DocumentSettings } from './documentSettings'
import type { MarkdownDocumentState } from '../../lib/documentState'

export interface AutosaveSchedulerOptions {
  documentSettings: Ref<DocumentSettings>
  documentState: Ref<MarkdownDocumentState>
  /** True while the editor screen is active with a live editor instance. */
  isEditingActive: () => boolean
  canPersistLocalDrafts: () => boolean
  // The actual save entry points stay owned by App; the scheduler only times them.
  saveDraft: () => void
  saveAndroidDocument: () => Promise<boolean>
}

export interface AutosaveScheduler {
  canRunIdleLocalDraftAutosave(): boolean
  canRunIdleAndroidDocumentAutosave(): boolean
  scheduleDraftSave(): void
  clearDraftSaveTimer(): void
  scheduleAndroidDocumentSave(): void
  clearAndroidDocumentSaveTimer(): void
  applyDocumentSettingsChange(
    settings: DocumentSettings,
    previousSettings: DocumentSettings | undefined,
  ): void
}

/**
 * Owns the idle-autosave timers for local drafts and Android documents:
 * scheduling, debounced rescheduling, cancellation, and the resync when the
 * autosave settings change mid-session. The save workflows themselves are
 * injected and unchanged.
 */
export function createAutosaveScheduler(options: AutosaveSchedulerOptions): AutosaveScheduler {
  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null
  let androidSaveTimer: ReturnType<typeof setTimeout> | null = null

  function canRunIdleLocalDraftAutosave() {
    return options.documentSettings.value.autoSave && options.canPersistLocalDrafts()
  }

  function canRunIdleAndroidDocumentAutosave() {
    return options.documentSettings.value.autoSave
  }

  function scheduleDraftSave() {
    if (!canRunIdleLocalDraftAutosave()) {
      return
    }

    if (draftSaveTimer !== null) {
      clearTimeout(draftSaveTimer)
    }

    draftSaveTimer = setTimeout(options.saveDraft, options.documentSettings.value.autoSaveDelayMs)
  }

  function clearDraftSaveTimer() {
    if (draftSaveTimer !== null) {
      clearTimeout(draftSaveTimer)
      draftSaveTimer = null
    }
  }

  function scheduleAndroidDocumentSave() {
    if (!canRunIdleAndroidDocumentAutosave()) {
      return
    }

    if (androidSaveTimer !== null) {
      clearTimeout(androidSaveTimer)
    }

    androidSaveTimer = setTimeout(() => {
      void options.saveAndroidDocument()
    }, options.documentSettings.value.autoSaveDelayMs)
  }

  function clearAndroidDocumentSaveTimer() {
    if (androidSaveTimer !== null) {
      clearTimeout(androidSaveTimer)
      androidSaveTimer = null
    }
  }

  function applyDocumentSettingsChange(
    settings: DocumentSettings,
    previousSettings: DocumentSettings | undefined,
  ) {
    if (!settings.localDrafts) {
      clearDraftSaveTimer()
    }

    if (!settings.autoSave) {
      clearDraftSaveTimer()
      clearAndroidDocumentSaveTimer()
      return
    }

    if (!options.isEditingActive() || !options.documentState.value.isDirty) {
      return
    }

    const autoSaveWasEnabled = previousSettings?.autoSave ?? settings.autoSave
    const delayChanged = previousSettings?.autoSaveDelayMs !== settings.autoSaveDelayMs
    if (!autoSaveWasEnabled || delayChanged) {
      if (options.documentState.value.autosaveTarget === 'android-document') {
        scheduleAndroidDocumentSave()
      } else if (settings.localDrafts) {
        scheduleDraftSave()
      }
    }
  }

  return {
    canRunIdleLocalDraftAutosave,
    canRunIdleAndroidDocumentAutosave,
    scheduleDraftSave,
    clearDraftSaveTimer,
    scheduleAndroidDocumentSave,
    clearAndroidDocumentSaveTimer,
    applyDocumentSettingsChange,
  }
}
