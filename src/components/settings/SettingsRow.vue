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
  width: min(100%, 760px);
  min-height: 64px;
  margin: 0 auto;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-decoration: none;
}

.settings-row:last-child {
  border-bottom: 0;
}

.settings-row.has-chevron {
  padding-right: 48px;
}

.settings-row.has-chevron::after {
  position: absolute;
  top: 50%;
  right: 24px;
  width: 8px;
  height: 8px;
  border-top: 2px solid currentColor;
  border-right: 2px solid currentColor;
  color: var(--text-muted);
  content: '';
  transform: translateY(-50%) rotate(45deg);
}

.settings-row.is-link:active,
.settings-row.is-action:active {
  background: var(--surface-muted);
}

.settings-row.is-link:focus-visible,
.settings-row.is-action:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 24%, transparent);
  outline-offset: -2px;
}

.settings-row.is-action {
  width: 100%;
  max-width: 760px;
  border-top: 0;
  border-right: 0;
  border-left: 0;
  text-align: left;
}

.settings-row.is-action:disabled {
  color: var(--text-muted);
}

.settings-row.has-chevron {
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  gap: 3px;
}

.settings-row.has-chevron .settings-row-value {
  max-width: none;
  text-align: left;
}

.settings-row-label,
.settings-row-value {
  min-width: 0;
  line-height: 1.25;
  overflow-wrap: anywhere;
  white-space: normal;
}

.settings-row-label {
  font-size: 16px;
  font-weight: 720;
}

.settings-row-value {
  max-width: 42vw;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 620;
  text-align: right;
}
</style>
