<script setup lang="ts">
import { ref } from 'vue'
import type { OutlineItem } from '../documentOutline'
import { useI18n } from '../../../lib/i18n'
import { useModalFocus } from '../../../lib/modalFocus'

defineProps<{
  items: OutlineItem[]
}>()

const emit = defineEmits<{
  close: []
  select: [slug: string]
}>()

const { t } = useI18n()

const panel = ref<HTMLElement | null>(null)
const { onModalKeydown } = useModalFocus({
  root: panel,
  initialFocus: () => panel.value,
  onEscape: () => emit('close'),
  restoreFocus: false,
})
</script>

<template>
  <section
    class="editor-action-sheet"
    role="presentation"
    data-testid="outline-sheet-scrim"
    @click="emit('close')"
  >
    <div
      ref="panel"
      class="editor-action-panel outline-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="t('editor.outline.title')"
      tabindex="-1"
      data-testid="outline-sheet"
      @click.stop
      @keydown="onModalKeydown"
    >
      <header class="outline-header">
        <div class="editor-action-grabber" aria-hidden="true" />
        <div class="outline-header-row">
          <h2 class="editor-action-title outline-title">{{ t('editor.outline.title') }}</h2>
          <button
            class="icon-button"
            type="button"
            :aria-label="t('editor.outline.close')"
            data-testid="outline-close-button"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        </div>
      </header>

      <p v-if="items.length === 0" class="outline-empty" data-testid="outline-empty">
        {{ t('editor.outline.empty') }}
      </p>

      <ul v-else class="outline-list" data-testid="outline-list">
        <li v-for="(item, index) in items" :key="`${item.slug}-${index}`">
          <button
            class="outline-row"
            type="button"
            :style="{ '--outline-indent': item.indent }"
            :data-outline-level="item.level"
            :data-outline-indent="item.indent"
            data-testid="outline-row"
            @click="emit('select', item.slug)"
          >
            <span class="outline-row-text" dir="auto">{{ item.text }}</span>
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
