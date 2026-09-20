<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'
import { useModalFocus } from '../../../lib/modalFocus'

const props = defineProps<{
  folderName: string | null
  imageCount: number
}>()

const emit = defineEmits<{
  allow: []
  decline: []
}>()

const { t } = useI18n()
const sheet = ref<HTMLElement | null>(null)
const declineButton = ref<HTMLButtonElement | null>(null)

// Android only grants the app the Markdown file itself, so a relative image
// path stays unreadable until the user also grants the folder holding it. Say
// which folder that is whenever the provider could name it.
const bodyText = computed(() => {
  if (props.folderName) {
    return props.imageCount === 1
      ? t('editor.localImages.body.one', { folder: props.folderName })
      : t('editor.localImages.body.other', {
          count: props.imageCount,
          folder: props.folderName,
        })
  }

  return props.imageCount === 1
    ? t('editor.localImages.bodyNoFolder.one')
    : t('editor.localImages.bodyNoFolder.other', { count: props.imageCount })
})

function decline() {
  emit('decline')
}

const { onModalKeydown } = useModalFocus({
  root: sheet,
  initialFocus: () => declineButton.value,
  onEscape: decline,
})
</script>

<template>
  <section
    ref="sheet"
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="local-image-access-title"
    tabindex="-1"
    data-testid="local-image-access-prompt"
    @click.self="decline"
    @keydown="onModalKeydown"
  >
    <div class="draft-save-panel">
      <h2 id="local-image-access-title">{{ t('editor.localImages.title') }}</h2>
      <p>{{ bodyText }}</p>
      <div class="draft-save-actions">
        <button
          type="button"
          data-testid="local-image-access-allow"
          @click="emit('allow')"
        >
          {{ t('editor.localImages.allow') }}
        </button>
        <button
          ref="declineButton"
          type="button"
          data-testid="local-image-access-decline"
          @click="decline"
        >
          {{ t('editor.localImages.decline') }}
        </button>
      </div>
    </div>
  </section>
</template>
