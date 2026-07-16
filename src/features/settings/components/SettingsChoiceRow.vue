<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface SettingsChoiceOption {
  id: string
  label: string
  testId: string
}

const props = defineProps<{
  label?: string
  ariaLabel?: string
  modelValue: string
  options: readonly SettingsChoiceOption[]
  testId?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()

// Whether the localized labels fit on one segmented line is a property of the
// rendered text, not the viewport, so CSS alone cannot decide it. Measure the
// single-line overflow and stack the segments into a two-column grid when the
// row cannot hold them — a balanced grid keeps every segment button-shaped
// instead of leaving one label stretched across a full-width bar.
const optionsElement = ref<HTMLElement | null>(null)
const stacked = ref(false)
// The width the single-line layout needs, captured when it overflows; a later
// resize wider than this lets the control return to one line.
let singleLineWidth = 0
let resizeObserver: ResizeObserver | null = null

function measure() {
  const element = optionsElement.value
  if (!element) {
    return
  }

  if (!stacked.value) {
    if (element.scrollWidth > element.clientWidth) {
      singleLineWidth = element.scrollWidth
      stacked.value = true
    }
  } else if (element.clientWidth >= singleLineWidth) {
    stacked.value = false
  }
}

function remeasureFromSingleLine() {
  stacked.value = false
  singleLineWidth = 0
  requestAnimationFrame(measure)
}

watch(
  () => props.options.map(option => option.label).join('\n'),
  remeasureFromSingleLine,
)

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && optionsElement.value) {
    // Deferring keeps the layout mutation out of the observer's delivery
    // cycle; stacking synchronously here triggers the browser's
    // "ResizeObserver loop completed with undelivered notifications" error.
    resizeObserver = new ResizeObserver(() => requestAnimationFrame(measure))
    resizeObserver.observe(optionsElement.value)
  }
  // Web-font swaps change label widths without resizing the container.
  document.fonts?.ready.then(measure)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div class="settings-choice-row" :class="{ 'is-label-hidden': !label }" :data-testid="testId">
    <span v-if="label" class="settings-choice-label">{{ label }}</span>
    <div
      ref="optionsElement"
      class="settings-choice-options"
      :class="{ 'is-stacked': stacked }"
      role="group"
      :aria-label="ariaLabel ?? label"
    >
      <button
        v-for="option in options"
        :key="option.id"
        class="settings-choice-option"
        :class="{ 'is-active': modelValue === option.id }"
        type="button"
        :aria-pressed="modelValue === option.id"
        :data-testid="option.testId"
        @click="$emit('update:modelValue', option.id)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-choice-row {
  position: relative;
  display: grid;
  /* Cap the implicit track at the available width so the options track can
     never be sized by its single-line max-content and push past the screen. */
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 72px;
  padding: 12px 20px 14px;
  border: 0;
  color: var(--text);
}

.settings-choice-row.is-label-hidden {
  min-height: 64px;
  align-content: center;
}

.settings-choice-label {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.006em;
  overflow-wrap: anywhere;
}

/* Segmented control: sunken track, the active segment floats as a thumb.
   Overflow stays clipped for the frame before `measure()` stacks the control. */
.settings-choice-options {
  display: flex;
  gap: 2px;
  width: 100%;
  min-width: 0;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  overflow: hidden;
}

/* Two balanced columns once the localized labels outgrow the single line
   (for example German "Benutzerdefiniert" with four options on a phone). */
.settings-choice-options.is-stacked {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.settings-choice-option {
  flex: 1 0 auto;
  min-width: 72px;
  max-width: 100%;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: -0.004em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  touch-action: manipulation;
  transition:
    background-color var(--dur-standard) var(--ease-out),
    color var(--dur-standard) var(--ease-out),
    box-shadow var(--dur-standard) var(--ease-out);
}

.settings-choice-option.is-active {
  background: var(--surface-raised);
  color: var(--text);
  font-weight: 600;
  box-shadow: var(--shadow-thumb);
}

.settings-choice-option:not(.is-active):active {
  color: var(--text);
  background: var(--press);
  transition-duration: 0ms;
}

.settings-choice-option:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
</style>
