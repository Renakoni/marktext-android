<script setup lang="ts">
defineProps<{
  label: string
  modelValue: boolean
  testId?: string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <button
    class="settings-toggle-row"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :data-testid="testId"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="settings-toggle-label">{{ label }}</span>
    <span class="settings-toggle-track" aria-hidden="true">
      <span class="settings-toggle-thumb" />
    </span>
  </button>
</template>

<style scoped>
.settings-toggle-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  width: min(100%, 760px);
  min-height: 64px;
  margin: 0 auto;
  padding: 12px 20px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  touch-action: manipulation;
}

.settings-toggle-row:last-child {
  border-bottom: 0;
}

.settings-toggle-row:active {
  background: var(--surface-muted);
}

.settings-toggle-row:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 24%, transparent);
  outline-offset: -2px;
}

.settings-toggle-label {
  min-width: 0;
  font-size: 16px;
  font-weight: 720;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.settings-toggle-track {
  position: relative;
  width: 52px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 15%, var(--surface));
  transition:
    background 160ms ease-out,
    border-color 160ms ease-out;
}

.settings-toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(26, 44, 50, 0.18);
  transition: transform 180ms ease-out;
}

.settings-toggle-row[aria-checked='true'] .settings-toggle-track {
  border-color: color-mix(in srgb, var(--accent) 54%, var(--border));
  background: var(--accent);
}

.settings-toggle-row[aria-checked='true'] .settings-toggle-thumb {
  transform: translateX(20px);
}
</style>
