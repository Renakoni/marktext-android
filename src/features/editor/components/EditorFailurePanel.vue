<script setup lang="ts">
import { useI18n } from '../../../lib/i18n'

const emit = defineEmits<{
  retry: []
  back: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="editor-failure" role="alert" data-testid="editor-failure-panel">
    <div class="editor-failure-content">
      <svg class="editor-failure-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M13.8 3.5H8A1.5 1.5 0 0 0 6.5 5v14A1.5 1.5 0 0 0 8 20.5h8a1.5 1.5 0 0 0 1.5-1.5V7.3Z" />
        <path d="M13.5 3.6v3.1a1 1 0 0 0 1 1h3" />
        <path d="M9.3 12h5.4" />
        <path class="editor-failure-icon-broken" d="M9.3 15.2h5.4" />
      </svg>
      <h2 class="editor-failure-title">{{ t('editor.failure.title') }}</h2>
      <button
        class="editor-failure-retry"
        type="button"
        data-testid="editor-failure-retry"
        @click="emit('retry')"
      >
        {{ t('editor.failure.retry') }}
      </button>
      <button
        class="editor-failure-back"
        type="button"
        data-testid="editor-failure-back"
        @click="emit('back')"
      >
        {{ t('editor.failure.back') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-failure {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--surface);
  animation: editor-failure-in var(--dur-standard) var(--ease-out);
}

@keyframes editor-failure-in {
  from {
    opacity: 0;
  }
}

.editor-failure-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: 300px;
  text-align: center;
}

.editor-failure-icon {
  width: 44px;
  height: 44px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--text-muted);
}

/* The unfinished text line reads as "the page did not fully load" — calm, not
   alarmist. */
.editor-failure-icon-broken {
  stroke-dasharray: 2 2.4;
  opacity: 0.75;
}

.editor-failure-title {
  margin: 0;
  color: var(--text);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.editor-failure-retry {
  margin-top: 2px;
  min-height: 44px;
  padding: 0 26px;
  border: 0;
  border-radius: var(--radius);
  background: var(--accent);
  color: var(--on-accent);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  box-shadow: var(--shadow-accent);
  touch-action: manipulation;
  transition:
    background-color var(--dur-standard) var(--ease-out),
    transform var(--dur-standard) var(--ease-out);
}

.editor-failure-retry:active {
  transform: scale(0.98);
  transition-duration: 0ms;
}

.editor-failure-retry:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.editor-failure-back {
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  touch-action: manipulation;
  transition: background-color var(--dur-standard) var(--ease-out);
}

.editor-failure-back:active {
  background: var(--press);
  transition-duration: 0ms;
}

.editor-failure-back:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .editor-failure {
    animation: none;
  }
}
</style>
