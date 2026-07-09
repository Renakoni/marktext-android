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
  min-height: 56px;
  padding: 11px 20px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  touch-action: manipulation;
  transition: background-color var(--dur-standard) var(--ease-out);
}

.settings-toggle-row:active {
  background: var(--press);
  transition-duration: 0ms;
}

.settings-toggle-row:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.settings-toggle-label {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.006em;
  overflow-wrap: anywhere;
}

.settings-toggle-track {
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 999px;
  background: var(--surface-sunken);
  box-shadow: inset 0 0 0 var(--hairline) var(--border-strong);
  transition:
    background-color var(--dur-standard) var(--ease-out),
    box-shadow var(--dur-standard) var(--ease-out);
}

.settings-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--on-accent);
  box-shadow: var(--shadow-thumb);
  transition: transform var(--dur-gentle) var(--ease-spring);
}

.settings-toggle-row[aria-checked='true'] .settings-toggle-track {
  background: var(--accent);
  box-shadow: none;
}

.settings-toggle-row[aria-checked='true'] .settings-toggle-thumb {
  transform: translateX(20px);
}

@media (prefers-reduced-motion: reduce) {
  .settings-toggle-track,
  .settings-toggle-thumb {
    transition: none;
  }
}
</style>
