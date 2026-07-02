<script setup lang="ts">
import { computed } from 'vue'
import SettingsChoiceRow from './SettingsChoiceRow.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import { SETTINGS_DETAIL_SECTIONS } from '../../lib/settingsContent'
import { APP_LANGUAGE_OPTIONS, useI18n } from '../../lib/i18n'
import { SETTINGS_PAGES, type SettingsPage } from '../../lib/settingsNavigation'

const props = defineProps<{
  page: SettingsPage
}>()

const { locale, setLocale, t } = useI18n()
const sections = computed(() => SETTINGS_DETAIL_SECTIONS[props.page] ?? [])
const languageOptions = computed(() =>
  APP_LANGUAGE_OPTIONS.map(option => ({
    id: option.id,
    label: t(option.labelKey),
    testId: option.testId,
  })),
)

function setLanguage(value: string) {
  const nextLocale = APP_LANGUAGE_OPTIONS.find(option => option.id === value)?.id
  if (nextLocale) {
    setLocale(nextLocale)
  }
}
</script>

<template>
  <SettingsSection
    v-if="page === SETTINGS_PAGES.APPEARANCE"
    :title="t('settings.section.language')"
  >
    <SettingsChoiceRow
      :aria-label="t('settings.language.app')"
      :model-value="locale"
      :options="languageOptions"
      test-id="settings-language-app"
      @update:model-value="setLanguage"
    />
  </SettingsSection>

  <SettingsSection v-for="section in sections" :key="section.titleKey" :title="t(section.titleKey)">
    <SettingsRow
      v-for="row in section.rows"
      :key="row.testId"
      :label="t(row.labelKey)"
      :value="t(row.valueKey)"
      :test-id="row.testId"
    />
  </SettingsSection>
</template>
