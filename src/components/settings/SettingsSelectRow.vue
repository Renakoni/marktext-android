<script setup lang="ts">
interface SettingsSelectOption {
  id: string
  label: string
}

defineProps<{
  label: string
  modelValue: string
  options: readonly SettingsSelectOption[]
  testId?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="settings-select-row" :data-testid="testId">
    <span class="settings-select-label">{{ label }}</span>
    <select
      class="settings-select"
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="option in options" :key="option.id" :value="option.id">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.settings-select-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(132px, 46%);
  align-items: center;
  gap: 14px;
  width: min(100%, 760px);
  min-height: 64px;
  margin: 0 auto;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.settings-select-row:last-child {
  border-bottom: 0;
}

.settings-select-label {
  min-width: 0;
  font-size: 16px;
  font-weight: 720;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.settings-select {
  min-width: 0;
  min-height: 38px;
  padding: 0 34px 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 86%, var(--surface-muted) 14%);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
}

.settings-select:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 54%, var(--border));
  outline: 2px solid color-mix(in srgb, var(--accent) 18%, transparent);
  outline-offset: 1px;
}

@media (max-width: 380px) {
  .settings-select-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }
}
</style>
