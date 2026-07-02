<script setup lang="ts">
import { computed, ref } from 'vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import { APP_INFO } from '../../lib/appInfo'
import { checkForAppUpdates, type AppUpdateCheckResult } from '../../lib/appUpdates'

const checkingUpdates = ref(false)
const updateResult = ref<AppUpdateCheckResult | null>(null)

const updateStatus = computed(() => {
  if (checkingUpdates.value) {
    return 'Checking'
  }

  return updateResult.value?.message
})

const releaseLinkLabel = computed(() =>
  updateResult.value?.status === 'unavailable' ? 'All releases' : 'Latest release',
)

const releaseLinkValue = computed(() =>
  updateResult.value?.latestVersion ? `v${updateResult.value.latestVersion}` : 'GitHub releases',
)

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
  <SettingsSection title="App">
    <SettingsRow label="App" :value="APP_INFO.name" test-id="settings-about-app" />
    <SettingsRow label="Version" :value="APP_INFO.version" test-id="settings-about-version" />
  </SettingsSection>

  <SettingsSection title="Updates">
    <SettingsRow
      label="Check for updates"
      :value="updateStatus"
      button
      :busy="checkingUpdates"
      :disabled="checkingUpdates"
      test-id="settings-check-updates"
      @activate="checkUpdates"
    />
    <SettingsRow
      v-if="updateResult?.releaseUrl"
      :label="releaseLinkLabel"
      :value="releaseLinkValue"
      :href="updateResult.releaseUrl"
      test-id="settings-latest-release"
    />
  </SettingsSection>
</template>
