<script setup lang="ts">
defineProps<{
  message: string
  canSaveCopy: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'save-copy': []
  'keep-recovery': []
  discard: []
}>()
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
      <h2 id="android-exit-title">Save changes before leaving?</h2>
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
          Save a copy
        </button>
        <button
          type="button"
          data-testid="prompt-keep-recovery-button"
          :disabled="saving"
          @click="emit('keep-recovery')"
        >
          Keep recovery draft
        </button>
        <button
          class="danger-action"
          type="button"
          data-testid="prompt-discard-android-changes-button"
          :disabled="saving"
          @click="emit('discard')"
        >
          Discard changes
        </button>
      </div>
    </div>
  </section>
</template>
