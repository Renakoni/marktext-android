<script setup lang="ts">
import { useI18n } from '../../lib/i18n'
import type { CloudAccountState } from '../../lib/cloudDocuments'

withDefaults(
  defineProps<{
    oneDriveState: CloudAccountState | null
    googleDriveState: CloudAccountState | null
    /** Google flow feedback: browser trip / exchanging tokens / opening the pick. */
    googleDriveBusy: 'connecting' | 'completing' | 'opening' | null
    notice: string | null
    /** 'save' turns the page into the save-as destination chooser. */
    mode?: 'open' | 'save'
  }>(),
  { mode: 'open' },
)

const emit = defineEmits<{
  back: []
  openThisPhone: []
  openOneDrive: []
  openGoogleDrive: []
  disconnectOneDrive: []
  disconnectGoogleDrive: []
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
      <h1 id="open-locations-title" class="open-locations-title">
        {{ mode === 'save' ? t('saveAs.title') : t('openLocations.title') }}
      </h1>
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

      <div class="open-location-row-group">
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
              <template v-else-if="!oneDriveState.available">{{ t('openLocations.cloudUnavailable') }}</template>
              <template v-else-if="oneDriveState.connected && oneDriveState.accountName">
                {{ oneDriveState.accountName }}
              </template>
              <template v-else-if="oneDriveState.connected">{{ t('openLocations.cloudConnected') }}</template>
              <template v-else>{{ t('openLocations.cloudSignIn') }}</template>
            </span>
          </span>
        </button>
        <button
          v-if="oneDriveState?.connected && mode !== 'save'"
          type="button"
          class="open-location-signout"
          :aria-label="t('cloudBrowser.disconnect')"
          @click="emit('disconnectOneDrive')"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M14 6V4.8A1.3 1.3 0 0 0 12.7 3.5H5.8A1.3 1.3 0 0 0 4.5 4.8v14.4a1.3 1.3 0 0 0 1.3 1.3h6.9a1.3 1.3 0 0 0 1.3-1.3V18m2-9.5 3.5 3.5-3.5 3.5M9.5 12H19"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <div class="open-location-row-group">
        <button
          type="button"
          class="open-location-row"
          :disabled="(googleDriveState !== null && !googleDriveState.available) || googleDriveBusy !== null"
          @click="emit('openGoogleDrive')"
        >
          <span class="open-location-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                d="M9.1 3.5h5.8l6 10.5-2.9 5h-12l-2.9-5Zm0 0L3.1 14m11.8-10.5-6 10.5m12 0H8.9"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="open-location-text">
            <span class="open-location-label">Google Drive</span>
            <span class="open-location-subtitle">
              <template v-if="googleDriveBusy === 'connecting'">{{ t('openLocations.cloudConnecting') }}</template>
              <template v-else-if="googleDriveBusy === 'completing'">{{ t('cloudBrowser.completing') }}</template>
              <template v-else-if="googleDriveBusy === 'opening'">{{ t('openLocations.cloudOpening') }}</template>
              <template v-else-if="googleDriveState === null">…</template>
              <template v-else-if="!googleDriveState.available">{{ t('openLocations.cloudUnavailable') }}</template>
              <template v-else-if="googleDriveState.connected && googleDriveState.accountName">
                {{ googleDriveState.accountName }}
              </template>
              <template v-else-if="googleDriveState.connected">{{ t('openLocations.cloudConnected') }}</template>
              <template v-else>{{ t('openLocations.cloudSignIn') }}</template>
            </span>
          </span>
        </button>
        <!-- Drive has no in-app browser screen to host a sign-out control,
             so it lives on the row itself. -->
        <button
          v-if="googleDriveState?.connected && googleDriveBusy === null && mode !== 'save'"
          type="button"
          class="open-location-signout"
          :aria-label="t('cloudBrowser.disconnect')"
          @click="emit('disconnectGoogleDrive')"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M14 6V4.8A1.3 1.3 0 0 0 12.7 3.5H5.8A1.3 1.3 0 0 0 4.5 4.8v14.4a1.3 1.3 0 0 0 1.3 1.3h6.9a1.3 1.3 0 0 0 1.3-1.3V18m2-9.5 3.5 3.5-3.5 3.5M9.5 12H19"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <p v-if="notice" class="open-locations-notice" role="alert">{{ notice }}</p>
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

.open-location-row-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.open-location-row-group .open-location-row {
  min-width: 0;
}

.open-location-signout {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: none;
  background: none;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.open-location-signout:active {
  background: var(--press);
}

.open-locations-notice {
  margin: 8px 12px 0;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
