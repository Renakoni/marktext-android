<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value?: string
  href?: string
  button?: boolean
  chevron?: boolean
  disabled?: boolean
  busy?: boolean
  testId?: string
}>()

defineEmits<{
  activate: []
}>()

const hasChevron = computed(() => Boolean(props.chevron || props.href))
</script>

<template>
  <button
    v-if="button"
    class="settings-row is-action"
    :class="{ 'has-chevron': hasChevron }"
    type="button"
    :disabled="disabled"
    :aria-busy="busy ? 'true' : undefined"
    :data-testid="testId"
    @click="$emit('activate')"
  >
    <span class="settings-row-label">{{ label }}</span>
    <span v-if="value" class="settings-row-value">{{ value }}</span>
  </button>
  <a
    v-else-if="href"
    class="settings-row is-link has-chevron"
    :href="href"
    target="_blank"
    rel="noreferrer"
    :data-testid="testId"
  >
    <span class="settings-row-label">{{ label }}</span>
    <span v-if="value" class="settings-row-value">{{ value }}</span>
  </a>
  <div v-else class="settings-row" :data-testid="testId">
    <span class="settings-row-label">{{ label }}</span>
    <span v-if="value" class="settings-row-value">{{ value }}</span>
  </div>
</template>

<style scoped>
.settings-row {
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
  text-decoration: none;
}

.settings-row.has-chevron {
  grid-template-columns: minmax(0, 1fr) auto 18px;
  padding-right: 16px;
}

.settings-row.has-chevron::after {
  position: absolute;
  top: 50%;
  right: 20px;
  width: 9px;
  height: 9px;
  border-top: 1.4px solid color-mix(in srgb, var(--text-faint) 70%, var(--surface));
  border-right: 1.4px solid color-mix(in srgb, var(--text-faint) 70%, var(--surface));
  content: '';
  transform: translateY(-50%) rotate(45deg);
  pointer-events: none;
}

.settings-row.is-link:active,
.settings-row.is-action:active {
  background: var(--surface-muted);
}

.settings-row.is-link:focus-visible,
.settings-row.is-action:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 22%, transparent);
  outline-offset: -2px;
}

.settings-row.is-action:disabled {
  color: var(--text-faint);
}

.settings-row-label,
.settings-row-value {
  min-width: 0;
  line-height: 1.3;
  overflow-wrap: anywhere;
  white-space: normal;
}

.settings-row-label {
  font-size: 16px;
  font-weight: 560;
  letter-spacing: -0.006em;
}

.settings-row-value {
  max-width: 46vw;
  color: var(--text-muted);
  font-size: 13.5px;
  font-weight: 500;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
