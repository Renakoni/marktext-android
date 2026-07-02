<script setup lang="ts">
import AboutSettings from './settings/AboutSettings.vue'
import ReferenceSettings from './settings/ReferenceSettings.vue'
import SettingsRow from './settings/SettingsRow.vue'
import SettingsSection from './settings/SettingsSection.vue'
import {
  SETTINGS_HOME_ITEMS,
  SETTINGS_PAGES,
  type SettingsPage,
} from '../lib/settingsNavigation'

defineProps<{
  activePage: SettingsPage
}>()

const emit = defineEmits<{
  setPage: [page: SettingsPage]
}>()

function getPageTitle(page: SettingsPage) {
  if (page === SETTINGS_PAGES.ABOUT) {
    return 'About MarkText'
  }

  if (page === SETTINGS_PAGES.REFERENCES) {
    return 'References'
  }

  return 'Settings'
}
</script>

<template>
  <section class="settings-screen" aria-label="Settings" data-testid="settings-screen">
    <header class="settings-top" :class="{ 'is-detail': activePage !== SETTINGS_PAGES.INDEX }">
      <button
        v-if="activePage !== SETTINGS_PAGES.INDEX"
        class="settings-back-button"
        type="button"
        aria-label="Back to settings"
        data-testid="settings-detail-back"
        @click="emit('setPage', SETTINGS_PAGES.INDEX)"
      />
      <h1 data-testid="settings-title">{{ getPageTitle(activePage) }}</h1>
    </header>
    <div class="settings-content">
      <template v-if="activePage === SETTINGS_PAGES.INDEX">
        <div class="settings-index" data-testid="settings-index">
          <SettingsSection title="App">
            <SettingsRow
              v-for="item in SETTINGS_HOME_ITEMS"
              :key="item.id"
              :label="item.label"
              :value="item.value"
              button
              :test-id="item.testId"
              @activate="emit('setPage', item.id)"
            />
          </SettingsSection>
        </div>
      </template>
      <AboutSettings v-else-if="activePage === SETTINGS_PAGES.ABOUT" />
      <ReferenceSettings v-else />
    </div>
  </section>
</template>

<style scoped>
.settings-screen {
  min-height: 100%;
  padding: calc(env(safe-area-inset-top, 0px) + 18px) 0 28px;
  background: var(--surface);
}

.settings-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  max-width: 760px;
  margin: 0 auto;
  padding: 0 20px;
}

.settings-top.is-detail {
  grid-template-columns: 44px minmax(0, 1fr) 44px;
}

.settings-back-button {
  position: relative;
  width: 44px;
  height: 44px;
  margin-left: -10px;
  border: 0;
  background: transparent;
  color: var(--text);
}

.settings-back-button::before {
  position: absolute;
  top: 50%;
  left: 16px;
  width: 13px;
  height: 13px;
  border-bottom: 2.5px solid currentColor;
  border-left: 2.5px solid currentColor;
  content: '';
  transform: translateY(-50%) rotate(45deg);
}

.settings-back-button:active {
  transform: translateY(1px);
}

.settings-top h1 {
  margin: 0;
  color: var(--text);
  font-size: 28px;
  line-height: 1.08;
  font-weight: 760;
}

.settings-top.is-detail h1 {
  text-align: center;
}

.settings-content {
  display: grid;
  max-width: 760px;
  margin: 30px auto 0;
  gap: 24px;
}

.settings-index {
  display: grid;
  gap: 24px;
}
</style>
