<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '../../../lib/i18n'
import { useModalFocus } from '../../../lib/modalFocus'

defineProps<{
  canShare: boolean
  canExportPdf: boolean
  canSaveToDevice: boolean
  canSaveCopy: boolean
  sharing: boolean
  exportingPdf: boolean
  savingToDevice: boolean
  savingCopy: boolean
}>()

const emit = defineEmits<{
  close: []
  share: []
  'export-pdf': []
  'save-to-device': []
  'save-copy': []
}>()

const { t } = useI18n()
const modalRoot = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus({
  root: modalRoot,
  onEscape: () => emit('close'),
})
</script>

<template>
  <section
    ref="modalRoot"
    class="editor-action-sheet"
    role="dialog"
    aria-modal="true"
    :aria-label="t('editor.actions.documentActions')"
    tabindex="-1"
    data-testid="editor-action-sheet"
    @click="emit('close')"
    @keydown="onModalKeydown"
  >
    <div class="editor-action-panel" @click.stop>
      <div class="editor-action-grabber" aria-hidden="true" />
      <h2 class="editor-action-title">{{ t('editor.actions.document') }}</h2>
      <div class="editor-action-list" role="menu">
        <button
          v-if="canShare"
          class="editor-action-row"
          type="button"
          role="menuitem"
          data-testid="share-document-button"
          :disabled="sharing"
          @click="emit('share')"
        >
          <span class="editor-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="6" cy="12" r="2.4" fill="currentColor" stroke="none" />
              <circle cx="18" cy="6" r="2.4" fill="currentColor" stroke="none" />
              <circle cx="18" cy="18" r="2.4" fill="currentColor" stroke="none" />
              <path d="M8.1 10.9l7.8-3.6M8.1 13.1l7.8 3.6" />
            </svg>
          </span>
          <span class="editor-action-label">{{ t('editor.actions.share') }}</span>
        </button>
        <button
          v-if="canExportPdf"
          class="editor-action-row"
          type="button"
          role="menuitem"
          data-testid="export-pdf-button"
          :disabled="exportingPdf"
          @click="emit('export-pdf')"
        >
          <span class="editor-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 4h9l3 3v13H6z" />
              <path d="M9 4v5h6" />
              <path d="M8.6 17.5v-4h1.5a1.25 1.25 0 0 1 0 2.5H8.6" />
              <path d="M12.9 17.5v-4h1a1.7 2 0 0 1 0 4z" />
              <path d="M17.6 17.5v-4h2.1M17.6 15.7h1.7" />
            </svg>
          </span>
          <span class="editor-action-label">{{ t('editor.actions.exportPdf') }}</span>
        </button>
        <button
          v-if="canSaveToDevice"
          class="editor-action-row"
          type="button"
          role="menuitem"
          data-testid="save-to-device-button"
          :disabled="savingToDevice"
          @click="emit('save-to-device')"
        >
          <span class="editor-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 4h9l3 3v13H6z" />
              <path d="M9 4v5h6" />
              <rect x="9" y="14" width="6" height="5" rx="0.6" />
            </svg>
          </span>
          <span class="editor-action-label">{{ t('editor.actions.saveToDevice') }}</span>
        </button>
        <button
          v-if="canSaveCopy"
          class="editor-action-row"
          type="button"
          role="menuitem"
          data-testid="save-copy-button"
          :disabled="savingCopy"
          @click="emit('save-copy')"
        >
          <span class="editor-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 4h9l3 3v13H6z" />
              <path d="M9 4v5h6" />
              <rect x="9" y="14" width="6" height="5" rx="0.6" />
              <circle cx="18" cy="17.5" r="3.4" fill="var(--surface)" stroke="none" />
              <path d="M18 15.6v3.8M16.1 17.5h3.8" />
            </svg>
          </span>
          <span class="editor-action-label">{{ t('editor.actions.saveCopy') }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
