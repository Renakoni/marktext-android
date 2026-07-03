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
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-width: 0;
  min-height: 60px;
  padding: 12px 20px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  touch-action: manipulation;
}

.settings-toggle-row:active {
  background: var(--surface-muted);
}

.settings-toggle-row:focus-visible {
  outline: 2px solid var(--focus-ring-22);
  outline-offset: -2px;
}

.settings-toggle-label {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.008em;
  overflow-wrap: anywhere;
}

.settings-toggle-track {
  position: relative;
  width: 50px;
  height: 30px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface-sunken);
  transition:
    background 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    border-color 160ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.settings-toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--shadow-toggle-thumb);
  transition: transform 180ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.settings-toggle-row[aria-checked='true'] .settings-toggle-track {
  border-color: var(--accent);
  background: var(--accent);
}

.settings-toggle-row[aria-checked='true'] .settings-toggle-thumb {
  transform: translateX(20px);
}
</style>
