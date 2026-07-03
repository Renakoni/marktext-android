<script setup lang="ts">
defineProps<{
  canSaveToDevice: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  'save-to-device': []
  keep: []
  discard: []
}>()
</script>

<template>
  <section
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="draft-save-title"
    data-testid="draft-save-prompt"
  >
    <div class="draft-save-panel">
      <h2 id="draft-save-title">Save this draft to your device?</h2>
      <p>This draft is saved inside MarkText, but it has not been saved as a Markdown file yet.</p>
      <div class="draft-save-actions">
        <button
          v-if="canSaveToDevice"
          class="primary-action"
          type="button"
          data-testid="prompt-save-to-device-button"
          :disabled="saving"
          @click="emit('save-to-device')"
        >
          Save to device
        </button>
        <button
          type="button"
          data-testid="prompt-keep-draft-button"
          :disabled="saving"
          @click="emit('keep')"
        >
          Keep as draft
        </button>
        <button
          class="danger-action"
          type="button"
          data-testid="prompt-discard-draft-button"
          :disabled="saving"
          @click="emit('discard')"
        >
          Discard
        </button>
      </div>
    </div>
  </section>
</template>
