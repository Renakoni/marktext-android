<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MobileCommandId } from '../../../lib/mobileCommands'
import {
  MOBILE_TOOLBAR_EDIT_COMMANDS,
  MOBILE_TOOLBAR_PANELS,
  MOBILE_TOOLBAR_QUICK_COMMANDS,
  getMobileToolbarPanel,
  getMobileToolbarPanelCommands,
  type MobileEditorToolbarPanel,
} from '../../../lib/mobileToolbarConfig'

const props = defineProps<{
  expanded: boolean
  activePanel: MobileEditorToolbarPanel
  editorReady: boolean
  wordCount: number
  characterCount: number
  lineCount: number
}>()

const emit = defineEmits<{
  runCommand: [commandId: MobileCommandId]
  toggleExpanded: []
  setPanel: [panel: MobileEditorToolbarPanel]
}>()

const panels = MOBILE_TOOLBAR_PANELS
const quickCommands = MOBILE_TOOLBAR_QUICK_COMMANDS
const editCommands = MOBILE_TOOLBAR_EDIT_COMMANDS
const groupMenuOpen = ref(false)

const activePanelDef = computed(() => getMobileToolbarPanel(props.activePanel))
const activePanelCommands = computed(() => getMobileToolbarPanelCommands(props.activePanel))
const statsText = computed(
  () => `${props.wordCount} words · ${props.characterCount} chars · ${props.lineCount} lines`,
)

watch(
  () => props.expanded,
  expanded => {
    if (!expanded) {
      groupMenuOpen.value = false
    }
  },
)

function runCommand(commandId: MobileCommandId) {
  if (!props.editorReady) {
    return
  }

  emit('runCommand', commandId)
}

function toggleGroupMenu() {
  groupMenuOpen.value = !groupMenuOpen.value
}

function selectPanel(panel: MobileEditorToolbarPanel) {
  emit('setPanel', panel)
  groupMenuOpen.value = false
}
</script>

<template>
  <footer
    class="mobile-editor-toolbar"
    :class="{ 'is-expanded': expanded }"
    aria-label="Markdown editing tools"
    data-testid="mobile-editor-toolbar"
  >
    <!-- collapsed: quick actions + fixed expand handle -->
    <div v-if="!expanded" class="toolbar-collapsed">
      <div class="toolbar-quick-strip" role="toolbar" aria-label="Quick editing actions">
        <button
          v-for="command in quickCommands"
          :key="command.commandId"
          class="toolbar-button"
          type="button"
          :aria-label="command.title"
          :title="command.title"
          :disabled="!editorReady"
          :data-command-id="command.commandId"
          :data-testid="`toolbar-command-${command.commandId}`"
          @pointerdown.prevent
          @mousedown.prevent
          @click="runCommand(command.commandId)"
        >
          <span class="toolbar-button-label">{{ command.label }}</span>
        </button>
      </div>
      <button
        class="toolbar-expand-handle"
        type="button"
        aria-label="Expand toolbar"
        :aria-expanded="false"
        data-testid="toolbar-expand-button"
        @pointerdown.prevent
        @mousedown.prevent
        @click="$emit('toggleExpanded')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
    </div>

    <!-- expanded: header row + command body -->
    <div v-else class="toolbar-expanded">
      <div class="toolbar-header" role="toolbar" aria-label="Toolbar controls">
        <button
          class="toolbar-group-switcher"
          type="button"
          :aria-expanded="groupMenuOpen"
          aria-controls="mobile-editor-toolbar-panel"
          data-testid="toolbar-group-switcher"
          @pointerdown.prevent
          @mousedown.prevent
          @click="toggleGroupMenu"
        >
          <span class="group-switcher-label">{{ activePanelDef.label }}</span>
          <svg class="group-switcher-caret" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <div class="toolbar-header-spacer" />

        <button
          v-for="command in editCommands"
          :key="command.commandId"
          class="toolbar-button toolbar-history-button"
          type="button"
          :aria-label="command.title"
          :title="command.title"
          :disabled="!editorReady"
          :data-command-id="command.commandId"
          :data-testid="`toolbar-command-${command.commandId}`"
          @pointerdown.prevent
          @mousedown.prevent
          @click="runCommand(command.commandId)"
        >
          <span class="toolbar-button-label">{{ command.label }}</span>
        </button>

        <button
          class="toolbar-expand-handle"
          type="button"
          aria-label="Collapse toolbar"
          :aria-expanded="true"
          data-testid="toolbar-expand-button"
          @pointerdown.prevent
          @mousedown.prevent
          @click="$emit('toggleExpanded')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <div
        id="mobile-editor-toolbar-body"
        class="toolbar-body"
        data-testid="mobile-editor-toolbar-body"
        @pointerdown.prevent
        @mousedown.prevent
      >
        <div class="toolbar-command-strip" role="toolbar" :aria-label="activePanelDef.title">
          <button
            v-for="command in activePanelCommands"
            :key="command.commandId"
            class="toolbar-button"
            type="button"
            :aria-label="command.title"
            :title="command.title"
            :disabled="!editorReady"
            :data-command-id="command.commandId"
            :data-testid="`toolbar-command-${command.commandId}`"
            @pointerdown.prevent
            @mousedown.prevent
            @click="runCommand(command.commandId)"
          >
            <span class="toolbar-button-label">{{ command.label }}</span>
          </button>
        </div>

        <p class="toolbar-stats" data-testid="toolbar-document-stats">{{ statsText }}</p>
      </div>

      <section
        v-if="groupMenuOpen"
        id="mobile-editor-toolbar-panel"
        class="toolbar-group-menu"
        role="menu"
        aria-label="Toolbar groups"
        data-testid="mobile-editor-toolbar-panel"
        @pointerdown.prevent
        @mousedown.prevent
      >
        <button
          v-for="panel in panels"
          :key="panel.id"
          class="toolbar-group-option"
          :class="{ 'is-active': activePanelDef.id === panel.id }"
          type="button"
          role="menuitemradio"
          :aria-checked="activePanelDef.id === panel.id"
          :data-testid="`toolbar-section-option-${panel.id}`"
          @click="selectPanel(panel.id)"
        >
          <span class="group-option-label">{{ panel.label }}</span>
          <span class="group-option-title">{{ panel.title }}</span>
        </button>
      </section>
    </div>
  </footer>
</template>

<style scoped>
.mobile-editor-toolbar {
  position: relative;
  z-index: 18;
  border-top: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-toolbar);
}

.toolbar-collapsed {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  align-items: stretch;
  min-height: 50px;
  padding: 4px 6px calc(env(safe-area-inset-bottom, 0px) + 4px);
}

.toolbar-quick-strip {
  display: flex;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 2px;
}

.toolbar-quick-strip::-webkit-scrollbar {
  display: none;
}

.toolbar-expanded {
  display: grid;
  gap: 2px;
  padding: 6px 6px calc(env(safe-area-inset-bottom, 0px) + 6px);
}

.toolbar-header {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
}

.toolbar-header-spacer {
  flex: 1 1 auto;
}

.toolbar-group-switcher {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.006em;
}

.group-switcher-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-switcher-caret {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  stroke: var(--text-muted);
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 200ms var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.toolbar-group-switcher[aria-expanded='true'] .group-switcher-caret {
  transform: rotate(180deg);
}

.toolbar-button,
.toolbar-expand-handle,
.toolbar-group-option {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font: inherit;
  letter-spacing: 0;
  touch-action: manipulation;
}

.toolbar-button {
  flex: 0 0 auto;
  padding: 0 11px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.toolbar-quick-strip .toolbar-button {
  padding: 0 13px;
}

.toolbar-history-button {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent-strong);
}

.toolbar-expand-handle {
  display: grid;
  place-items: center;
  width: 44px;
  border-radius: 8px;
  color: var(--text-muted);
}

.toolbar-expand-handle svg {
  width: 22px;
  height: 22px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.toolbar-button[data-command-id='format.emphasis'] {
  font-style: italic;
}

.toolbar-button[data-command-id='format.strong'] {
  font-weight: 800;
}

.toolbar-button[data-command-id='format.underline'] {
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}

.toolbar-button[data-command-id='format.strike'] {
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.toolbar-button[data-command-id='format.highlight'] {
  background: var(--accent-tint-10);
  color: var(--accent-strong);
}

.toolbar-button[data-command-id='format.superscript'],
.toolbar-button[data-command-id='format.subscript'],
.toolbar-button[data-command-id='format.inline-math'],
.toolbar-button[data-command-id='format.clear-format'] {
  font-size: 12px;
}

.toolbar-button[data-command-id='format.inline-code'] {
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
}

.toolbar-button[data-command-id='format.clear-format'] {
  color: var(--text-muted);
}

.toolbar-button:active,
.toolbar-expand-handle:active,
.toolbar-group-switcher:active,
.toolbar-group-option:active {
  background: var(--accent-tint-11);
}

.toolbar-button:disabled {
  color: var(--text-faint);
}

.toolbar-body {
  display: grid;
  gap: 4px;
}

.toolbar-command-strip {
  display: flex;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 2px;
}

.toolbar-command-strip::-webkit-scrollbar {
  display: none;
}

.toolbar-stats {
  margin: 2px 4px 0;
  color: var(--text-faint);
  font-size: 11px;
  line-height: 1.3;
  font-weight: 500;
}

.toolbar-group-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 6px;
  display: grid;
  gap: 2px;
  width: min(268px, calc(100vw - 12px));
  max-height: min(70vh, 388px);
  overflow-y: auto;
  overscroll-behavior-y: contain;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius, 14px);
  background: var(--surface);
  box-shadow: var(--shadow-toolbar-menu);
}

.toolbar-group-option {
  display: grid;
  gap: 2px;
  min-height: 52px;
  padding: 7px 10px;
  border-radius: var(--radius-sm, 10px);
  text-align: left;
}

.toolbar-group-option.is-active {
  background: var(--toolbar-active-panel-bg);
  color: var(--accent-strong);
}

.group-option-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.006em;
}

.group-option-title {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-group-option.is-active .group-option-title {
  color: var(--accent-strong);
}

@media (min-width: 720px) {
  .toolbar-collapsed,
  .toolbar-expanded {
    padding-right: max(24px, calc((100vw - 980px) / 2));
    padding-left: max(24px, calc((100vw - 980px) / 2));
  }

  .toolbar-group-menu {
    left: max(24px, calc((100vw - 980px) / 2));
  }
}
</style>
