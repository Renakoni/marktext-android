<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <section class="settings-section">
    <h2>{{ title }}</h2>
    <div class="settings-section-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.settings-section {
  display: grid;
  gap: 6px;
}

.settings-section h2 {
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 0 22px;
  color: var(--text-faint);
  font-size: 11px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.settings-section-body {
  background: var(--surface);
}
</style>
