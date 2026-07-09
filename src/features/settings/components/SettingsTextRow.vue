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
  position: relative;
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 76px;
  padding: 12px 20px 14px;
  border: 0;
  color: var(--text);
}

.settings-text-label {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.006em;
  overflow-wrap: anywhere;
}

.settings-text-input {
  width: 100%;
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  line-height: 1.35;
  transition:
    border-color var(--dur-standard) var(--ease-out),
    background-color var(--dur-standard) var(--ease-out);
}

.settings-text-input.is-multiline {
  resize: vertical;
}

.settings-text-input:focus-visible {
  border-color: var(--accent);
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
</style>
