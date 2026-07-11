<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../../../lib/i18n'

const props = defineProps<{
  text: string
}>()

const emit = defineEmits<{
  activate: []
  dismiss: []
}>()

const { t } = useI18n()

const actionLabel = computed(() =>
  props.text ? `${t('editor.resume.action')}: ${props.text}` : t('editor.resume.action'),
)
</script>

<template>
  <div class="resume-card" data-testid="resume-card">
    <button
      class="resume-card-action"
      type="button"
      :aria-label="actionLabel"
      data-testid="resume-card-button"
      @click="emit('activate')"
    >
      <svg class="resume-card-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 5v5h5" />
        <path d="M5.5 9.5A8 8 0 1 1 4 12" />
        <path d="M12 8v4.5l3 1.8" />
      </svg>
      <span class="resume-card-content">
        <span class="resume-card-title">{{ t('editor.resume.title') }}</span>
        <span v-if="text" class="resume-card-text" dir="auto">{{ text }}</span>
      </span>
    </button>
    <button
      class="resume-card-dismiss"
      type="button"
      :aria-label="t('editor.resume.dismiss')"
      data-testid="resume-card-dismiss"
      @click="emit('dismiss')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 7l10 10M17 7L7 17" />
      </svg>
    </button>
  </div>
</template>
