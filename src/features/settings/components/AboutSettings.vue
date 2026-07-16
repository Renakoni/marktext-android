<script setup lang="ts">
import { computed, ref } from 'vue'
import { APP_INFO } from '../../../lib/appInfo'
import { checkForAppUpdates, type AppUpdateCheckResult } from '../../../lib/appUpdates'
import { useI18n } from '../../../lib/i18n'

const checkingUpdates = ref(false)
const updateResult = ref<AppUpdateCheckResult | null>(null)
const { t } = useI18n()

const updateStatus = computed(() => {
  if (checkingUpdates.value) {
    return t('about.update.checking')
  }

  return updateResult.value ? getUpdateStatus(updateResult.value) : undefined
})

const availableReleaseUrl = computed(() => {
  if (checkingUpdates.value || updateResult.value?.status !== 'available') {
    return null
  }

  return updateResult.value.releaseUrl ?? APP_INFO.releasesUrl
})

function getUpdateStatus(result: AppUpdateCheckResult) {
  if (result.status === 'available' && result.latestVersion) {
    return t('about.update.available', { version: result.latestVersion })
  }

  if (result.status === 'current') {
    return t('about.update.current')
  }

  if (result.message === 'No published releases yet') {
    return t('about.update.noReleases')
  }

  if (result.message === 'Latest release did not include a version') {
    return t('about.update.badRelease')
  }

  return result.message.startsWith('Could not check updates')
    ? result.message
    : t('about.update.unavailable')
}

async function checkUpdates() {
  if (checkingUpdates.value) {
    return
  }

  checkingUpdates.value = true
  try {
    updateResult.value = await checkForAppUpdates()
  } finally {
    checkingUpdates.value = false
  }
}
</script>

<template>
  <section class="about-page" :aria-label="t('settings.about')" data-testid="settings-about-page">
    <div class="about-hero" data-testid="settings-about-app">
      <span class="about-mark" aria-hidden="true" />
      <p>{{ APP_INFO.name }}</p>
    </div>

    <div class="about-list">
      <div class="about-row" data-testid="settings-about-version">
        <span class="about-row-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M4 12h6" />
            <path d="M14 12h6" />
            <circle cx="12" cy="12" r="2.8" />
          </svg>
        </span>
        <span class="about-row-main">
          <span class="about-row-label">{{ t('about.version') }}</span>
          <span class="about-row-value">{{ APP_INFO.version }}</span>
        </span>
      </div>

      <button
        class="about-row is-button"
        type="button"
        :disabled="checkingUpdates"
        :aria-busy="checkingUpdates ? 'true' : undefined"
        data-testid="settings-check-updates"
        @click="checkUpdates"
      >
        <span class="about-row-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
            <path d="M4 4v4h4" />
            <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
            <path d="M20 20v-4h-4" />
          </svg>
        </span>
        <span class="about-row-main">
          <span class="about-row-label">{{ t('about.checkUpdates') }}</span>
          <span v-if="updateStatus" class="about-row-value">{{ updateStatus }}</span>
        </span>
      </button>

      <a
        v-if="availableReleaseUrl"
        class="about-row is-link"
        :href="availableReleaseUrl"
        target="_blank"
        rel="noreferrer"
        data-testid="settings-open-release"
      >
        <span class="about-row-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 4v10" />
            <path d="M8 10l4 4 4-4" />
            <path d="M5 19h14" />
          </svg>
        </span>
        <span class="about-row-main">
          <span class="about-row-label">{{ t('about.update.openRelease') }}</span>
        </span>
        <span class="about-row-trailing" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M8 8h8v8" />
            <path d="M16 8l-9 9" />
            <path d="M7 7h-1a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
          </svg>
        </span>
      </a>

      <a
        class="about-row is-link"
        :href="APP_INFO.repositoryUrl"
        target="_blank"
        rel="noreferrer"
        data-testid="settings-about-github"
      >
        <span class="about-row-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M8 9l-4 3 4 3" />
            <path d="M16 9l4 3-4 3" />
            <path d="M14 5l-4 14" />
          </svg>
        </span>
        <span class="about-row-main">
          <span class="about-row-label">{{ t('about.github') }}</span>
        </span>
        <span class="about-row-trailing" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M8 8h8v8" />
            <path d="M16 8l-9 9" />
            <path d="M7 7h-1a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
          </svg>
        </span>
      </a>
    </div>
  </section>
</template>

<style scoped>
.about-page {
  display: grid;
  gap: 0;
}

.about-hero {
  display: grid;
  justify-items: center;
  gap: 12px;
  min-height: 258px;
  padding: 52px 20px 40px;
  border-bottom: var(--hairline) solid var(--separator);
  background: var(--app-bg);
  color: var(--text-muted);
}

.about-hero p {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.3;
  font-weight: 500;
  letter-spacing: 0;
}

/* The real app mark: the launcher/splash silhouette (its only source is the
   launcher foreground bitmap, cropped to content in src/assets/logo-mark.png)
   tinted with the theme accent — the same alpha-mask technique the Android
   splash uses with its grey tint in ic_splash_logo.xml. */
.about-mark {
  width: 148px;
  max-width: 40vw;
  aspect-ratio: 290 / 244;
  background: var(--accent);
  -webkit-mask: url('../../../assets/logo-mark.png') center / contain no-repeat;
  mask: url('../../../assets/logo-mark.png') center / contain no-repeat;
}

/* A WebView without mask support shows the untinted launcher mark instead of
   an accent-colored square. */
@supports not ((mask-repeat: no-repeat) or (-webkit-mask-repeat: no-repeat)) {
  .about-mark {
    background: transparent url('../../../assets/logo-mark.png') center / contain no-repeat;
  }
}

.about-list {
  border-bottom: var(--hairline) solid var(--separator);
  background: var(--surface);
}

.about-row {
  position: relative;
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0;
  width: 100%;
  min-height: 72px;
  padding: 10px 20px 10px 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  text-decoration: none;
  transition: background-color var(--dur-standard) var(--ease-out);
}

.about-row + .about-row::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 68px;
  border-top: var(--hairline) solid var(--separator);
  pointer-events: none;
}

.about-row.is-button,
.about-row.is-link {
  cursor: pointer;
}

.about-row.is-button:active,
.about-row.is-link:active {
  background: var(--press);
  transition-duration: 0ms;
}

.about-row.is-button:focus-visible,
.about-row.is-link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

.about-row.is-button:disabled {
  color: var(--text-faint);
  cursor: default;
}

.about-row-icon,
.about-row-trailing {
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.about-row-icon svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.about-row-trailing svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.1;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.about-row-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.about-row-label {
  min-width: 0;
  color: var(--text);
  font-size: 16px;
  line-height: 1.25;
  font-weight: 600;
  letter-spacing: -0.008em;
  overflow-wrap: anywhere;
}

.about-row-value {
  min-width: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.3;
  font-weight: 400;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
</style>
