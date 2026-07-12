<script setup lang="ts">
import { computed } from 'vue'
import { MOBILE_COMMANDS } from '../lib/mobileCommands'
import type { MobileToolbarCommandButton } from '../lib/mobileToolbarConfig'
import { TOOLBAR_ICON_PATHS } from '../lib/toolbarIcons'

// One rendering path for a toolbar command's visual, shared by the bottom
// toolbar and the Settings quick-bar preview so the two can never drift:
// an icon from the toolbar icon set when the command defines one, otherwise
// its typographic label (B, H1…, ¶, x² — symbols that stay clearer than any
// icon).
const props = defineProps<{
  command: MobileToolbarCommandButton
}>()

const iconPaths = computed(() =>
  props.command.iconName ? TOOLBAR_ICON_PATHS[props.command.iconName] : null,
)

// The script commands are COMPOSED from primary-font glyphs instead of the
// Unicode super/subscript characters (² U+00B2, ₂ U+2082): on Android those
// often resolve through different fallback fonts whose vertical metrics
// inflate the line box asymmetrically, so the two x-es sat visibly off each
// other's baseline. A plain "2" scaled and shifted uses the same font as
// every other label, which makes the alignment deterministic on every
// device.
const scriptParts = computed(() => {
  if (props.command.commandId === MOBILE_COMMANDS.FORMAT_SUPERSCRIPT) {
    return { base: 'x', mark: '2', position: 'super' as const }
  }
  if (props.command.commandId === MOBILE_COMMANDS.FORMAT_SUBSCRIPT) {
    return { base: 'x', mark: '2', position: 'sub' as const }
  }
  return null
})
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
    v-else-if="scriptParts"
    class="toolbar-command-label"
    :data-command-id="command.commandId"
  >{{ scriptParts.base }}<span
    class="toolbar-script-mark"
    :class="`is-${scriptParts.position}`"
  >{{ scriptParts.mark }}</span></span>
  <span
    v-else
    class="toolbar-command-label"
    :data-command-id="command.commandId"
  >{{ command.label }}</span>
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
   the bottom toolbar and the Settings quick-bar preview can never drift.
   Every label gets the SAME 20px content box as the icons and centers its
   glyphs inside it, so text and icon buttons share one vertical axis
   regardless of per-glyph ink bounds. */
.toolbar-command-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.toolbar-command-label[data-command-id='format.strong'] {
  font-weight: 800;
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

/* The structural pilcrow reads best a step larger; the script marks
   (x², x₂) hold the base size so the row keeps one rhythm. */
.toolbar-command-label[data-command-id='paragraph.paragraph'] {
  font-size: 16px;
  font-weight: 500;
}

/* Composed super/subscript: the flex row centers the base x; the mark is
   scaled down and nudged off the shared axis. translate keeps the mark out
   of line-box math entirely, so it can never push the base glyph around. */
.toolbar-script-mark {
  margin-left: 1px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.toolbar-script-mark.is-super {
  transform: translateY(-4px);
}

.toolbar-script-mark.is-sub {
  transform: translateY(4px);
}
</style>
