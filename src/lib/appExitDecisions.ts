import { HOME_TABS, type HomeTab } from './homeNavigation'
import { SETTINGS_PAGES, type SettingsPage } from './settingsNavigation'
import type { AutosaveTarget } from './documentState'

export type AppScreen = 'home' | 'editor'

export type ShowHomeDocumentSaveAction = 'save-android-document' | 'save-local-draft'

export type ShowHomeAfterSaveAction =
  | 'close-editor'
  | 'open-android-exit-prompt'
  | 'open-local-draft-exit-prompt'
  | 'stay-editor'

export interface AppBackButtonState {
  currentScreen: AppScreen
  homeTab: HomeTab
  settingsPage: SettingsPage
  androidExitPromptOpen: boolean
  draftExitPromptOpen: boolean
  linkSheetOpen: boolean
  editorMenuOpen: boolean
  editorToolbarExpanded: boolean
}

export type AppBackButtonAction =
  | 'close-android-exit-prompt'
  | 'close-local-draft-exit-prompt'
  | 'close-link-sheet'
  | 'close-editor-menu'
  | 'close-editor-toolbar'
  | 'show-home'
  | 'show-settings-index'
  | 'show-documents-tab'
  | 'exit-app'

export function getShowHomeDocumentSaveAction(
  autosaveTarget: AutosaveTarget,
): ShowHomeDocumentSaveAction {
  return autosaveTarget === 'android-document' ? 'save-android-document' : 'save-local-draft'
}

export function getShowHomeAfterAndroidSaveAction({
  saved,
  shouldPromptAndroidExitAfterSaveFailure,
}: {
  saved: boolean
  shouldPromptAndroidExitAfterSaveFailure: boolean
}): ShowHomeAfterSaveAction {
  if (saved) {
    return 'close-editor'
  }

  return shouldPromptAndroidExitAfterSaveFailure ? 'open-android-exit-prompt' : 'stay-editor'
}

export function getShowHomeAfterLocalDraftSaveAction({
  shouldPromptLocalDraftSaveToDevice,
}: {
  shouldPromptLocalDraftSaveToDevice: boolean
}): ShowHomeAfterSaveAction {
  return shouldPromptLocalDraftSaveToDevice ? 'open-local-draft-exit-prompt' : 'close-editor'
}

export function getAppBackButtonAction({
  currentScreen,
  homeTab,
  settingsPage,
  androidExitPromptOpen,
  draftExitPromptOpen,
  linkSheetOpen,
  editorMenuOpen,
  editorToolbarExpanded,
}: AppBackButtonState): AppBackButtonAction {
  if (androidExitPromptOpen) {
    return 'close-android-exit-prompt'
  }

  if (draftExitPromptOpen) {
    return 'close-local-draft-exit-prompt'
  }

  if (linkSheetOpen) {
    return 'close-link-sheet'
  }

  if (editorMenuOpen) {
    return 'close-editor-menu'
  }

  if (editorToolbarExpanded) {
    return 'close-editor-toolbar'
  }

  if (currentScreen === 'editor') {
    return 'show-home'
  }

  if (homeTab === HOME_TABS.SETTINGS && settingsPage !== SETTINGS_PAGES.INDEX) {
    return 'show-settings-index'
  }

  if (homeTab !== HOME_TABS.DOCUMENTS) {
    return 'show-documents-tab'
  }

  return 'exit-app'
}
