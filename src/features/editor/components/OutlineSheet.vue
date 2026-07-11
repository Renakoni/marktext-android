<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { OutlineItem } from '../documentOutline'
import { useI18n } from '../../../lib/i18n'

defineProps<{
  items: OutlineItem[]
}>()

const emit = defineEmits<{
  close: []
  select: [slug: string]
}>()

const { t } = useI18n()

// Move accessibility focus into the dialog on open. This is DOM focus only:
// the editor was blurred before the sheet opened, so Muya's cached editing
// selection is untouched and the keyboard stays closed.
const panel = ref<HTMLElement | null>(null)

watch(panel, element => {
  if (element) {
    void nextTick(() => element.focus({ preventScroll: true }))
  }
})

// The background is inert while the sheet is open, but hardware Tab could
// still walk focus out of the dialog to the document body. Cycle it inside
// the panel instead (aria-modal alone does not contain keyboard focus).
function trapTabKey(event: KeyboardEvent) {
  const root = panel.value
  if (!root) {
    return
  }

  const focusables = Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled)'))
  if (focusables.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement

  if (event.shiftKey) {
    if (active === first || active === root) {
      event.preventDefault()
      last.focus()
    }
  } else if (active === last) {
    event.preventDefault()
    first.focus()
  }
}
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
      @keydown.esc="emit('close')"
      @keydown.tab="trapTabKey"
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
