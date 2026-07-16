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
  position: relative;
  display: grid;
  /* Cap the implicit track at the available width so the options track can
     never be sized by its single-line max-content and push past the screen. */
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 72px;
  padding: 12px 20px 14px;
  border: 0;
  color: var(--text);
}

.settings-choice-row.is-label-hidden {
  min-height: 64px;
  align-content: center;
}

.settings-choice-label {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.006em;
  overflow-wrap: anywhere;
}

/* Segmented control: sunken track, the active segment floats as a thumb.
   Segments size from their label and wrap onto a second track line when the
   localized labels outgrow the row (for example German "Benutzerdefiniert"
   with four options on a phone), instead of pushing past the screen edge. */
.settings-choice-options {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  width: 100%;
  min-width: 0;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
}

.settings-choice-option {
  flex: 1 0 auto;
  min-width: 72px;
  max-width: 100%;
  min-height: 36px;
  padding: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: -0.004em;
  touch-action: manipulation;
  transition:
    background-color var(--dur-standard) var(--ease-out),
    color var(--dur-standard) var(--ease-out),
    box-shadow var(--dur-standard) var(--ease-out);
}

.settings-choice-option.is-active {
  background: var(--surface-raised);
  color: var(--text);
  font-weight: 600;
  box-shadow: var(--shadow-thumb);
}

.settings-choice-option:not(.is-active):active {
  color: var(--text);
  background: var(--press);
  transition-duration: 0ms;
}

.settings-choice-option:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
</style>
