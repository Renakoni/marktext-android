<script setup lang="ts">
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import { APP_REFERENCE_SECTIONS } from '../../lib/appInfo'
</script>

<template>
  <SettingsSection
    v-for="section in APP_REFERENCE_SECTIONS"
    :key="section.title"
    :title="section.title"
  >
    <SettingsRow
      v-for="link in section.links"
      :key="link.href"
      :label="link.label"
      :value="link.value"
      :href="link.href"
      :test-id="link.testId"
    />
  </SettingsSection>
</template>
