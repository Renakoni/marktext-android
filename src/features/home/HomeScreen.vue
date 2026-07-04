<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppBottomNavigation from './components/AppBottomNavigation.vue'
import DocumentHome from './DocumentHome.vue'
import SettingsScreen from '../settings/SettingsScreen.vue'
import type { HomeDocumentItem } from './homeDocuments'
import { HOME_TABS, type HomeTab } from './homeNavigation'
import { SETTINGS_PAGES, type SettingsPage } from '../settings/settingsNavigation'
import type { AdvancedMaintenanceActionId } from '../settings/advancedSettings'

interface Props {
  activeTab: HomeTab
  settingsPage: SettingsPage
  continueDocument: HomeDocumentItem | null
  earlierDocuments: HomeDocumentItem[]
  notice: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  setTab: [tab: HomeTab]
  openDocument: [id: string]
  openFile: []
  newDocument: []
  setSettingsPage: [page: SettingsPage]
  runMaintenanceAction: [action: AdvancedMaintenanceActionId]
}>()

const homeMain = ref<HTMLElement | null>(null)

const isSettingsDetail = computed(
  () => props.activeTab === HOME_TABS.SETTINGS && props.settingsPage !== SETTINGS_PAGES.INDEX,
)

const showBottomNav = computed(() => !isSettingsDetail.value)

watch(
  () => [props.activeTab, props.settingsPage] as const,
  () => {
    homeMain.value?.scrollTo({ top: 0, left: 0 })
  },
  { flush: 'post' },
)
</script>

<template>
  <main class="app-shell is-home" :class="{ 'is-detail': isSettingsDetail }">
    <div ref="homeMain" class="home-main">
      <DocumentHome
        v-if="activeTab === HOME_TABS.DOCUMENTS"
        :continue-document="continueDocument"
        :earlier-documents="earlierDocuments"
        :notice="notice"
        @new-document="emit('newDocument')"
        @open-document="id => emit('openDocument', id)"
        @open-file="emit('openFile')"
      />
      <SettingsScreen
        v-else
        :active-page="settingsPage"
        @set-page="page => emit('setSettingsPage', page)"
        @run-maintenance-action="action => emit('runMaintenanceAction', action)"
      />
    </div>
    <AppBottomNavigation
      v-if="showBottomNav"
      :active-tab="activeTab"
      @set-tab="tab => emit('setTab', tab)"
    />
  </main>
</template>

<style scoped>
.home-main {
  min-height: 0;
  overflow: auto;
  background: var(--app-bg);
  -webkit-overflow-scrolling: touch;
}
</style>
