<script setup lang="ts">
import { computed } from 'vue'
import AppBottomNavigationIcon from './AppBottomNavigationIcon.vue'
import { HOME_TAB_ITEMS, type HomeTab } from '../homeNavigation'
import { useI18n } from '../../../lib/i18n'

const props = defineProps<{
  activeTab: HomeTab
}>()

const emit = defineEmits<{
  setTab: [tab: HomeTab]
}>()

const { t } = useI18n()
const tabs = HOME_TAB_ITEMS

const activeIndex = computed(() =>
  Math.max(0, tabs.findIndex(tab => tab.id === props.activeTab)),
)

const indicatorTransform = computed(() => `translateX(${activeIndex.value * 100}%)`)

function selectTab(tab: HomeTab) {
  emit('setTab', tab)
}
</script>

<template>
  <nav class="app-bottom-navigation" aria-label="Primary" data-testid="app-bottom-navigation">
    <div class="bottom-nav-track">
      <span class="bottom-nav-indicator" :style="{ transform: indicatorTransform }" aria-hidden="true" />
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="bottom-nav-button"
        :class="{ 'is-active': activeTab === tab.id }"
        type="button"
        :aria-label="t(tab.labelKey)"
        :aria-current="activeTab === tab.id ? 'page' : undefined"
        :data-testid="`bottom-nav-${tab.id}`"
        @click="selectTab(tab.id)"
      >
        <span class="bottom-nav-icon" aria-hidden="true">
          <AppBottomNavigationIcon :name="tab.icon" />
        </span>
        <span class="bottom-nav-label">{{ t(tab.labelKey) }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.app-bottom-navigation {
  padding: 8px 12px calc(env(safe-area-inset-bottom, 0px) + 8px);
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.bottom-nav-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  border-radius: 999px;
}

.bottom-nav-indicator {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 6px;
  width: calc(50% - 6px);
  pointer-events: none;
  transition: transform 340ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  will-change: transform;
}

.bottom-nav-indicator::before {
  position: absolute;
  inset: 0 16px;
  border-radius: 999px;
  background: var(--bottom-nav-indicator-bg);
  content: '';
}

.bottom-nav-button {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-faint);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.006em;
  touch-action: manipulation;
  position: relative;
  z-index: 1;
  transition: color 200ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.bottom-nav-button.is-active {
  color: var(--accent-strong);
}

.bottom-nav-button:active {
  color: var(--text-muted);
}

.bottom-nav-icon {
  display: inline-grid;
  place-items: center;
  height: 22px;
}

.bottom-nav-label {
  line-height: 1;
  white-space: nowrap;
}

@media (min-width: 720px) {
  .app-bottom-navigation {
    padding-right: max(24px, calc((100vw - 720px) / 2));
    padding-left: max(24px, calc((100vw - 720px) / 2));
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom-nav-indicator {
    transition: none;
  }
}
</style>
