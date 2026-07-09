<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { MobileCommandId } from '../../../lib/mobileCommands'
import { useI18n, type I18nKey } from '../../../lib/i18n'
import {
  MOBILE_TOOLBAR_PANELS,
  getMobileToolbarCommandButton,
  type MobileToolbarCommandButton,
} from '../../../lib/mobileToolbarConfig'
import {
  DEFAULT_TOOLBAR_CUSTOM_COMMAND_IDS,
  TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY,
  TOOLBAR_FIXED_QUICK_COMMAND_ID,
  normalizeToolbarCustomQuickCommands,
  serializeToolbarCustomQuickCommands,
} from '../../editor/editorToolbarSettings'
import { useSettingsState } from '../settingsState'
import { useQuickBarReorder } from './useQuickBarReorder'

defineProps<{
  testId: string
}>()

const { getValue, hasValue, setValue } = useSettingsState()
const { t } = useI18n()
const quickBarScroller = ref<HTMLElement | null>(null)
const fixedCommand = getMobileToolbarCommandButton(TOOLBAR_FIXED_QUICK_COMMAND_ID)

const customCommandIds = computed(() =>
  normalizeToolbarCustomQuickCommands(getValue(TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY, '')),
)
const selectedCommandIds = computed(() => new Set(customCommandIds.value))
const commandGroups = computed(() =>
  MOBILE_TOOLBAR_PANELS.map(panel => ({
    id: panel.id,
    labelKey: panel.labelKey,
    commands: panel.commands,
  })),
)

function getCommandLabel(command: { label: string; labelKey?: I18nKey }) {
  return command.labelKey ? t(command.labelKey) : command.label
}

function getCommandTitle(command: { title: string; titleKey: I18nKey }) {
  return t(command.titleKey) || command.title
}

function commandTestId(commandId: MobileCommandId) {
  return commandId.replace(/[^a-z0-9]+/gi, '-')
}

function setCustomCommandIds(commandIds: readonly MobileCommandId[]) {
  setValue(TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY, serializeToolbarCustomQuickCommands(commandIds))
}

if (!hasValue(TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY)) {
  setCustomCommandIds(DEFAULT_TOOLBAR_CUSTOM_COMMAND_IDS)
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
  scrollerRef: quickBarScroller,
  setCommandIds: setCustomCommandIds,
})

const customCommands = computed(() =>
  customCommandIds.value
    .map(commandId => getMobileToolbarCommandButton(commandId))
    .filter((command): command is MobileToolbarCommandButton => Boolean(command)),
)

async function scrollPreviewToEnd() {
  await nextTick()
  const scroller = quickBarScroller.value
  if (scroller) {
    scroller.scrollTo({ left: scroller.scrollWidth, behavior: 'smooth' })
  }
}

function addCommand(commandId: MobileCommandId) {
  if (selectedCommandIds.value.has(commandId)) {
    return
  }

  setCustomCommandIds([...customCommandIds.value, commandId])
  scrollPreviewToEnd()
}

function removeCommand(commandId: MobileCommandId) {
  setCustomCommandIds(customCommandIds.value.filter(selectedCommandId => selectedCommandId !== commandId))
}

function restoreDefaultQuickBar() {
  setCustomCommandIds(DEFAULT_TOOLBAR_CUSTOM_COMMAND_IDS)
  exitEditMode()
  nextTick(() => quickBarScroller.value?.scrollTo({ left: 0, behavior: 'smooth' }))
}

function isCommandDisabled(command: MobileToolbarCommandButton) {
  return selectedCommandIds.value.has(command.commandId)
}

function onFixedCommandPointerDown(event: PointerEvent) {
  if (fixedCommand) {
    onCommandPointerDown(event, fixedCommand.commandId, false)
  }
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
      <h3>{{ t('settings.toolbar.custom.title') }}</h3>
      <div class="quickbar-actions">
        <button
          v-if="editing"
          class="quickbar-done-button"
          type="button"
          data-testid="settings-quickbar-done"
          @click="exitEditMode"
        >
          {{ t('settings.toolbar.custom.done') }}
        </button>
        <button
          class="quickbar-reset-button"
          type="button"
          data-testid="settings-quickbar-restore-default"
          @click="restoreDefaultQuickBar"
        >
          {{ t('settings.toolbar.custom.restoreDefault') }}
        </button>
      </div>
    </div>

    <div
      ref="quickBarScroller"
      class="quickbar-preview"
      role="group"
      :aria-label="t('settings.toolbar.custom.preview')"
      data-testid="settings-quickbar-preview"
    >
      <div v-if="fixedCommand" class="quickbar-item is-fixed">
        <button
          class="quickbar-slot"
          type="button"
          :aria-label="t('settings.toolbar.custom.fixedCommand', {
            command: getCommandTitle(fixedCommand),
          })"
          data-testid="settings-quickbar-slot-fixed"
          @contextmenu.prevent
          @pointerdown="onFixedCommandPointerDown"
        >
          <span class="quickbar-command-label">{{ getCommandLabel(fixedCommand) }}</span>
        </button>
      </div>

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
        :data-testid="`settings-quickbar-slot-${index}`"
      >
        <button
          class="quickbar-slot"
          type="button"
          :aria-label="getCommandTitle(command)"
          :data-testid="`settings-quickbar-button-${commandTestId(command.commandId)}`"
          @contextmenu.prevent
          @pointerdown="event => onCommandPointerDown(event, command.commandId, true)"
        >
          <span class="quickbar-command-label">{{ getCommandLabel(command) }}</span>
        </button>
        <button
          v-if="editing"
          class="quickbar-remove-button"
          type="button"
          :aria-label="t('settings.toolbar.custom.removeCommand', {
            command: getCommandTitle(command),
          })"
          :data-testid="`settings-quickbar-remove-${commandTestId(command.commandId)}`"
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
        :data-testid="`settings-quickbar-group-${group.id}`"
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
            :data-testid="`settings-quickbar-command-${commandTestId(command.commandId)}`"
            @click="addCommand(command.commandId)"
          >
            <span class="quickbar-command-label">{{ getCommandLabel(command) }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.toolbar-quick-settings {
  position: relative;
  display: grid;
  gap: 14px;
  padding: 14px 20px 18px;
  color: var(--text);
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.quickbar-custom-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.quickbar-custom-header h3,
.quickbar-command-group h4 {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.3;
  font-weight: 600;
  letter-spacing: 0;
}

.quickbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.quickbar-done-button,
.quickbar-reset-button {
  min-height: 38px;
  padding: 0 13px;
  border: 0;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  touch-action: manipulation;
  transition: background-color var(--dur-standard) var(--ease-out);
}

.quickbar-done-button {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 600;
}

.quickbar-reset-button {
  background: var(--surface-muted);
  color: var(--text);
}

.quickbar-preview {
  display: flex;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  padding: 8px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-sunken);
  touch-action: pan-x;
}

.quickbar-preview::-webkit-scrollbar {
  display: none;
}

.quickbar-item {
  position: relative;
  flex: 0 0 calc((100% - 30px) / 6);
  min-width: 48px;
  transition:
    opacity 120ms ease,
    transform 190ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform;
}

.quickbar-slot,
.quickbar-command-button {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border: var(--hairline) solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
  touch-action: pan-x;
}

.quickbar-slot {
  position: relative;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 180ms ease,
    color 160ms ease,
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.quickbar-item.is-fixed .quickbar-slot {
  border-color: transparent;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.quickbar-item.is-pressed .quickbar-slot {
  border-color: var(--accent);
}

.toolbar-quick-settings.is-editing
  .quickbar-item.is-editable:not(.is-dragging, .quickbar-sortable-chosen, .quickbar-sortable-ghost)
  .quickbar-slot {
  animation: quickbar-wiggle 160ms ease-in-out infinite alternate;
}

.toolbar-quick-settings.is-editing .quickbar-item.is-editable:nth-child(2n) .quickbar-slot {
  animation-delay: -80ms;
}

.quickbar-sortable-chosen .quickbar-slot,
.quickbar-sortable-fallback .quickbar-slot,
.quickbar-item.is-dragging .quickbar-slot {
  animation: none;
  border-color: var(--accent);
  background: var(--surface-raised);
  box-shadow: var(--shadow-float);
  color: var(--text);
  transform: translateY(-6px) scale(1.06);
  touch-action: none;
  z-index: 4;
}

.quickbar-sortable-fallback {
  opacity: 0.98;
  pointer-events: none;
  z-index: 9999;
}

.quickbar-sortable-ghost {
  opacity: 0.34;
}

.quickbar-sortable-ghost .quickbar-slot {
  color: transparent;
  box-shadow: none;
  transform: none;
}

.quickbar-sortable-drag {
  transition: none;
}

.quickbar-remove-button {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 5;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: var(--hairline) solid var(--border);
  border-radius: 999px;
  background: var(--surface-raised);
  color: var(--text-muted);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  box-shadow: var(--shadow-thumb);
}

.quickbar-done-button:active,
.quickbar-reset-button:active,
.quickbar-slot:active,
.quickbar-command-button:not(:disabled):active,
.quickbar-remove-button:active {
  transform: translateY(0.5px);
}

.quickbar-done-button:focus-visible,
.quickbar-reset-button:focus-visible,
.quickbar-slot:focus-visible,
.quickbar-command-button:focus-visible,
.quickbar-remove-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

.quickbar-command-groups {
  display: grid;
  gap: 16px;
}

.quickbar-command-group {
  display: grid;
  gap: 8px;
}

.quickbar-command-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.quickbar-command-button.is-selected {
  border-color: transparent;
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.quickbar-command-button:disabled:not(.is-selected) {
  color: var(--text-faint);
}

.quickbar-command-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes quickbar-wiggle {
  from {
    transform: rotate(-1deg) translateY(-0.5px);
  }

  to {
    transform: rotate(1deg) translateY(0.5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .quickbar-slot {
    transition: none;
  }

  .toolbar-quick-settings.is-editing
    .quickbar-item.is-editable:not(.is-dragging, .quickbar-sortable-chosen, .quickbar-sortable-ghost)
    .quickbar-slot {
    animation: none;
  }
}
</style>
