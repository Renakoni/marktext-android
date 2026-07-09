<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '../../../lib/i18n'

const props = defineProps<{
  count: number
  allPinned: boolean
}>()

const emit = defineEmits<{
  exit: []
  pin: []
  requestDelete: []
  share: []
  requestRename: []
}>()

const { t } = useI18n()
const menuOpen = ref(false)

watch(
  () => props.count,
  () => {
    menuOpen.value = false
  },
)

function shareSelected() {
  menuOpen.value = false
  emit('share')
}

function renameSelected() {
  menuOpen.value = false
  emit('requestRename')
}
</script>

<template>
  <div
    class="home-selection-bar"
    role="toolbar"
    :aria-label="t('home.selection.selected', { count })"
    data-testid="home-selection-bar"
    @keydown.esc="menuOpen ? (menuOpen = false) : emit('exit')"
  >
    <button
      class="selection-icon-button"
      type="button"
      :aria-label="t('home.selection.exit')"
      :title="t('home.selection.exit')"
      data-testid="home-selection-exit"
      @click="emit('exit')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
    <span class="selection-count" data-testid="home-selection-count" aria-live="polite">
      {{ count }}
    </span>
    <div class="selection-bar-actions">
      <button
        class="selection-icon-button"
        type="button"
        :aria-label="allPinned ? t('home.selection.unpin') : t('home.selection.pin')"
        :title="allPinned ? t('home.selection.unpin') : t('home.selection.pin')"
        data-testid="home-selection-pin"
        @click="emit('pin')"
      >
        <svg v-if="!allPinned" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 4h6l-.7 6 3.2 3v1.5H6.5V13l3.2-3z" />
          <path d="M12 14.5V20" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 4h6l-.7 6 3.2 3v1.5H6.5V13l3.2-3z" />
          <path d="M12 14.5V20" />
          <path d="M4.5 4.5l15 15" />
        </svg>
      </button>
      <button
        class="selection-icon-button"
        type="button"
        :aria-label="t('home.selection.delete')"
        :title="t('home.selection.delete')"
        data-testid="home-selection-delete"
        @click="emit('requestDelete')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 7h14" />
          <path d="M9.5 7V4.8h5V7" />
          <path d="M7.3 7l.8 12.5h7.8L16.7 7" />
          <path d="M10.4 10.5v6M13.6 10.5v6" />
        </svg>
      </button>
      <div class="selection-menu-anchor">
        <button
          class="selection-icon-button"
          type="button"
          :aria-label="t('home.selection.menu')"
          :title="t('home.selection.menu')"
          aria-haspopup="menu"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          data-testid="home-selection-menu"
          @click="menuOpen = !menuOpen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="5" r="1.9" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
            <circle cx="12" cy="19" r="1.9" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <div
          v-if="menuOpen"
          class="selection-menu-backdrop"
          aria-hidden="true"
          @click="menuOpen = false"
        />
        <Transition name="selection-menu">
          <div v-if="menuOpen" class="selection-menu" role="menu">
            <button
              class="selection-menu-item"
              type="button"
              role="menuitem"
              data-testid="home-selection-share"
              @click="shareSelected"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="6" cy="12" r="2.4" fill="currentColor" stroke="none" />
                <circle cx="18" cy="6" r="2.4" fill="currentColor" stroke="none" />
                <circle cx="18" cy="18" r="2.4" fill="currentColor" stroke="none" />
                <path d="M8.1 10.9l7.8-3.6M8.1 13.1l7.8 3.6" />
              </svg>
              {{ t('home.selection.share') }}
            </button>
            <button
              v-if="count === 1"
              class="selection-menu-item"
              type="button"
              role="menuitem"
              data-testid="home-selection-rename"
              @click="renameSelected"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4.5 19.5l1-3.8L16.6 4.6a2 2 0 012.8 2.8L8.3 18.5z" />
                <path d="M14.6 6.6l2.8 2.8" />
              </svg>
              {{ t('home.selection.rename') }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
