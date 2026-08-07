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
  incomingOpenPromptOpen: false,
  androidExitPromptOpen: false,
  draftExitPromptOpen: false,
  linkSheetOpen: false,
  tableSheetOpen: false,
  editorMenuOpen: false,
  editorOutlineOpen: false,
  editorSearchOpen: false,
  editorToolbarExpanded: false,
  editorSourceModeActive: false,
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
    // The blocked-preservation prompt guards unsaved work above every other layer.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      incomingOpenPromptOpen: true,
      androidExitPromptOpen: true,
      draftExitPromptOpen: true,
      linkSheetOpen: true,
      editorMenuOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-incoming-open-prompt')

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
      tableSheetOpen: true,
      editorMenuOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-link-sheet')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      tableSheetOpen: true,
      editorMenuOpen: true,
      editorToolbarExpanded: true,
    })).toBe('close-table-sheet')

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

  it('dismisses source code mode before leaving the editor, after overlays', () => {
    // The menu can sit ON TOP of source mode; it dismisses first.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      editorMenuOpen: true,
      editorSourceModeActive: true,
    })).toBe('close-editor-menu')

    // Bare source mode dismisses like a panel; the next Back leaves.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'editor',
      editorSourceModeActive: true,
    })).toBe('close-editor-source-mode')

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

  it('unwinds the save-as flow layers top-most first', () => {
    // Bare destination page: Back cancels the whole save.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'save-locations',
    })).toBe('cancel-save-destination')

    // The name sheet sits above the destination page.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'save-locations',
      cloudNameSheetOpen: true,
    })).toBe('cancel-cloud-name')

    // The Drive folder-pick overlay likewise dismisses before the page.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'save-locations',
      googleDriveFolderPickActive: true,
    })).toBe('cancel-google-folder-pick')

    // An in-flight cloud create outranks every other layer: the document
    // may already exist remotely, so Back is a no-op until it settles.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'save-locations',
      cloudSaveInProgress: true,
      cloudNameSheetOpen: true,
      googleDriveFolderPickActive: true,
    })).toBe('ignore-cloud-save')

    // The save-as overlays outrank editor-layer prompts too — they render
    // above the still-mounted editor.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'save-locations',
      cloudNameSheetOpen: true,
      draftExitPromptOpen: true,
    })).toBe('cancel-cloud-name')
  })

  it('backs the save-as OneDrive folder pick out folder by folder, then cancels', () => {
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'cloud-browser',
      cloudBrowserSaveModeActive: true,
      cloudBrowserAtRoot: false,
    })).toBe('cloud-browser-up')

    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'cloud-browser',
      cloudBrowserSaveModeActive: true,
      cloudBrowserAtRoot: true,
    })).toBe('cancel-onedrive-folder-pick')

    // The open-flow browser keeps its Open-page exit.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'cloud-browser',
      cloudBrowserAtRoot: true,
    })).toBe('show-open-locations')

    // A slow OneDrive create locks the browser: Back must not race it.
    expect(getAppBackButtonAction({
      ...baseBackState,
      currentScreen: 'cloud-browser',
      cloudBrowserSaveModeActive: true,
      cloudBrowserAtRoot: true,
      cloudSaveInProgress: true,
    })).toBe('ignore-cloud-save')
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
