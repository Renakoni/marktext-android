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
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px;
  color: var(--text-faint);
  font-size: 12px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.settings-section-body {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
</style>
