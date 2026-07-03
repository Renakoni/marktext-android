<script setup lang="ts">
import type { HomeTabIcon } from '../homeNavigation'

defineProps<{
  name: HomeTabIcon
}>()
</script>

<template>
  <svg
    v-if="name === 'document'"
    class="bottom-nav-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v5h5" />
    <path d="M9.5 12h5" />
    <path d="M9.5 16h5" />
  </svg>
  <svg
    v-else
    class="bottom-nav-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7z" />
    <path
      d="M19 13.5v-3l-2.1-.4a5.9 5.9 0 0 0-.7-1.6l1.2-1.8l-2.1-2.1l-1.8 1.2a5.9 5.9 0 0 0-1.6-.7L11.5 3h-3l-.4 2.1a5.9 5.9 0 0 0-1.6.7L4.7 4.6L2.6 6.7l1.2 1.8a5.9 5.9 0 0 0-.7 1.6L1 10.5v3l2.1.4a5.9 5.9 0 0 0 .7 1.6l-1.2 1.8l2.1 2.1l1.8-1.2a5.9 5.9 0 0 0 1.6.7l.4 2.1h3l.4-2.1a5.9 5.9 0 0 0 1.6-.7l1.8 1.2l2.1-2.1l-1.2-1.8a5.9 5.9 0 0 0 .7-1.6z"
    />
  </svg>
</template>

<style scoped>
.bottom-nav-icon {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
</style>
