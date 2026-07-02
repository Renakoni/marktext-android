<script setup lang="ts">
import AppBottomNavigation from './AppBottomNavigation.vue'
import DocumentHome from './DocumentHome.vue'
import SettingsHome from './SettingsHome.vue'
import type { HomeDocumentItem } from '../lib/homeDocuments'
import { HOME_TABS, type HomeTab } from '../lib/homeNavigation'
import type { SettingsPage } from '../lib/settingsNavigation'

interface Props {
  activeTab: HomeTab
  settingsPage: SettingsPage
  continueDocument: HomeDocumentItem | null
  earlierDocuments: HomeDocumentItem[]
  notice: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  setTab: [tab: HomeTab]
  openDocument: [id: string]
  openFile: []
  newDocument: []
  setSettingsPage: [page: SettingsPage]
}>()
</script>

<template>
  <main class="app-shell is-home">
    <div class="home-main">
      <DocumentHome
        v-if="activeTab === HOME_TABS.DOCUMENTS"
        :continue-document="continueDocument"
        :earlier-documents="earlierDocuments"
        :notice="notice"
        @new-document="emit('newDocument')"
        @open-document="id => emit('openDocument', id)"
        @open-file="emit('openFile')"
      />
      <SettingsHome
        v-else
        :active-page="settingsPage"
        @set-page="page => emit('setSettingsPage', page)"
      />
    </div>
    <AppBottomNavigation :active-tab="activeTab" @set-tab="tab => emit('setTab', tab)" />
  </main>
</template>

<style scoped>
.home-main {
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
