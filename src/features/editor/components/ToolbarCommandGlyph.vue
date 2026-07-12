<script setup lang="ts">
import { computed } from 'vue'
import type { MobileToolbarCommandButton } from '../../../lib/mobileToolbarConfig'
import { TOOLBAR_ICON_PATHS } from './toolbarIcons'
import { useI18n } from '../../../lib/i18n'

// One rendering path for a toolbar command's visual, shared by the bottom
// toolbar and the Settings quick-bar preview so the two can never drift:
// an icon from the toolbar icon set when the command defines one, otherwise
// its typographic label (B, I, H1…, ¶, x², √x — symbols that stay clearer
// than any icon).
const props = defineProps<{
  command: MobileToolbarCommandButton
}>()

const { t } = useI18n()

const iconPaths = computed(() =>
  props.command.iconName ? TOOLBAR_ICON_PATHS[props.command.iconName] : null,
)

const label = computed(() =>
  props.command.labelKey ? t(props.command.labelKey) : props.command.label,
)
</script>

<template>
  <svg
    v-if="iconPaths"
    class="toolbar-command-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(path, index) in iconPaths" :key="index" :d="path" />
  </svg>
  <span
    v-else
    class="toolbar-command-label"
    :data-command-id="command.commandId"
  >{{ label }}</span>
</template>

<style scoped>
.toolbar-command-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Typographic commands demonstrate their own effect (the iA Writer / word
   processor convention): the letterform IS the preview. Centralized here so
   the bottom toolbar and the Settings quick-bar preview can never drift. */
.toolbar-command-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.toolbar-command-label[data-command-id='format.strong'] {
  font-weight: 800;
}

.toolbar-command-label[data-command-id='format.emphasis'] {
  font-style: italic;
}

.toolbar-command-label[data-command-id='format.underline'] {
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}

.toolbar-command-label[data-command-id='format.strike'] {
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

/* Structural glyphs (¶, ∑) read best a step larger; the math and script
   marks (√x, x², x₂) hold the base size so the row keeps one rhythm. */
.toolbar-command-label[data-command-id='paragraph.paragraph'],
.toolbar-command-label[data-command-id='paragraph.math-formula'] {
  font-size: 16px;
  font-weight: 500;
}
</style>
