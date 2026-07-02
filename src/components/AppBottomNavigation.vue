<script setup lang="ts">
import AppBottomNavigationIcon from './AppBottomNavigationIcon.vue'
import { HOME_TAB_ITEMS, type HomeTab } from '../lib/homeNavigation'

defineProps<{
  activeTab: HomeTab
}>()

const emit = defineEmits<{
  setTab: [tab: HomeTab]
}>()

const tabs = HOME_TAB_ITEMS

function selectTab(tab: HomeTab) {
  emit('setTab', tab)
}
</script>

<template>
  <nav class="app-bottom-navigation" aria-label="Primary" data-testid="app-bottom-navigation">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="bottom-nav-button"
      :class="{ 'is-active': activeTab === tab.id }"
      type="button"
      :aria-label="tab.label"
      :aria-current="activeTab === tab.id ? 'page' : undefined"
      :data-testid="`bottom-nav-${tab.id}`"
      @click="selectTab(tab.id)"
    >
      <AppBottomNavigationIcon :name="tab.icon" />
    </button>
  </nav>
</template>

<style scoped>
.app-bottom-navigation {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 8px 20px calc(env(safe-area-inset-bottom, 0px) + 8px);
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-muted) 82%, var(--surface) 18%);
}

.bottom-nav-button {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 48px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  touch-action: manipulation;
}

.bottom-nav-button.is-active {
  background: var(--surface);
  color: var(--accent-strong);
  box-shadow: inset 0 0 0 1px var(--border);
}

.bottom-nav-button:active {
  transform: translateY(1px);
}

@media (min-width: 720px) {
  .app-bottom-navigation {
    padding-right: max(24px, calc((100vw - 760px) / 2));
    padding-left: max(24px, calc((100vw - 760px) / 2));
  }
}
</style>
