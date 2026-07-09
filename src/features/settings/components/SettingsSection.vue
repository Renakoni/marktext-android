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
  gap: 7px;
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
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-section-body {
  border-top: var(--hairline) solid var(--separator);
  border-bottom: var(--hairline) solid var(--separator);
  background: var(--surface);
}
</style>

<!-- Unscoped on purpose: slotted rows are compiled in other components, so
     the shared inset hairline between sibling rows must live outside the
     scoped block. Every row root is position: relative. -->
<style>
.settings-section-body > * + *::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 20px;
  border-top: var(--hairline) solid var(--separator);
  pointer-events: none;
}
</style>
