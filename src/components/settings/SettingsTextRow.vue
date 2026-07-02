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
  width: min(100%, 760px);
  min-height: 76px;
  margin: 0 auto;
  padding: 12px 20px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.settings-text-row:last-child {
  border-bottom: 0;
}

.settings-text-label {
  min-width: 0;
  font-size: 16px;
  font-weight: 720;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.settings-text-input {
  width: 100%;
  min-height: 40px;
  padding: 8px 11px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 86%, var(--surface-muted) 14%);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  line-height: 1.35;
}

.settings-text-input.is-multiline {
  resize: vertical;
}

.settings-text-input:focus-visible {
  border-color: color-mix(in srgb, var(--accent) 54%, var(--border));
  outline: 2px solid color-mix(in srgb, var(--accent) 18%, transparent);
  outline-offset: 1px;
}
</style>
