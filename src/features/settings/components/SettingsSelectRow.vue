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
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.008em;
  overflow-wrap: anywhere;
}

.settings-select-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  min-height: 38px;
  padding: 0 34px 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 10px);
  background: var(--surface-muted);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  touch-action: manipulation;
  transition:
    background 140ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 140ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
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
}

.settings-select-trigger:focus-visible {
  border-color: var(--accent);
  outline: 2px solid var(--focus-ring-18);
  outline-offset: 1px;
}

.settings-select-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 18px;
  background: var(--draft-scrim);
}

.settings-select-panel {
  display: grid;
  width: min(100%, 420px);
  max-height: min(72vh, 620px);
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border);
  border-radius: var(--radius, 14px);
  background: var(--surface);
  box-shadow: var(--shadow-toolbar-menu);
}

.settings-select-option {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  align-items: center;
  gap: 16px;
  min-height: 54px;
  padding: 0 16px 0 18px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 16px;
  font-weight: 560;
  text-align: left;
  touch-action: manipulation;
}

.settings-select-option:last-child {
  border-bottom: 0;
}

.settings-select-option:active {
  background: var(--surface-muted);
}

.settings-select-option:focus-visible {
  outline: 2px solid var(--focus-ring-22);
  outline-offset: -3px;
}

.settings-select-option-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.settings-select-option-mark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--text-faint);
  border-radius: 999px;
}

.settings-select-option.is-selected {
  color: var(--accent-strong);
}

.settings-select-option.is-selected .settings-select-option-mark {
  border: 6px solid var(--accent);
}

@media (max-width: 380px) {
  .settings-select-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }

  .settings-select-overlay {
    padding: 12px;
  }
}
</style>
