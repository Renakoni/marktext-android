<script setup lang="ts">
import { computed } from 'vue'
import SettingsChoiceRow from './SettingsChoiceRow.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import SettingsSelectRow from './SettingsSelectRow.vue'
import SettingsSliderRow from './SettingsSliderRow.vue'
import SettingsTextRow from './SettingsTextRow.vue'
import SettingsToggleRow from './SettingsToggleRow.vue'
import {
  SETTINGS_DETAIL_SECTIONS,
  type SettingsActionRow,
  type SettingsChoiceRow as SettingsChoiceDescriptor,
  type SettingsSliderRow as SettingsSliderDescriptor,
  type SettingsStatusRow,
  type SettingsTextRow as SettingsTextDescriptor,
  type SettingsToggleRow as SettingsToggleDescriptor,
} from '../../lib/settingsContent'
import { APP_LANGUAGE_OPTIONS, useI18n } from '../../lib/i18n'
import { SETTINGS_PAGES, type SettingsPage } from '../../lib/settingsNavigation'
import { useSettingsState } from '../../lib/settingsState'

const props = defineProps<{
  page: SettingsPage
}>()

const { locale, setLocale, t } = useI18n()
const { getValue, setValue } = useSettingsState()
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

function getToggleValue(row: SettingsToggleDescriptor) {
  return getValue(row.id, row.defaultValue)
}

function getChoiceValue(row: SettingsChoiceDescriptor) {
  const value = getValue(row.id, row.defaultValue)
  return row.options.some(option => option.id === value) ? value : row.defaultValue
}

function getSliderValue(row: SettingsSliderDescriptor) {
  return getValue(row.id, row.defaultValue)
}

function getTextValue(row: SettingsTextDescriptor) {
  return getValue(row.id, row.defaultValue)
}

function optionLabels(row: SettingsChoiceDescriptor) {
  return row.options.map(option => ({
    id: option.id,
    label: t(option.labelKey),
    testId: `${row.testId}-option-${option.id.replace(/[^a-z0-9]+/gi, '-')}`,
  }))
}

function getActionValue(row: SettingsActionRow) {
  return row.valueKey ? t(row.valueKey) : undefined
}

function getStatusValue(row: SettingsStatusRow) {
  return t(row.valueKey)
}

function setStoredValue(rowId: string, value: boolean | number | string) {
  setValue(rowId, value)
}

function recordAction(row: SettingsActionRow) {
  setValue(`action:${row.id}`, Date.now())
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
    <template v-for="row in section.rows" :key="row.testId">
      <SettingsToggleRow
        v-if="row.kind === 'toggle'"
        :label="t(row.labelKey)"
        :model-value="getToggleValue(row)"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsSelectRow
        v-else-if="row.kind === 'choice' && row.display === 'select'"
        :label="t(row.labelKey)"
        :model-value="getChoiceValue(row)"
        :options="optionLabels(row)"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsChoiceRow
        v-else-if="row.kind === 'choice'"
        :label="t(row.labelKey)"
        :model-value="getChoiceValue(row)"
        :options="optionLabels(row)"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsSliderRow
        v-else-if="row.kind === 'slider'"
        :label="t(row.labelKey)"
        :model-value="getSliderValue(row)"
        :min="row.min"
        :max="row.max"
        :step="row.step"
        :unit="row.unitKey ? t(row.unitKey) : undefined"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsTextRow
        v-else-if="row.kind === 'text'"
        :label="t(row.labelKey)"
        :model-value="getTextValue(row)"
        :placeholder="row.placeholderKey ? t(row.placeholderKey) : undefined"
        :multiline="row.multiline"
        :test-id="row.testId"
        @update:model-value="value => setStoredValue(row.id, value)"
      />
      <SettingsRow
        v-else-if="row.kind === 'action'"
        :label="t(row.labelKey)"
        :value="getActionValue(row)"
        :test-id="row.testId"
        button
        @activate="recordAction(row)"
      />
      <SettingsRow
        v-else
        :label="t(row.labelKey)"
        :value="getStatusValue(row)"
        :test-id="row.testId"
      />
    </template>
  </SettingsSection>
</template>
