<script setup lang="ts">
import { onBeforeUnmount, watch, ref, computed, nextTick, type CSSProperties } from 'vue'
import AndroidExitPrompt from './components/AndroidExitPrompt.vue'
import { handleSearchEnterKeydown } from './documentSearch'
import EditorActionSheet from './components/EditorActionSheet.vue'
import LinkInsertSheet from './components/LinkInsertSheet.vue'
import LocalDraftExitPrompt from './components/LocalDraftExitPrompt.vue'
import MobileEditorToolbar from './components/MobileEditorToolbar.vue'
import MobileSelectionToolbar from './components/MobileSelectionToolbar.vue'
import type { SelectionToolbarCommandId } from './selectionToolbar'
import type { MobileCommandId } from '../../lib/mobileCommands'
import type {
  MobileEditorToolbarPanel,
  MobileToolbarCommandButton,
} from '../../lib/mobileToolbarConfig'
import { useI18n } from '../../lib/i18n'

const props = defineProps<{
  documentTitle: string
  status: string
  editorReady: boolean
  showEditorActions: boolean
  editorMenuOpen: boolean
  toolbarVisible: boolean
  toolbarExpanded: boolean
  toolbarPanel: MobileEditorToolbarPanel
  toolbarCompact: boolean
  quickToolbarCommands: readonly MobileToolbarCommandButton[]
  wordCount: number
  characterCount: number
  lineCount: number
  canShare: boolean
  canExportPdf: boolean
  canSaveToDevice: boolean
  canSaveCopy: boolean
  sharing: boolean
  exportingPdf: boolean
  savingToDevice: boolean
  savingCopy: boolean
  linkSheetOpen: boolean
  linkText: string
  linkUrl: string
  draftExitPromptOpen: boolean
  draftCanSaveToDevice: boolean
  draftCanKeepLocal: boolean
  draftSaving: boolean
  androidExitPromptOpen: boolean
  androidExitMessage: string
  androidCanSaveCopy: boolean
  androidCanKeepRecovery: boolean
  androidSaving: boolean
  textDirection: 'ltr' | 'rtl'
  editorStyleVars: CSSProperties
  canPasteSelection: boolean
  searchOpen: boolean
  searchQuery: string
  searchMatchCount: number
  searchActiveIndex: number
}>()

const emit = defineEmits<{
  back: []
  search: []
  'close-search': []
  'update:searchQuery': [value: string]
  'search-next': []
  'search-previous': []
  'toggle-menu': []
  'close-menu': []
  share: []
  'export-pdf': []
  'save-to-device': []
  'save-copy': []
  'run-toolbar-command': [commandId: MobileCommandId, restoreRange: Range | null]
  'run-selection-command': [commandId: SelectionToolbarCommandId, restoreRange: Range | null]
  'dismiss-selection': [caretRange: Range | null]
  'toggle-toolbar': []
  'set-toolbar-panel': [panel: MobileEditorToolbarPanel]
  'update:linkText': [value: string]
  'update:linkUrl': [value: string]
  'close-link-sheet': []
  'insert-link': []
  'save-draft-to-device': []
  'keep-local-draft': []
  'discard-local-draft': []
  'save-android-copy': []
  'keep-android-recovery': []
  'discard-android-changes': []
  'editor-host-change': [element: HTMLElement | null]
}>()

const editorHost = ref<HTMLElement | null>(null)
// Muya replaces the inner host element during init (originContainer.replaceWith),
// so `editorHost` goes stale immediately. The shell stays in the document and
// is the stable containment root for selection checks.
const editorShell = ref<HTMLElement | null>(null)
const { t } = useI18n()

// Any sheet or prompt above the editor takes over the interaction surface,
// so the floating selection toolbar must stand down while one is open.
const selectionToolbarSuspended = computed(
  () =>
    props.editorMenuOpen ||
    props.searchOpen ||
    props.linkSheetOpen ||
    props.draftExitPromptOpen ||
    props.androidExitPromptOpen,
)

const searchInput = ref<HTMLInputElement | null>(null)

const searchCountText = computed(() => {
  if (!props.searchQuery) {
    return ''
  }

  if (props.searchMatchCount === 0) {
    return t('editor.searchNoMatches')
  }

  return t('editor.searchMatchCount', {
    current: props.searchActiveIndex + 1,
    total: props.searchMatchCount,
  })
})

watch(
  () => props.searchOpen,
  open => {
    if (open) {
      void nextTick(() => searchInput.value?.focus())
    }
  },
)

watch(editorHost, element => emit('editor-host-change', element), { immediate: true })

onBeforeUnmount(() => {
  emit('editor-host-change', null)
})
</script>

<template>
  <main class="app-shell">
    <header v-if="searchOpen" class="top-bar search-bar" data-testid="editor-search-bar">
      <button
        class="nav-button"
        type="button"
        :aria-label="t('editor.searchClose')"
        data-testid="search-close-button"
        @click="emit('close-search')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <div class="search-field">
        <input
          ref="searchInput"
          class="search-input"
          type="search"
          data-testid="search-input"
          :value="searchQuery"
          :placeholder="t('editor.searchPlaceholder')"
          :aria-label="t('editor.searchPlaceholder')"
          enterkeyhint="search"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          @keydown.enter="handleSearchEnterKeydown($event, () => emit('search-next'))"
        >
        <span
          v-if="searchCountText"
          class="search-count"
          :class="{ 'search-count-empty': searchMatchCount === 0 }"
          data-testid="search-count"
          aria-live="polite"
        >
          {{ searchCountText }}
        </span>
      </div>
      <div class="editor-actions">
        <button
          class="icon-button"
          type="button"
          :aria-label="t('editor.searchPrevious')"
          :disabled="searchMatchCount === 0"
          data-testid="search-previous-button"
          @click="emit('search-previous')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 14l6-6 6 6" />
          </svg>
        </button>
        <button
          class="icon-button"
          type="button"
          :aria-label="t('editor.searchNext')"
          :disabled="searchMatchCount === 0"
          data-testid="search-next-button"
          @click="emit('search-next')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 10l6 6 6-6" />
          </svg>
        </button>
      </div>
    </header>
    <header v-else class="top-bar">
      <button
        class="nav-button"
        type="button"
        :aria-label="t('editor.back')"
        data-testid="back-button"
        @click="emit('back')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <div class="document-heading">
        <h1>{{ documentTitle }}</h1>
        <p>{{ status }}</p>
      </div>
      <div v-if="editorReady" class="editor-actions">
        <button
          class="icon-button"
          type="button"
          :aria-label="t('editor.search')"
          :title="t('editor.search')"
          data-testid="search-open-button"
          @click="emit('search')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="11" cy="11" r="6" />
            <path d="M16 16l4.5 4.5" />
          </svg>
        </button>
        <button
          v-if="showEditorActions"
          class="icon-button"
          type="button"
          :aria-label="t('editor.moreActions')"
          :aria-expanded="editorMenuOpen"
          data-testid="editor-menu-button"
          @click="emit('toggle-menu')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
      </div>
    </header>

    <section class="editor-pane" :aria-label="t('editor.markdownEditor')">
      <div
        ref="editorShell"
        class="editor-host-shell"
        :dir="textDirection"
        :style="editorStyleVars"
        :aria-busy="!editorReady"
        :data-testid="editorReady ? 'editor-host' : 'editor-loading-host'"
      >
        <div ref="editorHost" class="muya-host" />
      </div>
    </section>

    <MobileSelectionToolbar
      :editor-ready="editorReady"
      :suspended="selectionToolbarSuspended"
      :host="editorShell"
      :can-paste="canPasteSelection"
      @run-command="
        (commandId, restoreRange) => emit('run-selection-command', commandId, restoreRange)
      "
      @dismiss-selection="caretRange => emit('dismiss-selection', caretRange)"
    />

    <MobileEditorToolbar
      v-if="toolbarVisible"
      :expanded="toolbarExpanded"
      :active-panel="toolbarPanel"
      :editor-ready="editorReady"
      :host="editorShell"
      :compact="toolbarCompact"
      :quick-commands="quickToolbarCommands"
      :word-count="wordCount"
      :character-count="characterCount"
      :line-count="lineCount"
      @run-command="(commandId, restoreRange) => emit('run-toolbar-command', commandId, restoreRange)"
      @toggle-expanded="emit('toggle-toolbar')"
      @set-panel="panel => emit('set-toolbar-panel', panel)"
    />

    <Transition name="editor-sheet">
      <EditorActionSheet
        v-if="editorMenuOpen"
        :can-share="canShare"
        :can-export-pdf="canExportPdf"
        :can-save-to-device="canSaveToDevice"
        :can-save-copy="canSaveCopy"
        :sharing="sharing"
        :exporting-pdf="exportingPdf"
        :saving-to-device="savingToDevice"
        :saving-copy="savingCopy"
        @close="emit('close-menu')"
        @share="emit('share')"
        @export-pdf="emit('export-pdf')"
        @save-to-device="emit('save-to-device')"
        @save-copy="emit('save-copy')"
      />
    </Transition>

    <Transition name="editor-sheet">
      <LinkInsertSheet
        v-if="linkSheetOpen"
        :text="linkText"
        :url="linkUrl"
        @update:text="value => emit('update:linkText', value)"
        @update:url="value => emit('update:linkUrl', value)"
        @cancel="emit('close-link-sheet')"
        @insert="emit('insert-link')"
      />
    </Transition>

    <Transition name="editor-sheet">
      <LocalDraftExitPrompt
        v-if="draftExitPromptOpen"
        :can-save-to-device="draftCanSaveToDevice"
        :can-keep-draft="draftCanKeepLocal"
        :saving="draftSaving"
        @save-to-device="emit('save-draft-to-device')"
        @keep="emit('keep-local-draft')"
        @discard="emit('discard-local-draft')"
      />
    </Transition>

    <Transition name="editor-sheet">
      <AndroidExitPrompt
        v-if="androidExitPromptOpen"
        :message="androidExitMessage"
        :can-save-copy="androidCanSaveCopy"
        :can-keep-recovery="androidCanKeepRecovery"
        :saving="androidSaving"
        @save-copy="emit('save-android-copy')"
        @keep-recovery="emit('keep-android-recovery')"
        @discard="emit('discard-android-changes')"
      />
    </Transition>
  </main>
</template>
