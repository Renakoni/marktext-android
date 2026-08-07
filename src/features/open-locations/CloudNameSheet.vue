<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from '../../lib/i18n'
import { useModalFocus } from '../../lib/modalFocus'

const props = defineProps<{
  suggestedName: string
}>()

const emit = defineEmits<{
  confirm: [name: string]
  cancel: []
}>()

const { t } = useI18n()
const modalRoot = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus({ root: modalRoot })
const name = ref(props.suggestedName)
const nameInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  nameInput.value?.focus()
  nameInput.value?.select()
})

function confirm() {
  const trimmed = name.value.trim()
  if (trimmed.length === 0) {
    return
  }
  emit('confirm', trimmed)
}
</script>

<template>
  <section
    ref="modalRoot"
    class="draft-save-sheet save-flow-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cloud-name-title"
    tabindex="-1"
    data-testid="cloud-name-sheet"
    @keydown="onModalKeydown"
  >
    <div class="draft-save-panel">
      <h2 id="cloud-name-title">{{ t('saveAs.nameTitle') }}</h2>
      <input
        ref="nameInput"
        v-model="name"
        class="cloud-name-input"
        type="text"
        enterkeyhint="done"
        aria-labelledby="cloud-name-title"
        data-testid="cloud-name-input"
        @keydown.enter.prevent="confirm"
      >
      <div class="draft-save-actions">
        <button
          class="primary-action"
          type="button"
          data-testid="cloud-name-confirm"
          :disabled="name.trim().length === 0"
          @click="confirm"
        >
          {{ t('saveAs.nameConfirm') }}
        </button>
        <button type="button" data-testid="cloud-name-cancel" @click="emit('cancel')">
          {{ t('saveAs.cancel') }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cloud-name-input {
  width: 100%;
  box-sizing: border-box;
  margin: 4px 0 12px;
  padding: 10px 12px;
  font-size: 15px;
  color: var(--text);
  background: var(--surface, transparent);
  border: 1px solid var(--border, currentColor);
  border-radius: var(--radius-sm);
}
</style>
