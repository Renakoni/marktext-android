<script setup lang="ts">
import AboutSettings from './components/AboutSettings.vue'
import SettingsDetailPage from './components/SettingsDetailPage.vue'
import SettingsRow from './components/SettingsRow.vue'
import SettingsSection from './components/SettingsSection.vue'
import { useI18n } from '../../lib/i18n'
import { SETTINGS_PAGE_TITLE_KEYS } from './settingsContent'
import {
  SETTINGS_HOME_SECTIONS,
  SETTINGS_PAGES,
  type SettingsPage,
} from './settingsNavigation'
import type { AdvancedMaintenanceActionId } from './advancedSettings'

defineProps<{
  activePage: SettingsPage
}>()

const emit = defineEmits<{
  setPage: [page: SettingsPage]
  runMaintenanceAction: [action: AdvancedMaintenanceActionId]
}>()

const { t } = useI18n()
</script>

<template>
  <section
    class="settings-screen"
    :class="{ 'is-detail': activePage !== SETTINGS_PAGES.INDEX }"
    :aria-label="t('settings.title')"
    data-testid="settings-screen"
  >
    <header class="settings-top" :class="{ 'is-detail': activePage !== SETTINGS_PAGES.INDEX }">
      <div class="settings-top-inner">
        <button
          v-if="activePage !== SETTINGS_PAGES.INDEX"
          class="settings-back-button"
          type="button"
          :aria-label="t('settings.back')"
          data-testid="settings-detail-back"
          @click="emit('setPage', SETTINGS_PAGES.INDEX)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h1 data-testid="settings-title">{{ t(SETTINGS_PAGE_TITLE_KEYS[activePage]) }}</h1>
      </div>
    </header>
    <div class="settings-content">
      <template v-if="activePage === SETTINGS_PAGES.INDEX">
        <div class="settings-index" data-testid="settings-index">
          <SettingsSection
            v-for="section in SETTINGS_HOME_SECTIONS"
            :key="section.titleKey"
            :title="t(section.titleKey)"
          >
            <SettingsRow
              v-for="item in section.items"
              :key="item.id"
              :label="t(item.labelKey)"
              button
              chevron
              :test-id="item.testId"
              @activate="emit('setPage', item.id)"
            />
          </SettingsSection>
        </div>
      </template>
      <AboutSettings v-else-if="activePage === SETTINGS_PAGES.ABOUT" />
      <SettingsDetailPage
        v-else
        :page="activePage"
        :run-maintenance-action="action => emit('runMaintenanceAction', action)"
      />
    </div>
  </section>
</template>

<style scoped>
.settings-screen {
  min-height: 100%;
  padding: calc(env(safe-area-inset-top, 0px) + 26px) 0 40px;
  background: var(--app-bg);
}

.settings-screen.is-detail {
  padding-top: 0;
}

.settings-top {
  display: block;
}

.settings-top.is-detail {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 0 12px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.settings-top-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 20px;
}

.settings-back-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding: 0 10px 0 6px;
  margin-left: -6px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--accent-strong);
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.006em;
}

.settings-back-button svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.settings-back-button:active {
  background: var(--surface-muted);
}

.settings-top h1 {
  margin: 0;
  color: var(--text);
  font-size: 28px;
  line-height: 1.04;
  font-weight: 700;
  letter-spacing: -0.022em;
}

.settings-top.is-detail h1 {
  font-size: 20px;
  letter-spacing: -0.012em;
}

.settings-content {
  display: grid;
  max-width: 720px;
  margin: 28px auto 0;
  gap: 30px;
}

.settings-screen.is-detail .settings-content {
  margin-top: 22px;
  gap: 26px;
}

.settings-index {
  display: grid;
  gap: 22px;
}
</style>
