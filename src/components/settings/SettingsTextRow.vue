<script setup lang="ts">
defineProps<{
  label: string
  modelValue: string
  placeholder?: string
  multiline?: boolean
  testId?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="settings-text-row" :data-testid="testId">
    <span class="settings-text-label">{{ label }}</span>
    <textarea
      v-if="multiline"
      class="settings-text-input is-multiline"
      rows="4"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <input
      v-else
      class="settings-text-input"
      type="text"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </label>
</template>

<style scoped>
.settings-text-row {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 76px;
  padding: 12px 20px 14px;
  border: 0;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.settings-text-row:last-child {
  border-bottom: 0;
}

.settings-text-label {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.008em;
  overflow-wrap: anywhere;
}

.settings-text-input {
  width: 100%;
  min-height: 40px;
  padding: 8px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm, 10px);
  background: var(--surface-muted);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  line-height: 1.35;
}

.settings-text-input.is-multiline {
  resize: vertical;
}

.settings-text-input:focus-visible {
  border-color: var(--accent);
  outline: 2px solid color-mix(in srgb, var(--accent) 18%, transparent);
  outline-offset: 1px;
}
</style>
