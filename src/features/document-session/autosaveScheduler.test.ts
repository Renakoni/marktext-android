import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createAutosaveScheduler } from './autosaveScheduler'
import { DEFAULT_DOCUMENT_SETTINGS, type DocumentSettings } from './documentSettings'
import { createUntitledDocument } from '../../lib/documentState'

function createScheduler(overrides: {
  settings?: Partial<DocumentSettings>
  autosaveTarget?: 'local-draft' | 'android-document'
  isDirty?: boolean
  isEditingActive?: boolean
  canPersistLocalDrafts?: boolean
} = {}) {
  const documentSettings = ref<DocumentSettings>({
    ...DEFAULT_DOCUMENT_SETTINGS,
    ...overrides.settings,
  })
  const documentState = ref({
    ...createUntitledDocument({
      autosaveTarget: overrides.autosaveTarget ?? 'local-draft',
    }),
    isDirty: overrides.isDirty ?? true,
  })
  const saveDraft = vi.fn()
  const saveAndroidDocument = vi.fn().mockResolvedValue(true)

  const scheduler = createAutosaveScheduler({
    documentSettings,
    documentState,
    isEditingActive: () => overrides.isEditingActive ?? true,
    canPersistLocalDrafts: () =>
      overrides.canPersistLocalDrafts ?? documentSettings.value.localDrafts,
    saveDraft,
    saveAndroidDocument,
  })

  return { scheduler, documentSettings, documentState, saveDraft, saveAndroidDocument }
}

describe('autosaveScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires the draft save once after the configured delay', () => {
    const { scheduler, saveDraft } = createScheduler()

    scheduler.scheduleDraftSave()
    vi.advanceTimersByTime(DEFAULT_DOCUMENT_SETTINGS.autoSaveDelayMs - 1)
    expect(saveDraft).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  it('debounces rescheduling instead of stacking timers', () => {
    const { scheduler, saveDraft } = createScheduler()

    scheduler.scheduleDraftSave()
    vi.advanceTimersByTime(500)
    scheduler.scheduleDraftSave()
    vi.advanceTimersByTime(DEFAULT_DOCUMENT_SETTINGS.autoSaveDelayMs)

    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  it('respects the autosave guards per target', () => {
    const { scheduler, saveDraft, saveAndroidDocument } = createScheduler({
      settings: { localDrafts: false },
    })

    expect(scheduler.canRunIdleLocalDraftAutosave()).toBe(false)
    expect(scheduler.canRunIdleAndroidDocumentAutosave()).toBe(true)

    scheduler.scheduleDraftSave()
    scheduler.scheduleAndroidDocumentSave()
    vi.runAllTimers()

    expect(saveDraft).not.toHaveBeenCalled()
    expect(saveAndroidDocument).toHaveBeenCalledTimes(1)
  })

  it('cancels pending saves', () => {
    const { scheduler, saveDraft, saveAndroidDocument } = createScheduler()

    scheduler.scheduleDraftSave()
    scheduler.scheduleAndroidDocumentSave()
    scheduler.clearDraftSaveTimer()
    scheduler.clearAndroidDocumentSaveTimer()
    vi.runAllTimers()

    expect(saveDraft).not.toHaveBeenCalled()
    expect(saveAndroidDocument).not.toHaveBeenCalled()
  })

  it('clears both timers when autosave is disabled mid-session', () => {
    const { scheduler, documentSettings, saveDraft, saveAndroidDocument } = createScheduler()
    scheduler.scheduleDraftSave()
    scheduler.scheduleAndroidDocumentSave()

    const previous = documentSettings.value
    scheduler.applyDocumentSettingsChange({ ...previous, autoSave: false }, previous)
    vi.runAllTimers()

    expect(saveDraft).not.toHaveBeenCalled()
    expect(saveAndroidDocument).not.toHaveBeenCalled()
  })

  it('reschedules a dirty Android document when the delay changes', () => {
    const { scheduler, documentSettings, saveAndroidDocument } = createScheduler({
      autosaveTarget: 'android-document',
    })

    const previous = documentSettings.value
    documentSettings.value = { ...previous, autoSaveDelaySeconds: 5, autoSaveDelayMs: 5000 }
    scheduler.applyDocumentSettingsChange(documentSettings.value, previous)

    vi.advanceTimersByTime(4999)
    expect(saveAndroidDocument).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(saveAndroidDocument).toHaveBeenCalledTimes(1)
  })

  it('schedules a dirty local draft when autosave is re-enabled', () => {
    const { scheduler, documentSettings, saveDraft } = createScheduler()

    const previous = { ...documentSettings.value, autoSave: false }
    scheduler.applyDocumentSettingsChange(documentSettings.value, previous)
    vi.runAllTimers()

    expect(saveDraft).toHaveBeenCalledTimes(1)
  })

  it('leaves timers alone when not actively editing or not dirty', () => {
    const { scheduler, documentSettings, saveDraft } = createScheduler({
      isEditingActive: false,
    })

    const previous = { ...documentSettings.value, autoSave: false }
    scheduler.applyDocumentSettingsChange(documentSettings.value, previous)
    vi.runAllTimers()

    expect(saveDraft).not.toHaveBeenCalled()
  })
})
