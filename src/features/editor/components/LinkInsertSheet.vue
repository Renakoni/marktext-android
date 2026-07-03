<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'

const props = defineProps<{
  text: string
  url: string
}>()

const emit = defineEmits<{
  cancel: []
  insert: []
  'update:text': [value: string]
  'update:url': [value: string]
}>()

const linkUrlInput = ref<HTMLInputElement | null>(null)
const { t } = useI18n()
const canInsert = computed(() => props.url.trim().length > 0)
const textValue = computed({
  get: () => props.text,
  set: value => emit('update:text', value),
})
const urlValue = computed({
  get: () => props.url,
  set: value => emit('update:url', value),
})

onMounted(() => {
  void nextTick(() => {
    linkUrlInput.value?.focus()
  })
})
</script>

<template>
  <section
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="link-sheet-title"
    data-testid="link-insert-sheet"
    @keydown.esc="emit('cancel')"
  >
    <form class="draft-save-panel link-insert-panel" @submit.prevent="emit('insert')">
      <h2 id="link-sheet-title">{{ t('editor.link.title') }}</h2>
      <label class="link-field">
        <span>{{ t('editor.link.text') }}</span>
        <input
          v-model="textValue"
          type="text"
          autocomplete="off"
          autocapitalize="sentences"
          data-testid="link-text-input"
        >
      </label>
      <label class="link-field">
        <span>{{ t('editor.link.url') }}</span>
        <input
          ref="linkUrlInput"
          v-model="urlValue"
          type="text"
          inputmode="url"
          autocomplete="url"
          autocapitalize="none"
          spellcheck="false"
          data-testid="link-url-input"
        >
      </label>
      <div class="draft-save-actions">
        <button
          class="primary-action"
          type="submit"
          data-testid="link-insert-button"
          :disabled="!canInsert"
        >
          {{ t('editor.link.insert') }}
        </button>
        <button type="button" data-testid="link-cancel-button" @click="emit('cancel')">
          {{ t('editor.link.cancel') }}
        </button>
      </div>
    </form>
  </section>
</template>
