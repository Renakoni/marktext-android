import { ref } from 'vue'
import {
  DEFAULT_MOBILE_TOOLBAR_PANEL,
  type MobileEditorToolbarPanel,
} from '../../lib/mobileToolbarConfig'
import type { EditorToolbarSettings } from './editorToolbarSettings'

interface OpenLinkSheetOptions {
  text: string
  url?: string
}

type EditorToolbarBehaviorSettings = Pick<
  EditorToolbarSettings,
  'defaultPanel' | 'rememberPanel'
>

const DEFAULT_EDITOR_TOOLBAR_BEHAVIOR_SETTINGS = {
  defaultPanel: DEFAULT_MOBILE_TOOLBAR_PANEL,
  rememberPanel: true,
} as const satisfies EditorToolbarBehaviorSettings

export function useEditorToolbar() {
  const editorMenuOpen = ref(false)
  const editorToolbarExpanded = ref(false)
  const editorToolbarPanel = ref<MobileEditorToolbarPanel>(DEFAULT_MOBILE_TOOLBAR_PANEL)
  const linkSheetOpen = ref(false)
  const linkText = ref('')
  const linkUrl = ref('')
  const importingAndroidImage = ref(false)
  let toolbarBehaviorSettings: EditorToolbarBehaviorSettings = {
    ...DEFAULT_EDITOR_TOOLBAR_BEHAVIOR_SETTINGS,
  }

  function applyEditorToolbarSettings(settings: EditorToolbarBehaviorSettings) {
    const defaultPanelChanged = settings.defaultPanel !== toolbarBehaviorSettings.defaultPanel
    toolbarBehaviorSettings = settings

    if (!settings.rememberPanel || (defaultPanelChanged && !editorToolbarExpanded.value)) {
      editorToolbarPanel.value = settings.defaultPanel
    }
  }

  function toggleEditorMenu() {
    editorMenuOpen.value = !editorMenuOpen.value
    if (editorMenuOpen.value) {
      editorToolbarExpanded.value = false
    }
  }

  function closeEditorMenu() {
    editorMenuOpen.value = false
  }

  function toggleEditorToolbar() {
    editorToolbarExpanded.value = !editorToolbarExpanded.value
    if (editorToolbarExpanded.value) {
      if (!toolbarBehaviorSettings.rememberPanel) {
        editorToolbarPanel.value = toolbarBehaviorSettings.defaultPanel
      }
      editorMenuOpen.value = false
    }
  }

  function setEditorToolbarPanel(panel: MobileEditorToolbarPanel) {
    editorToolbarPanel.value = panel
  }

  function closeEditorToolbar() {
    editorToolbarExpanded.value = false
  }

  function openLinkSheet({ text, url = '' }: OpenLinkSheetOptions) {
    linkText.value = text
    linkUrl.value = url
    editorMenuOpen.value = false
    editorToolbarExpanded.value = false
    linkSheetOpen.value = true
  }

  function closeLinkSheet() {
    linkSheetOpen.value = false
    linkText.value = ''
    linkUrl.value = ''
  }

  return {
    editorMenuOpen,
    editorToolbarExpanded,
    editorToolbarPanel,
    linkSheetOpen,
    linkText,
    linkUrl,
    importingAndroidImage,
    applyEditorToolbarSettings,
    toggleEditorMenu,
    closeEditorMenu,
    toggleEditorToolbar,
    setEditorToolbarPanel,
    closeEditorToolbar,
    openLinkSheet,
    closeLinkSheet,
  }
}
