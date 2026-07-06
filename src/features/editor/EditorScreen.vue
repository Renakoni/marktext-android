<script setup lang="ts">
import { onBeforeUnmount, watch, ref, type CSSProperties } from 'vue'
import AndroidExitPrompt from './components/AndroidExitPrompt.vue'
import EditorActionSheet from './components/EditorActionSheet.vue'
import LinkInsertSheet from './components/LinkInsertSheet.vue'
import LocalDraftExitPrompt from './components/LocalDraftExitPrompt.vue'
import MobileEditorToolbar from './components/MobileEditorToolbar.vue'
import type { MobileCommandId } from '../../lib/mobileCommands'
import type {
  MobileEditorToolbarPanel,
  MobileToolbarCommandButton,
} from '../../lib/mobileToolbarConfig'
import { useI18n } from '../../lib/i18n'

defineProps<{
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
  canSaveToDevice: boolean
  canSaveCopy: boolean
  sharing: boolean
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
}>()

const emit = defineEmits<{
  back: []
  search: []
  'toggle-menu': []
  'close-menu': []
  share: []
  'save-to-device': []
  'save-copy': []
  'run-toolbar-command': [commandId: MobileCommandId]
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
const { t } = useI18n()

watch(editorHost, element => emit('editor-host-change', element), { immediate: true })

onBeforeUnmount(() => {
  emit('editor-host-change', null)
})
</script>

<template>
  <main class="app-shell">
    <header class="top-bar">
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
        class="editor-host-shell"
        :dir="textDirection"
        :style="editorStyleVars"
        :aria-busy="!editorReady"
        :data-testid="editorReady ? 'editor-host' : 'editor-loading-host'"
      >
        <div ref="editorHost" class="muya-host" />
      </div>
    </section>

    <MobileEditorToolbar
      v-if="toolbarVisible"
      :expanded="toolbarExpanded"
      :active-panel="toolbarPanel"
      :editor-ready="editorReady"
      :compact="toolbarCompact"
      :quick-commands="quickToolbarCommands"
      :word-count="wordCount"
      :character-count="characterCount"
      :line-count="lineCount"
      @run-command="commandId => emit('run-toolbar-command', commandId)"
      @toggle-expanded="emit('toggle-toolbar')"
      @set-panel="panel => emit('set-toolbar-panel', panel)"
    />

    <Transition name="editor-sheet">
      <EditorActionSheet
        v-if="editorMenuOpen"
        :can-share="canShare"
        :can-save-to-device="canSaveToDevice"
        :can-save-copy="canSaveCopy"
        :sharing="sharing"
        :saving-to-device="savingToDevice"
        :saving-copy="savingCopy"
        @close="emit('close-menu')"
        @share="emit('share')"
        @save-to-device="emit('save-to-device')"
        @save-copy="emit('save-copy')"
      />
    </Transition>

    <LinkInsertSheet
      v-if="linkSheetOpen"
      :text="linkText"
      :url="linkUrl"
      @update:text="value => emit('update:linkText', value)"
      @update:url="value => emit('update:linkUrl', value)"
      @cancel="emit('close-link-sheet')"
      @insert="emit('insert-link')"
    />

    <LocalDraftExitPrompt
      v-if="draftExitPromptOpen"
      :can-save-to-device="draftCanSaveToDevice"
      :can-keep-draft="draftCanKeepLocal"
      :saving="draftSaving"
      @save-to-device="emit('save-draft-to-device')"
      @keep="emit('keep-local-draft')"
      @discard="emit('discard-local-draft')"
    />

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
  </main>
</template>
