<script setup lang="ts">
import { computed, ref } from 'vue'
import ReferenceSettings from './ReferenceSettings.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import { APP_INFO } from '../../lib/appInfo'
import { checkForAppUpdates, type AppUpdateCheckResult } from '../../lib/appUpdates'
import { useI18n } from '../../lib/i18n'

const checkingUpdates = ref(false)
const updateResult = ref<AppUpdateCheckResult | null>(null)
const { t } = useI18n()

const updateStatus = computed(() => {
  if (checkingUpdates.value) {
    return t('about.update.checking')
  }

  return updateResult.value ? getUpdateStatus(updateResult.value) : undefined
})

const releaseLinkLabel = computed(() =>
  updateResult.value?.status === 'unavailable' ? t('about.allReleases') : t('about.latestRelease'),
)

const releaseLinkValue = computed(() =>
  updateResult.value?.latestVersion ? `v${updateResult.value.latestVersion}` : t('about.githubReleases'),
)

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
  <SettingsSection :title="t('about.section.app')">
    <SettingsRow :label="t('about.app')" :value="APP_INFO.name" test-id="settings-about-app" />
    <SettingsRow :label="t('about.version')" :value="APP_INFO.version" test-id="settings-about-version" />
  </SettingsSection>

  <ReferenceSettings />

  <SettingsSection :title="t('about.section.updates')">
    <SettingsRow
      :label="t('about.checkUpdates')"
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

  <SettingsSection :title="t('about.section.legal')">
    <SettingsRow
      :label="t('about.licenseNotices')"
      :value="t('about.thirdPartyNotices')"
      test-id="settings-about-notices"
    />
  </SettingsSection>
</template>
