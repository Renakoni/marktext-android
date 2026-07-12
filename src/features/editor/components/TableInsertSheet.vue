<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from '../../../lib/i18n'
import {
  TABLE_SHEET_LIMITS,
  clampTableSheetDimension,
} from '../editorToolbarWorkflow'

// Size is chosen at insert time because table structure is immutable after
// insertion on Android (no row/column editing plugins). Steppers instead of
// number inputs: no IME over the sheet, hard bounds by construction.
const props = defineProps<{
  rows: number
  columns: number
}>()

const emit = defineEmits<{
  cancel: []
  insert: []
  'update:rows': [value: number]
  'update:columns': [value: number]
}>()

const insertButton = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const { t } = useI18n()

const canDecrease = computed(() => ({
  rows: props.rows > TABLE_SHEET_LIMITS.rows.min,
  columns: props.columns > TABLE_SHEET_LIMITS.columns.min,
}))
const canIncrease = computed(() => ({
  rows: props.rows < TABLE_SHEET_LIMITS.rows.max,
  columns: props.columns < TABLE_SHEET_LIMITS.columns.max,
}))

function step(kind: 'rows' | 'columns', delta: 1 | -1) {
  const current = kind === 'rows' ? props.rows : props.columns
  const next = clampTableSheetDimension(kind, current + delta)
  if (kind === 'rows') {
    emit('update:rows', next)
  } else {
    emit('update:columns', next)
  }
}

onMounted(() => {
  // The default size is ready to insert, so lead the focus there; steppers
  // never summon the soft keyboard.
  void nextTick(() => {
    insertButton.value?.focus({ preventScroll: true })
  })
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
    return
  }

  if (active === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <section
    class="draft-save-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="table-sheet-title"
    data-testid="table-insert-sheet"
    @keydown.esc="emit('cancel')"
    @keydown.tab="trapTabKey"
  >
    <form
      ref="panel"
      class="draft-save-panel table-insert-panel"
      @submit.prevent="emit('insert')"
    >
      <h2 id="table-sheet-title">{{ t('editor.table.title') }}</h2>
      <div class="table-size-field">
        <span :id="`table-rows-label`">{{ t('editor.table.rows') }}</span>
        <div class="table-size-stepper" role="group" aria-labelledby="table-rows-label">
          <button
            type="button"
            class="table-step-button"
            :aria-label="t('editor.table.decreaseRows')"
            :disabled="!canDecrease.rows"
            data-testid="table-rows-decrement"
            @click="step('rows', -1)"
          >
            −
          </button>
          <output
            class="table-size-value"
            aria-live="polite"
            aria-atomic="true"
            :aria-label="`${t('editor.table.rows')} ${rows}`"
            data-testid="table-rows-value"
          >{{ rows }}</output>
          <button
            type="button"
            class="table-step-button"
            :aria-label="t('editor.table.increaseRows')"
            :disabled="!canIncrease.rows"
            data-testid="table-rows-increment"
            @click="step('rows', 1)"
          >
            +
          </button>
        </div>
      </div>
      <div class="table-size-field">
        <span :id="`table-columns-label`">{{ t('editor.table.columns') }}</span>
        <div class="table-size-stepper" role="group" aria-labelledby="table-columns-label">
          <button
            type="button"
            class="table-step-button"
            :aria-label="t('editor.table.decreaseColumns')"
            :disabled="!canDecrease.columns"
            data-testid="table-columns-decrement"
            @click="step('columns', -1)"
          >
            −
          </button>
          <output
            class="table-size-value"
            aria-live="polite"
            aria-atomic="true"
            :aria-label="`${t('editor.table.columns')} ${columns}`"
            data-testid="table-columns-value"
          >{{ columns }}</output>
          <button
            type="button"
            class="table-step-button"
            :aria-label="t('editor.table.increaseColumns')"
            :disabled="!canIncrease.columns"
            data-testid="table-columns-increment"
            @click="step('columns', 1)"
          >
            +
          </button>
        </div>
      </div>
      <div class="draft-save-actions">
        <button
          ref="insertButton"
          class="primary-action"
          type="submit"
          data-testid="table-insert-button"
        >
          {{ t('editor.table.insert') }}
        </button>
        <button type="button" data-testid="table-cancel-button" @click="emit('cancel')">
          {{ t('editor.table.cancel') }}
        </button>
      </div>
    </form>
  </section>
</template>
