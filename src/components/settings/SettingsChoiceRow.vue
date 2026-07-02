<script setup lang="ts">
interface SettingsChoiceOption {
  id: string
  label: string
  testId: string
}

defineProps<{
  label?: string
  ariaLabel?: string
  modelValue: string
  options: readonly SettingsChoiceOption[]
  testId?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="settings-choice-row" :class="{ 'is-label-hidden': !label }" :data-testid="testId">
    <span v-if="label" class="settings-choice-label">{{ label }}</span>
    <div class="settings-choice-options" role="group" :aria-label="ariaLabel ?? label">
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
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 72px;
  padding: 12px 20px 14px;
  border: 0;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.settings-choice-row:last-child {
  border-bottom: 0;
}

.settings-choice-row.is-label-hidden {
  min-height: 64px;
  align-content: center;
}

.settings-choice-label {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.008em;
  overflow-wrap: anywhere;
}

.settings-choice-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  gap: 6px;
  width: 100%;
}

.settings-choice-option {
  min-width: 0;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 10px);
  background: var(--surface-muted);
  color: var(--text-muted);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.006em;
  touch-action: manipulation;
  transition:
    background 140ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    color 140ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 140ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.settings-choice-option.is-active {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.settings-choice-option:active {
  transform: translateY(0.5px);
}

.settings-choice-option:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 22%, transparent);
  outline-offset: 1px;
}
</style>
