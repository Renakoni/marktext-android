<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'
import { useModalFocus } from '../../../lib/modalFocus'

const props = defineProps<{
  initialName: string
}>()

const emit = defineEmits<{
  cancel: []
  rename: [name: string]
}>()

const { t } = useI18n()
const name = ref(props.initialName)
const nameInput = ref<HTMLInputElement | null>(null)

const canRename = computed(() => {
  const trimmed = name.value.trim()
  return trimmed.length > 0 && trimmed !== props.initialName.trim()
})

function submit() {
  if (canRename.value) {
    emit('rename', name.value.trim())
  }
}

const modalRoot = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus({
  root: modalRoot,
  initialFocus: () => {
    nameInput.value?.select()
    return nameInput.value
  },
  onEscape: () => emit('cancel'),
})
</script>

<template>
  <section
    ref="modalRoot"
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="home-rename-title"
    tabindex="-1"
    data-testid="home-rename-sheet"
    @click.self="emit('cancel')"
    @keydown="onModalKeydown"
  >
    <form class="draft-save-panel link-insert-panel" @submit.prevent="submit">
      <h2 id="home-rename-title">{{ t('home.rename.title') }}</h2>
      <label class="link-field">
        <span>{{ t('home.rename.label') }}</span>
        <input
          ref="nameInput"
          v-model="name"
          type="text"
          autocomplete="off"
          autocapitalize="sentences"
          spellcheck="false"
          data-testid="home-rename-input"
        >
      </label>
      <div class="draft-save-actions">
        <button
          class="primary-action"
          type="submit"
          data-testid="home-rename-confirm"
          :disabled="!canRename"
        >
          {{ t('home.rename.confirm') }}
        </button>
        <button type="button" data-testid="home-rename-cancel" @click="emit('cancel')">
          {{ t('editor.link.cancel') }}
        </button>
      </div>
    </form>
  </section>
</template>
