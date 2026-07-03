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

.settings-select {
  min-width: 0;
  min-height: 38px;
  padding: 0 34px 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 10px);
  background: var(--surface-muted);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
}

.settings-select:focus-visible {
  border-color: var(--accent);
  outline: 2px solid var(--focus-ring-18);
  outline-offset: 1px;
}

@media (max-width: 380px) {
  .settings-select-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }
}
</style>
