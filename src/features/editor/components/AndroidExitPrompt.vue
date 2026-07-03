<script setup lang="ts">
import { useI18n } from '../../../lib/i18n'

defineProps<{
  message: string
  canSaveCopy: boolean
  canKeepRecovery: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'save-copy': []
  'keep-recovery': []
  discard: []
}>()

const { t } = useI18n()
</script>

<template>
  <section
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="android-exit-title"
    data-testid="android-exit-prompt"
  >
    <div class="draft-save-panel">
      <h2 id="android-exit-title">{{ t('editor.exit.androidTitle') }}</h2>
      <p>{{ message }}</p>
      <div class="draft-save-actions">
        <button
          v-if="canSaveCopy"
          class="primary-action"
          type="button"
          data-testid="prompt-save-copy-button"
          :disabled="saving"
          @click="emit('save-copy')"
        >
          {{ t('editor.actions.saveCopy') }}
        </button>
        <button
          v-if="canKeepRecovery"
          type="button"
          data-testid="prompt-keep-recovery-button"
          :disabled="saving"
          @click="emit('keep-recovery')"
        >
          {{ t('editor.exit.keepRecovery') }}
        </button>
        <button
          class="danger-action"
          type="button"
          data-testid="prompt-discard-android-changes-button"
          :disabled="saving"
          @click="emit('discard')"
        >
          {{ t('editor.exit.discardChanges') }}
        </button>
      </div>
    </div>
  </section>
</template>
