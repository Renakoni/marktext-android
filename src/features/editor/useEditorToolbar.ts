import { ref } from 'vue'
import {
  DEFAULT_MOBILE_TOOLBAR_PANEL,
  type MobileEditorToolbarPanel,
} from '../../lib/mobileToolbarConfig'

interface OpenLinkSheetOptions {
  text: string
  url?: string
}

export function useEditorToolbar() {
  const editorMenuOpen = ref(false)
  const editorToolbarExpanded = ref(false)
  const editorToolbarPanel = ref<MobileEditorToolbarPanel>(DEFAULT_MOBILE_TOOLBAR_PANEL)
  const linkSheetOpen = ref(false)
  const linkText = ref('')
  const linkUrl = ref('')
  const importingAndroidImage = ref(false)

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
    toggleEditorMenu,
    closeEditorMenu,
    toggleEditorToolbar,
    setEditorToolbarPanel,
    closeEditorToolbar,
    openLinkSheet,
    closeLinkSheet,
  }
}
