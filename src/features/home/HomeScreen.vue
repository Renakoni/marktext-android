<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppBottomNavigation from './components/AppBottomNavigation.vue'
import DocumentHome from './DocumentHome.vue'
import SettingsScreen from '../settings/SettingsScreen.vue'
import type { HomeDocumentItem } from './homeDocuments'
import { HOME_TABS, type HomeTab } from './homeNavigation'
import { SETTINGS_PAGES, type SettingsPage } from '../settings/settingsNavigation'
import type { AdvancedMaintenanceActionHandler } from '../settings/advancedSettings'

interface Props {
  activeTab: HomeTab
  settingsPage: SettingsPage
  continueDocument: HomeDocumentItem | null
  pinnedDocuments: HomeDocumentItem[]
  earlierDocuments: HomeDocumentItem[]
  notice: string | null
  selectionActive: boolean
  selectionCount: number
  selectedIds: ReadonlySet<string>
  allSelectedPinned: boolean
  deleteSheetOpen: boolean
  renameSheetOpen: boolean
  runMaintenanceAction: AdvancedMaintenanceActionHandler
}

const props = defineProps<Props>()

const emit = defineEmits<{
  setTab: [tab: HomeTab]
  openDocument: [id: string]
  openFile: []
  newDocument: []
  setSettingsPage: [page: SettingsPage]
  selectDocument: [id: string]
  toggleDocument: [id: string]
  exitSelection: []
  pinSelected: []
  deleteSelected: []
  shareSelected: []
  renameSelected: [id: string, name: string]
  'update:deleteSheetOpen': [open: boolean]
  'update:renameSheetOpen': [open: boolean]
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
        :pinned-documents="pinnedDocuments"
        :earlier-documents="earlierDocuments"
        :notice="notice"
        :selection-active="selectionActive"
        :selection-count="selectionCount"
        :selected-ids="selectedIds"
        :all-selected-pinned="allSelectedPinned"
        :delete-sheet-open="deleteSheetOpen"
        :rename-sheet-open="renameSheetOpen"
        @new-document="emit('newDocument')"
        @open-document="id => emit('openDocument', id)"
        @open-file="emit('openFile')"
        @select-document="id => emit('selectDocument', id)"
        @toggle-document="id => emit('toggleDocument', id)"
        @exit-selection="emit('exitSelection')"
        @pin-selected="emit('pinSelected')"
        @delete-selected="emit('deleteSelected')"
        @share-selected="emit('shareSelected')"
        @rename-selected="(id, name) => emit('renameSelected', id, name)"
        @update:delete-sheet-open="open => emit('update:deleteSheetOpen', open)"
        @update:rename-sheet-open="open => emit('update:renameSheetOpen', open)"
      />
      <SettingsScreen
        v-else
        :active-page="settingsPage"
        :run-maintenance-action="runMaintenanceAction"
        @set-page="page => emit('setSettingsPage', page)"
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
