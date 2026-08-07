<script setup lang="ts">
import { useI18n } from '../../lib/i18n'
import type { CloudAccountState } from '../../lib/cloudDocuments'

defineProps<{
  oneDriveState: CloudAccountState | null
}>()

const emit = defineEmits<{
  back: []
  openThisPhone: []
  openOneDrive: []
  browseAll: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="open-locations-screen">
    <header class="open-locations-header">
      <button
        type="button"
        class="open-locations-back"
        :aria-label="t('openLocations.back')"
        @click="emit('back')"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <h1 class="open-locations-title">{{ t('openLocations.title') }}</h1>
    </header>

    <div class="open-locations-list">
      <button type="button" class="open-location-row" @click="emit('openThisPhone')">
        <span class="open-location-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <rect x="7" y="2.5" width="10" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
            <circle cx="12" cy="18" r="1.1" fill="currentColor" />
          </svg>
        </span>
        <span class="open-location-text">
          <span class="open-location-label">{{ t('openLocations.thisPhone') }}</span>
          <span class="open-location-subtitle">{{ t('openLocations.thisPhoneSubtitle') }}</span>
        </span>
      </button>

      <button
        type="button"
        class="open-location-row"
        :disabled="oneDriveState !== null && !oneDriveState.available"
        @click="emit('openOneDrive')"
      >
        <span class="open-location-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path
              d="M7 17.5h10.6a3.4 3.4 0 0 0 .6-6.75 5.2 5.2 0 0 0-10-1.4A4.1 4.1 0 0 0 7 17.5Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="open-location-text">
          <span class="open-location-label">OneDrive</span>
          <span class="open-location-subtitle">
            <template v-if="oneDriveState === null">…</template>
            <template v-else-if="!oneDriveState.available">{{ t('openLocations.onedriveUnavailable') }}</template>
            <template v-else-if="oneDriveState.connected && oneDriveState.accountName">
              {{ oneDriveState.accountName }}
            </template>
            <template v-else-if="oneDriveState.connected">{{ t('openLocations.onedriveConnected') }}</template>
            <template v-else>{{ t('openLocations.onedriveSignIn') }}</template>
          </span>
        </span>
      </button>

      <button type="button" class="open-location-row" @click="emit('browseAll')">
        <span class="open-location-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path
              d="M3.5 7.5v-2a1 1 0 0 1 1-1h4l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="open-location-text">
          <span class="open-location-label">{{ t('openLocations.browseAll') }}</span>
          <span class="open-location-subtitle">{{ t('openLocations.browseAllSubtitle') }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.open-locations-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--text);
}

.open-locations-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: max(12px, env(safe-area-inset-top)) 12px 8px 4px;
}

.open-locations-back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: none;
  background: none;
  color: var(--text);
  border-radius: var(--radius-sm);
}

.open-locations-back:active {
  background: var(--press);
}

.open-locations-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.open-locations-list {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  gap: 4px;
}

.open-location-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 12px;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  color: var(--text);
  text-align: start;
  width: 100%;
}

.open-location-row:active {
  background: var(--press);
}

.open-location-row:disabled {
  opacity: 0.5;
}

.open-location-icon {
  display: grid;
  place-items: center;
  color: var(--accent-strong);
  flex-shrink: 0;
}

.open-location-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.open-location-label {
  font-size: 16px;
  font-weight: 600;
}

.open-location-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
