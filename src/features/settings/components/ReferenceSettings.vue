<script setup lang="ts">
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import { APP_REFERENCE_SECTIONS } from '../../../lib/appInfo'
import { useI18n } from '../../../lib/i18n'

const { t } = useI18n()
</script>

<template>
  <SettingsSection
    v-for="section in APP_REFERENCE_SECTIONS"
    :key="section.titleKey"
    :title="t(section.titleKey)"
  >
    <SettingsRow
      v-for="link in section.links"
      :key="link.href"
      :label="t(link.labelKey)"
      :value="link.valueKey ? t(link.valueKey) : link.value"
      :href="link.href"
      :test-id="link.testId"
    />
  </SettingsSection>
</template>
