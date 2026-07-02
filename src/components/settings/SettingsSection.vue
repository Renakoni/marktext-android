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
  gap: 8px;
}

.settings-section h2 {
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
  padding: 0 20px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.2;
  font-weight: 760;
}

.settings-section-body {
  overflow: hidden;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
</style>
