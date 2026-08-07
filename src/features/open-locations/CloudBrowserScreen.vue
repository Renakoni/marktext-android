<script setup lang="ts">
import { useI18n } from '../../lib/i18n'
import type { CloudAccountState, CloudFolderEntry } from '../../lib/cloudDocuments'

defineProps<{
  accountState: CloudAccountState | null
  /** 'browser' = waiting for the sign-in browser; 'completing' = redirect landed, exchanging tokens. */
  connecting: 'browser' | 'completing' | null
  loading: boolean
  errorMessage: string | null
  entries: CloudFolderEntry[]
  folderName: string | null
  openingFileId: string | null
  /** Save-as destination mode: folders navigate, files are inert, a save bar appears. */
  saveMode?: boolean
}>()

const emit = defineEmits<{
  back: []
  connect: []
  disconnect: []
  openEntry: [entry: CloudFolderEntry]
  retry: []
  saveHere: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="cloud-browser-screen">
    <header class="cloud-browser-header">
      <button
        type="button"
        class="cloud-browser-back"
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
      <h1 id="cloud-browser-title" class="cloud-browser-title">{{ folderName ?? 'OneDrive' }}</h1>
      <button
        v-if="accountState?.connected && !saveMode"
        type="button"
        class="cloud-browser-disconnect"
        @click="emit('disconnect')"
      >
        {{ t('cloudBrowser.disconnect') }}
      </button>
    </header>

    <p v-if="accountState?.connected && accountState.accountName" class="cloud-browser-account">
      {{ accountState.accountName }}
    </p>

    <div class="cloud-browser-content">
      <template v-if="accountState && !accountState.connected">
        <p class="cloud-browser-hint">{{ t('cloudBrowser.signInHint') }}</p>
        <button
          type="button"
          class="cloud-browser-primary"
          :disabled="connecting !== null || !accountState.available"
          @click="emit('connect')"
        >
          {{
            connecting === 'completing'
              ? t('cloudBrowser.completing')
              : connecting === 'browser'
                ? t('cloudBrowser.connecting')
                : t('cloudBrowser.connect')
          }}
        </button>
        <p v-if="!accountState.available" class="cloud-browser-hint">
          {{ t('openLocations.cloudUnavailable') }}
        </p>
      </template>

      <template v-else-if="errorMessage !== null">
        <p class="cloud-browser-hint" role="alert">{{ errorMessage }}</p>
        <button type="button" class="cloud-browser-primary" @click="emit('retry')">
          {{ t('cloudBrowser.retry') }}
        </button>
      </template>

      <p v-else-if="loading" class="cloud-browser-hint">{{ t('cloudBrowser.loading') }}</p>

      <p v-else-if="entries.length === 0" class="cloud-browser-hint">
        {{ t('cloudBrowser.empty') }}
      </p>

      <ul v-else class="cloud-browser-list">
        <li v-for="entry in entries" :key="entry.id">
          <button
            type="button"
            class="cloud-browser-entry"
            :disabled="openingFileId !== null || (saveMode && !entry.isFolder)"
            @click="emit('openEntry', entry)"
          >
            <span class="cloud-browser-entry-icon" aria-hidden="true">
              <svg v-if="entry.isFolder" viewBox="0 0 24 24" width="22" height="22">
                <path
                  d="M3.5 7.5v-2a1 1 0 0 1 1-1h4l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="22" height="22">
                <path
                  d="M6 2.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V4A1.5 1.5 0 0 1 6.5 2.5Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
            <span class="cloud-browser-entry-name">
              {{ entry.name }}
              <template v-if="openingFileId === entry.id"> …</template>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <div v-if="saveMode && accountState?.connected" class="cloud-browser-save-bar">
      <button type="button" class="cloud-browser-primary" @click="emit('saveHere')">
        {{ t('cloudBrowser.saveHere') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cloud-browser-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--text);
}

.cloud-browser-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: max(12px, env(safe-area-inset-top)) 12px 8px 4px;
}

.cloud-browser-back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: none;
  background: none;
  color: var(--text);
  border-radius: var(--radius-sm);
}

.cloud-browser-back:active {
  background: var(--press);
}

.cloud-browser-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-browser-disconnect {
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 13px;
  padding: 8px;
  border-radius: var(--radius-sm);
}

.cloud-browser-disconnect:active {
  background: var(--press);
}

.cloud-browser-account {
  margin: 0;
  padding: 0 16px 8px;
  font-size: 13px;
  color: var(--text-muted);
}

.cloud-browser-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 12px 24px;
}

.cloud-browser-save-bar {
  padding: 8px 16px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border, rgba(128, 128, 128, 0.25));
}

.cloud-browser-hint {
  margin: 16px 8px;
  font-size: 14px;
  color: var(--text-muted);
}

.cloud-browser-primary {
  display: block;
  margin: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 15px;
  font-weight: 600;
}

.cloud-browser-primary:disabled {
  opacity: 0.6;
}

.cloud-browser-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cloud-browser-entry {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 13px 10px;
  border: none;
  background: none;
  border-radius: var(--radius-sm);
  color: var(--text);
  text-align: start;
}

.cloud-browser-entry:active {
  background: var(--press);
}

.cloud-browser-entry-icon {
  display: grid;
  place-items: center;
  color: var(--accent-strong);
  flex-shrink: 0;
}

.cloud-browser-entry-name {
  font-size: 15px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
