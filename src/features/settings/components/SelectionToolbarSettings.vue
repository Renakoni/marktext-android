<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MobileCommandId } from '../../../lib/mobileCommands'
import { useI18n, type I18nKey } from '../../../lib/i18n'
import {
  MOBILE_TOOLBAR_PANELS,
  getMobileToolbarCommandButton,
  type MobileToolbarCommandButton,
} from '../../../lib/mobileToolbarConfig'
import {
  SELECTION_TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY,
  SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS,
  normalizeSelectionToolbarCustomCommands,
  serializeSelectionToolbarCustomCommands,
} from '../../editor/selectionToolbarSettings'
import { useSettingsState } from '../settingsState'
import { useQuickBarReorder } from './useQuickBarReorder'
import ToolbarCommandGlyph from '../../../components/ToolbarCommandGlyph.vue'

// The floating selection toolbar's custom command slots. Unlike the bottom
// quick bar there is no fixed slot and no mode toggle: an EMPTY list is the
// default, which keeps the bar the pure clipboard surface it shipped as.
// The clipboard block itself is owned by the product state table and never
// appears here.
defineProps<{
  testId: string
}>()

const { getValue, setValue } = useSettingsState()
const { t } = useI18n()
const barScroller = ref<HTMLElement | null>(null)

const customCommandIds = computed(() =>
  normalizeSelectionToolbarCustomCommands(
    getValue(SELECTION_TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY, ''),
  ),
)
const selectedCommandIds = computed(() => new Set(customCommandIds.value))
const atCapacity = computed(
  () => customCommandIds.value.length >= SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS,
)
const commandGroups = computed(() =>
  MOBILE_TOOLBAR_PANELS.map(panel => ({
    id: panel.id,
    labelKey: panel.labelKey,
    commands: panel.commands,
  })),
)

function getCommandTitle(command: { title: string; titleKey: I18nKey }) {
  return t(command.titleKey) || command.title
}

function commandTestId(commandId: MobileCommandId) {
  return commandId.replace(/[^a-z0-9]+/gi, '-')
}

function setCustomCommandIds(commandIds: readonly MobileCommandId[]) {
  setValue(
    SELECTION_TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY,
    serializeSelectionToolbarCustomCommands(commandIds),
  )
}

const {
  editing,
  pressedCommandId,
  draggingCommandId,
  exitEditMode,
  onCommandPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
} = useQuickBarReorder({
  commandIds: customCommandIds,
  scrollerRef: barScroller,
  setCommandIds: setCustomCommandIds,
})

const customCommands = computed(() =>
  customCommandIds.value
    .map(commandId => getMobileToolbarCommandButton(commandId))
    .filter((command): command is MobileToolbarCommandButton => Boolean(command)),
)

function addCommand(commandId: MobileCommandId) {
  if (selectedCommandIds.value.has(commandId) || atCapacity.value) {
    return
  }

  setCustomCommandIds([...customCommandIds.value, commandId])
}

function removeCommand(commandId: MobileCommandId) {
  setCustomCommandIds(
    customCommandIds.value.filter(selectedCommandId => selectedCommandId !== commandId),
  )
}

function clearAllCommands() {
  setCustomCommandIds([])
  exitEditMode()
}

function isCommandDisabled(command: MobileToolbarCommandButton) {
  return selectedCommandIds.value.has(command.commandId) || atCapacity.value
}
</script>

<template>
  <div
    class="toolbar-quick-settings"
    :class="{ 'is-editing': editing }"
    :data-testid="testId"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <div class="quickbar-custom-header">
      <h3>{{ t('settings.selectionToolbar.custom.title') }}</h3>
      <div class="quickbar-actions">
        <button
          v-if="editing"
          class="quickbar-done-button"
          type="button"
          data-testid="settings-selectionbar-done"
          @click="exitEditMode"
        >
          {{ t('settings.toolbar.custom.done') }}
        </button>
        <button
          class="quickbar-reset-button"
          type="button"
          data-testid="settings-selectionbar-clear"
          @click="clearAllCommands"
        >
          {{ t('settings.selectionToolbar.custom.clear') }}
        </button>
      </div>
    </div>

    <p class="selectionbar-hint">
      {{
        customCommands.length === 0
          ? t('settings.selectionToolbar.custom.empty')
          : t('settings.selectionToolbar.custom.count', {
            count: customCommands.length,
            max: SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS,
          })
      }}
    </p>

    <div
      ref="barScroller"
      class="quickbar-preview"
      role="group"
      :aria-label="t('settings.toolbar.custom.preview')"
      data-testid="settings-selectionbar-preview"
    >
      <div
        v-for="(command, index) in customCommands"
        :key="command.commandId"
        class="quickbar-item is-editable"
        :class="{
          'is-pressed': pressedCommandId === command.commandId,
          'is-dragging': draggingCommandId === command.commandId,
        }"
        :data-command-id="command.commandId"
        data-quickbar-draggable="true"
        :data-testid="`settings-selectionbar-slot-${index}`"
      >
        <button
          class="quickbar-slot"
          type="button"
          :aria-label="getCommandTitle(command)"
          :data-testid="`settings-selectionbar-button-${commandTestId(command.commandId)}`"
          @contextmenu.prevent
          @pointerdown="event => onCommandPointerDown(event, command.commandId, true)"
        >
          <ToolbarCommandGlyph :command="command" />
        </button>
        <button
          v-if="editing"
          class="quickbar-remove-button"
          type="button"
          :aria-label="t('settings.toolbar.custom.removeCommand', {
            command: getCommandTitle(command),
          })"
          :data-testid="`settings-selectionbar-remove-${commandTestId(command.commandId)}`"
          @pointerdown.stop
          @click.stop="removeCommand(command.commandId)"
        >
          ×
        </button>
      </div>
    </div>

    <div class="quickbar-command-groups">
      <section
        v-for="group in commandGroups"
        :key="group.id"
        class="quickbar-command-group"
        :data-testid="`settings-selectionbar-group-${group.id}`"
      >
        <h4>{{ t(group.labelKey) }}</h4>
        <div class="quickbar-command-grid">
          <button
            v-for="command in group.commands"
            :key="command.commandId"
            class="quickbar-command-button"
            :class="{ 'is-selected': selectedCommandIds.has(command.commandId) }"
            type="button"
            :disabled="isCommandDisabled(command)"
            :aria-pressed="selectedCommandIds.has(command.commandId)"
            :aria-label="t('settings.toolbar.custom.addCommand', {
              command: getCommandTitle(command),
            })"
            :data-testid="`settings-selectionbar-command-${commandTestId(command.commandId)}`"
            @click="addCommand(command.commandId)"
          >
            <ToolbarCommandGlyph :command="command" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped src="./quickbarSettings.css"></style>

<style scoped>
.selectionbar-hint {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.4;
}
</style>
