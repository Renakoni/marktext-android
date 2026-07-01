<script setup lang="ts">
import { computed } from 'vue'
import type { MobileCommandId } from '../lib/mobileCommands'
import {
  MOBILE_TOOLBAR_EDIT_COMMANDS,
  MOBILE_TOOLBAR_PANELS,
  getMobileToolbarPanel,
  getMobileToolbarPanelCommands,
  type MobileEditorToolbarPanel,
} from '../lib/mobileToolbarConfig'

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

const editCommands = MOBILE_TOOLBAR_EDIT_COMMANDS
const panels = MOBILE_TOOLBAR_PANELS
const activePanel = computed(() => getMobileToolbarPanel(props.activePanel))
const activePanelCommands = computed(() => getMobileToolbarPanelCommands(props.activePanel))
const statsText = computed(
  () => `${props.wordCount} words - ${props.characterCount} chars - ${props.lineCount} lines`,
)

function runCommand(commandId: MobileCommandId) {
  if (!props.editorReady) {
    return
  }

  emit('runCommand', commandId)
}

function selectPanel(panel: MobileEditorToolbarPanel) {
  emit('setPanel', panel)

  if (props.expanded) {
    emit('toggleExpanded')
  }
}
</script>

<template>
  <footer
    class="mobile-editor-toolbar"
    :class="{ 'is-expanded': expanded }"
    aria-label="Markdown editing tools"
    data-testid="mobile-editor-toolbar"
  >
    <section
      v-if="expanded"
      id="mobile-editor-toolbar-panel"
      class="toolbar-section-menu"
      role="menu"
      aria-label="Toolbar sections"
      data-testid="mobile-editor-toolbar-panel"
      @pointerdown.prevent
      @mousedown.prevent
    >
      <button
        v-for="panel in panels"
        :key="panel.id"
        class="toolbar-section-option"
        :class="{ 'is-active': activePanel.id === panel.id }"
        type="button"
        role="menuitemradio"
        :aria-checked="activePanel.id === panel.id"
        :data-testid="`toolbar-section-option-${panel.id}`"
        @click="selectPanel(panel.id)"
      >
        <span class="section-option-label">{{ panel.label }}</span>
        <span class="section-option-title">{{ panel.title }}</span>
      </button>

      <p class="toolbar-stats" data-testid="toolbar-document-stats">{{ statsText }}</p>
    </section>

    <div class="toolbar-row">
      <button
        class="toolbar-section-button"
        type="button"
        :aria-label="expanded ? 'Close toolbar sections' : 'Open toolbar sections'"
        :aria-expanded="expanded"
        aria-controls="mobile-editor-toolbar-panel"
        data-testid="toolbar-expand-button"
        @pointerdown.prevent
        @mousedown.prevent
        @click="$emit('toggleExpanded')"
      >
        <span class="toolbar-section-label">{{ activePanel.label }}</span>
        <span class="toolbar-section-caret" aria-hidden="true">{{ expanded ? 'v' : '^' }}</span>
      </button>

      <div class="toolbar-edit-strip" role="toolbar" aria-label="Edit history">
        <button
          v-for="command in editCommands"
          :key="command.commandId"
          class="toolbar-history-button"
          type="button"
          :aria-label="command.title"
          :title="command.title"
          :disabled="!editorReady"
          :data-testid="`toolbar-command-${command.commandId}`"
          @pointerdown.prevent
          @mousedown.prevent
          @click="runCommand(command.commandId)"
        >
          {{ command.label }}
        </button>
      </div>

      <div class="toolbar-command-strip" role="toolbar" :aria-label="activePanel.title">
        <button
          v-for="command in activePanelCommands"
          :key="command.commandId"
          class="toolbar-command-button"
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
          <span class="toolbar-command-label">{{ command.label }}</span>
        </button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.mobile-editor-toolbar {
  position: relative;
  z-index: 18;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-muted) 86%, var(--surface) 14%);
  box-shadow: 0 -6px 18px rgba(26, 44, 50, 0.08);
}

.toolbar-row {
  display: grid;
  grid-template-columns: 104px 92px minmax(0, 1fr);
  gap: 4px;
  align-items: center;
  min-height: 58px;
  padding: 6px 8px calc(env(safe-area-inset-bottom, 0px) + 6px);
}

.toolbar-section-button,
.toolbar-history-button,
.toolbar-command-button,
.toolbar-section-option {
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

.toolbar-section-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 13px;
  font-weight: 760;
}

.toolbar-section-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-section-caret {
  flex: 0 0 auto;
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 860;
}

.toolbar-edit-strip {
  display: grid;
  grid-template-columns: repeat(2, 44px);
  gap: 4px;
  min-width: 0;
}

.toolbar-history-button {
  background: color-mix(in srgb, var(--surface) 84%, var(--surface-muted) 16%);
  color: var(--accent-strong);
  font-size: 18px;
  font-weight: 780;
}

.toolbar-command-strip {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.toolbar-command-strip::-webkit-scrollbar {
  display: none;
}

.toolbar-command-button {
  flex: 0 0 auto;
  padding: 0 11px;
  background: transparent;
  font-size: 14px;
  font-weight: 760;
  white-space: nowrap;
}

.toolbar-command-button[data-command-id='format.emphasis'] {
  font-style: italic;
}

.toolbar-command-button[data-command-id='format.strong'] {
  font-weight: 860;
}

.toolbar-section-button:active,
.toolbar-history-button:active,
.toolbar-command-button:active,
.toolbar-section-option:active {
  background: color-mix(in srgb, var(--accent) 11%, transparent);
}

.toolbar-history-button:disabled,
.toolbar-command-button:disabled {
  color: var(--text-muted);
}

.toolbar-section-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 8px;
  display: grid;
  gap: 4px;
  width: min(268px, calc(100vw - 16px));
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 14px 36px rgba(26, 44, 50, 0.14);
}

.toolbar-section-option {
  display: grid;
  gap: 2px;
  min-height: 52px;
  padding: 7px 10px;
  text-align: left;
}

.toolbar-section-option.is-active {
  background: color-mix(in srgb, var(--accent) 13%, var(--surface));
  color: var(--accent-strong);
}

.section-option-label {
  font-size: 14px;
  font-weight: 780;
  line-height: 1.1;
}

.section-option-title {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 620;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-section-option.is-active .section-option-title {
  color: var(--accent-strong);
}

.toolbar-stats {
  margin: 4px 2px 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.3;
  font-weight: 640;
}

@media (min-width: 720px) {
  .toolbar-row {
    grid-template-columns: 120px 100px minmax(0, 1fr);
    padding-right: max(24px, calc((100vw - 980px) / 2));
    padding-left: max(24px, calc((100vw - 980px) / 2));
  }

  .toolbar-edit-strip {
    grid-template-columns: repeat(2, 48px);
  }

  .toolbar-section-menu {
    left: max(24px, calc((100vw - 980px) / 2));
    width: 300px;
  }
}
</style>
