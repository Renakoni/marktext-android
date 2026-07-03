<script setup lang="ts">
import { useI18n } from '../../../lib/i18n'

defineProps<{
  canShare: boolean
  canSaveToDevice: boolean
  canSaveCopy: boolean
  sharing: boolean
  savingToDevice: boolean
  savingCopy: boolean
}>()

const emit = defineEmits<{
  close: []
  share: []
  'save-to-device': []
  'save-copy': []
}>()

const { t } = useI18n()
</script>

<template>
  <section
    class="editor-action-sheet"
    role="dialog"
    aria-modal="true"
    :aria-label="t('editor.actions.documentActions')"
    data-testid="editor-action-sheet"
    @click="emit('close')"
    @keydown.esc="emit('close')"
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
