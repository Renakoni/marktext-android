import { describe, expect, it } from 'vitest'
import { HOME_TABS } from '../features/home/homeNavigation'
import { SETTINGS_PAGES } from '../features/settings/settingsNavigation'
import {
  getAppBackButtonAction,
  getShowHomeAfterAndroidSaveAction,
  getShowHomeAfterLocalDraftSaveAction,
  getShowHomeDocumentSaveAction,
  type AppBackButtonState,
} from './appExitDecisions'

const baseBackState: AppBackButtonState = {
  currentScreen: 'home',
  homeTab: HOME_TABS.DOCUMENTS,
  settingsPage: SETTINGS_PAGES.INDEX,
  androidExitPromptOpen: false,
  draftExitPromptOpen: false,
  linkSheetOpen: false,
  editorMenuOpen: false,
  editorOutlineOpen: false,
  editorSearchOpen: false,
  editorToolbarExpanded: false,
  homeSelectionActive: false,
  homeSheetOpen: false,
}

describe('appExitDecisions', () => {
  it('selects the save flow before leaving the editor', () => {
    expect(getShowHomeDocumentSaveAction('android-document')).toBe('save-android-document')
    expect(getShowHomeDocumentSaveAction('local-draft')).toBe('save-local-draft')
  })

  it('decides the post-save editor exit action for Android documents', () => {
    expect(getShowHomeAfterAndroidSaveAction({
      saved: true,
      shouldPromptAndroidExitAfterSaveFailure: true,
    })).toBe('close-editor')

    expect(getShowHomeAfterAndroidSaveAction({
      saved: false,
      shouldPromptAndroidExitAfterSaveFailure: true,
    })).toBe('open-android-exit-prompt')

    expect(getShowHomeAfterAndroidSaveAction({
      saved: false,
      shouldPromptAndroidExitAfterSaveFailure: false,
    })).toBe('stay-editor')
  })

  it('decides the post-save editor exit action for local drafts', () => {
    expect(getShowHomeAfterLocalDraftSaveAction({
      shouldPromptLocalDraftSaveToDevice: true,
    })).toBe('open-local-draft-exit-prompt')

    expect(getShowHomeAfterLocalDraftSaveAction({
      shouldPromptLocalDraftSaveToDevice: false,
    })).toBe('close-editor')
  })

  it('preserves Android back priority for prompts, sheets, menu, toolbar, and editor exit', () => {
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      androidExitPromptOpen: true,
      draftExitPromptOpen: true,
      linkSheetOpen: true,
      editorMenuOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-android-exit-prompt')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      draftExitPromptOpen: true,
      linkSheetOpen: true,
      editorMenuOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-local-draft-exit-prompt')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      linkSheetOpen: true,
      editorMenuOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-link-sheet')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      editorMenuOpen: true,
      editorOutlineOpen: true,
      editorSearchOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-editor-menu')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      editorOutlineOpen: true,
      editorSearchOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-editor-outline')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      editorSearchOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-editor-search')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      editorToolbarExpanded: true,
    })).toBe('close-editor-toolbar')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
    })).toBe('show-home')
  })

  it('preserves Android back priority on home settings and document tabs', () => {
    expect(getAppBackButtonAction({
      ...baseBackState,
      homeTab: HOME_TABS.SETTINGS,
      settingsPage: SETTINGS_PAGES.ABOUT,
    })).toBe('show-settings-index')

    expect(getAppBackButtonAction({
      ...baseBackState,
      homeTab: HOME_TABS.SETTINGS,
      settingsPage: SETTINGS_PAGES.INDEX,
    })).toBe('show-documents-tab')

    expect(getAppBackButtonAction(baseBackState)).toBe('exit-app')
  })

  it('clears an active home selection before leaving the app', () => {
    expect(getAppBackButtonAction({
      ...baseBackState,
      homeSelectionActive: true,
    })).toBe('clear-home-selection')

    // A delete/rename sheet dismisses first, keeping the selection intact.
    expect(getAppBackButtonAction({
      ...baseBackState,
      homeSelectionActive: true,
      homeSheetOpen: true,
    })).toBe('close-home-sheet')

    // Selection mode only exists on the documents tab; elsewhere the flag is stale.
    expect(getAppBackButtonAction({
      ...baseBackState,
      homeTab: HOME_TABS.SETTINGS,
      homeSelectionActive: true,
    })).toBe('show-documents-tab')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      homeSelectionActive: true,
    })).toBe('show-home')
  })
})
