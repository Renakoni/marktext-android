<script setup lang="ts">
import { computed, ref } from 'vue'

interface SettingsSelectOption {
  id: string
  label: string
}

const props = defineProps<{
  label: string
  modelValue: string
  options: readonly SettingsSelectOption[]
  testId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const selectedOption = computed(() =>
  props.options.find(option => option.id === props.modelValue) ?? props.options[0],
)

function openPicker() {
  isOpen.value = true
}

function closePicker() {
  isOpen.value = false
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  closePicker()
}
</script>

<template>
  <div class="settings-select-row" :data-testid="testId">
    <span class="settings-select-label">{{ label }}</span>

    <button
      class="settings-select-trigger"
      type="button"
      :aria-label="label"
      :aria-expanded="isOpen"
      :data-testid="testId ? `${testId}-trigger` : undefined"
      @click="openPicker"
    >
      <span>{{ selectedOption?.label }}</span>
    </button>

    <Transition name="select-sheet">
      <div
        v-if="isOpen"
        class="settings-select-overlay"
        role="presentation"
        @click.self="closePicker"
      >
        <div
          class="settings-select-panel"
          role="listbox"
          :aria-label="label"
          @keydown.esc="closePicker"
        >
          <div class="settings-select-grabber" aria-hidden="true" />
          <button
            v-for="option in options"
            :key="option.id"
            class="settings-select-option"
            :class="{ 'is-selected': modelValue === option.id }"
            type="button"
            role="option"
            :aria-selected="modelValue === option.id"
            :data-testid="testId ? `${testId}-option-${option.id.replace(/[^a-z0-9]+/gi, '-')}` : undefined"
            @click="selectOption(option.id)"
          >
            <span class="settings-select-option-label">{{ option.label }}</span>
            <span class="settings-select-option-mark" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.settings-select-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(132px, 46%);
  align-items: center;
  gap: 14px;
  width: 100%;
  min-width: 0;
  min-height: 60px;
  padding: 12px 20px;
  border: 0;
  color: var(--text);
}

.settings-select-label {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.006em;
  overflow-wrap: anywhere;
}

.settings-select-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  min-height: 38px;
  padding: 0 32px 0 14px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  touch-action: manipulation;
  transition: background-color var(--dur-standard) var(--ease-out);
}

.settings-select-trigger::after {
  position: absolute;
  right: 14px;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid var(--text-faint);
  border-bottom: 1.5px solid var(--text-faint);
  content: '';
  transform: rotate(45deg) translateY(-2px);
}

.settings-select-trigger span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-select-trigger:active {
  background: var(--surface-sunken);
  transition-duration: 0ms;
}

.settings-select-trigger:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

.settings-select-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: var(--scrim);
}

.settings-select-panel {
  display: grid;
  width: min(100%, 520px);
  max-height: min(72vh, 620px);
  overflow: auto;
  overscroll-behavior: contain;
  padding: 6px 6px calc(env(safe-area-inset-bottom, 0px) + 10px);
  border: 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--surface-raised);
  box-shadow: var(--shadow-float);
}

.settings-select-grabber {
  width: 36px;
  height: 4px;
  margin: 4px auto 8px;
  border-radius: 999px;
  background: var(--border-strong);
}

.settings-select-option {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  align-items: center;
  gap: 16px;
  min-height: 52px;
  padding: 0 12px 0 14px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  text-align: left;
  touch-action: manipulation;
  transition: background-color var(--dur-standard) var(--ease-out);
}

.settings-select-option + .settings-select-option::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 14px;
  border-top: var(--hairline) solid var(--separator);
  pointer-events: none;
}

.settings-select-option:active {
  background: var(--press);
  transition-duration: 0ms;
}

.settings-select-option:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.settings-select-option-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.settings-select-option-mark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-strong);
  border-radius: 999px;
  transition: border var(--dur-standard) var(--ease-out);
}

.settings-select-option.is-selected {
  color: var(--text);
  font-weight: 600;
}

.settings-select-option.is-selected .settings-select-option-mark {
  border: 6px solid var(--accent);
}

.select-sheet-enter-active,
.select-sheet-leave-active {
  transition: opacity var(--dur-standard) var(--ease-out);
}

.select-sheet-enter-active .settings-select-panel,
.select-sheet-leave-active .settings-select-panel {
  transition: transform var(--dur-gentle) var(--ease-out);
}

.select-sheet-enter-from,
.select-sheet-leave-to {
  opacity: 0;
}

.select-sheet-enter-from .settings-select-panel,
.select-sheet-leave-to .settings-select-panel {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .select-sheet-enter-active,
  .select-sheet-leave-active,
  .select-sheet-enter-active .settings-select-panel,
  .select-sheet-leave-active .settings-select-panel {
    transition: none;
  }
}

@media (max-width: 380px) {
  .settings-select-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }
}
</style>
