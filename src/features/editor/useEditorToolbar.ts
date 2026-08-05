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

interface OpenTableSheetOptions {
  rows: number
  columns: number
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
  const tableSheetOpen = ref(false)
  const tableRows = ref(0)
  const tableColumns = ref(0)
  const importingAndroidImage = ref(false)
  const caretInTable = ref(false)
  // The panel that was active when the caret entered a table, restored on
  // exit. Null when nothing is pending (the user manually switching panels
  // inside the table does not clear it — exit only restores when the table
  // panel is still the active one, so a manual switch naturally wins).
  let panelBeforeTable: MobileEditorToolbarPanel | null = null
  let toolbarBehaviorSettings: EditorToolbarBehaviorSettings = {
    ...DEFAULT_EDITOR_TOOLBAR_BEHAVIOR_SETTINGS,
  }

  function applyEditorToolbarSettings(settings: EditorToolbarBehaviorSettings) {
    const defaultPanelChanged = settings.defaultPanel !== toolbarBehaviorSettings.defaultPanel
    toolbarBehaviorSettings = settings

    if (caretInTable.value) {
      // The contextual table panel owns the toolbar while the caret is in
      // a table; the new default applies underneath it via the snapshot.
      panelBeforeTable = settings.defaultPanel
      return
    }

    if (!settings.rememberPanel || (defaultPanelChanged && !editorToolbarExpanded.value)) {
      editorToolbarPanel.value = settings.defaultPanel
    }
  }

  /**
   * Caret-contextual table panel (issue #144): entering a table switches
   * to it and snapshots the current panel; leaving restores the snapshot —
   * unless the user manually switched panels while inside, in which case
   * their choice stays.
   */
  function setCaretInTable(inTable: boolean) {
    if (inTable === caretInTable.value) {
      return
    }

    caretInTable.value = inTable
    if (inTable) {
      panelBeforeTable = editorToolbarPanel.value
      editorToolbarPanel.value = 'table'
      return
    }

    if (editorToolbarPanel.value === 'table') {
      editorToolbarPanel.value = panelBeforeTable ?? toolbarBehaviorSettings.defaultPanel
    }
    panelBeforeTable = null
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
      if (!toolbarBehaviorSettings.rememberPanel && !caretInTable.value) {
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

  function openTableSheet({ rows, columns }: OpenTableSheetOptions) {
    tableRows.value = rows
    tableColumns.value = columns
    editorMenuOpen.value = false
    editorToolbarExpanded.value = false
    tableSheetOpen.value = true
  }

  function closeTableSheet() {
    tableSheetOpen.value = false
    tableRows.value = 0
    tableColumns.value = 0
  }

  return {
    editorMenuOpen,
    editorToolbarExpanded,
    editorToolbarPanel,
    caretInTable,
    setCaretInTable,
    linkSheetOpen,
    linkText,
    linkUrl,
    tableSheetOpen,
    tableRows,
    tableColumns,
    importingAndroidImage,
    applyEditorToolbarSettings,
    toggleEditorMenu,
    closeEditorMenu,
    toggleEditorToolbar,
    setEditorToolbarPanel,
    closeEditorToolbar,
    openLinkSheet,
    closeLinkSheet,
    openTableSheet,
    closeTableSheet,
  }
}
