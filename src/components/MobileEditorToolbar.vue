<script setup lang="ts">
import { computed } from 'vue'
import type { MobileCommandId } from '../lib/mobileCommands'
import {
  MOBILE_TOOLBAR_PANELS,
  MOBILE_TOOLBAR_QUICK_GROUPS,
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

const quickCommandGroups = MOBILE_TOOLBAR_QUICK_GROUPS
const panelTabs = MOBILE_TOOLBAR_PANELS
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
</script>

<template>
  <footer
    class="mobile-editor-toolbar"
    :class="{ 'is-expanded': expanded }"
    aria-label="Markdown editing tools"
    data-testid="mobile-editor-toolbar"
  >
    <div class="toolbar-row">
      <div class="quick-command-strip" role="toolbar" aria-label="Quick Markdown commands">
        <div
          v-for="group in quickCommandGroups"
          :key="group.id"
          class="quick-command-group"
          role="group"
          :aria-label="group.title"
        >
          <button
            v-for="command in group.commands"
            :key="command.commandId"
            class="toolbar-button"
            type="button"
            :aria-label="command.title"
            :title="command.title"
            :disabled="!editorReady"
            :data-testid="`toolbar-command-${command.commandId}`"
            @pointerdown.prevent
            @mousedown.prevent
            @click="runCommand(command.commandId)"
          >
            <span class="toolbar-button-label">{{ command.label }}</span>
          </button>
        </div>
      </div>

      <button
        class="toolbar-expand-button"
        type="button"
        :aria-label="expanded ? 'Collapse editing toolbar' : 'Expand editing toolbar'"
        :aria-expanded="expanded"
        aria-controls="mobile-editor-toolbar-panel"
        data-testid="toolbar-expand-button"
        @pointerdown.prevent
        @mousedown.prevent
        @click="$emit('toggleExpanded')"
      >
        {{ expanded ? 'v' : '^' }}
      </button>
    </div>

    <section
      v-if="expanded"
      id="mobile-editor-toolbar-panel"
      class="toolbar-panel"
      data-testid="mobile-editor-toolbar-panel"
    >
      <div class="toolbar-tabs" role="tablist" aria-label="Toolbar sections">
        <button
          v-for="tab in panelTabs"
          :key="tab.id"
          class="toolbar-tab"
          :class="{ 'is-active': activePanel.id === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activePanel.id === tab.id"
          :data-testid="`toolbar-panel-tab-${tab.id}`"
          @pointerdown.prevent
          @mousedown.prevent
          @click="$emit('setPanel', tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="panel-command-grid" role="toolbar" :aria-label="activePanel.title">
        <button
          v-for="command in activePanelCommands"
          :key="command.commandId"
          class="panel-command-button"
          type="button"
          :aria-label="command.title"
          :title="command.title"
          :disabled="!editorReady"
          :data-testid="`toolbar-panel-command-${command.commandId}`"
          @pointerdown.prevent
          @mousedown.prevent
          @click="runCommand(command.commandId)"
        >
          {{ command.label }}
        </button>
      </div>

      <p class="toolbar-stats" data-testid="toolbar-document-stats">{{ statsText }}</p>
    </section>
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
  grid-template-columns: minmax(0, 1fr) 52px;
  align-items: stretch;
  min-height: 58px;
  padding: 6px 0 calc(env(safe-area-inset-bottom, 0px) + 6px);
}

.quick-command-strip {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  padding: 0 8px;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.quick-command-strip::-webkit-scrollbar {
  display: none;
}

.quick-command-group {
  display: contents;
}

.toolbar-button,
.toolbar-expand-button,
.toolbar-tab,
.panel-command-button {
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
  padding: 0 12px;
  font-size: 15px;
  font-weight: 760;
  white-space: nowrap;
}

.toolbar-button[aria-label='Italic'] {
  font-style: italic;
}

.toolbar-button[aria-label='Bold'] {
  font-weight: 860;
}

.toolbar-expand-button {
  width: 52px;
  border-left: 1px solid var(--border);
  border-radius: 0;
  color: var(--accent-strong);
  font-size: 18px;
  font-weight: 800;
}

.toolbar-button:active,
.toolbar-expand-button:active,
.toolbar-tab:active,
.panel-command-button:active {
  background: color-mix(in srgb, var(--accent) 11%, transparent);
}

.toolbar-button:disabled,
.panel-command-button:disabled {
  color: var(--text-muted);
}

.toolbar-panel {
  display: grid;
  gap: 10px;
  max-height: min(42vh, 280px);
  overflow: auto;
  padding: 0 12px calc(env(safe-area-inset-bottom, 0px) + 12px);
  border-top: 1px solid var(--border);
  background: var(--surface);
  -webkit-overflow-scrolling: touch;
}

.toolbar-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding-top: 10px;
}

.toolbar-tab {
  min-height: 40px;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 760;
}

.toolbar-tab.is-active {
  background: color-mix(in srgb, var(--accent) 13%, var(--surface));
  color: var(--accent-strong);
}

.panel-command-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.panel-command-button {
  min-height: 46px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 14px;
  font-weight: 740;
  text-align: left;
}

.toolbar-stats {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.3;
  font-weight: 640;
}

@media (min-width: 720px) {
  .toolbar-row,
  .toolbar-panel {
    padding-right: max(24px, calc((100vw - 980px) / 2));
    padding-left: max(24px, calc((100vw - 980px) / 2));
  }

  .toolbar-row {
    grid-template-columns: minmax(0, 1fr) 56px;
  }

  .toolbar-expand-button {
    width: 56px;
  }

  .panel-command-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
