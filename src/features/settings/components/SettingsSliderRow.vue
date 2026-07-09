<script setup lang="ts">
defineProps<{
  label: string
  modelValue: number
  min: number
  max: number
  step: number
  unit?: string
  testId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function updateValue(value: string) {
  emit('update:modelValue', Number(value))
}
</script>

<template>
  <label class="settings-slider-row" :data-testid="testId">
    <span class="settings-slider-head">
      <span class="settings-slider-label">{{ label }}</span>
      <span class="settings-slider-value">{{ modelValue }}{{ unit ?? '' }}</span>
    </span>
    <input
      class="settings-slider"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="updateValue(($event.target as HTMLInputElement).value)"
    >
  </label>
</template>

<style scoped>
.settings-slider-row {
  position: relative;
  display: grid;
  gap: 14px;
  width: 100%;
  min-width: 0;
  min-height: 76px;
  padding: 12px 20px 16px;
  border: 0;
  color: var(--text);
}

.settings-slider-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
}

.settings-slider-label {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.006em;
  overflow-wrap: anywhere;
}

.settings-slider-value {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.settings-slider {
  width: 100%;
  accent-color: var(--accent);
}

.settings-slider:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 4px;
}
</style>
