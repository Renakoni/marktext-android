import type { MobileCommandId } from '../../lib/mobileCommands'
import {
  MOBILE_TOOLBAR_PANELS,
  getMobileToolbarCommandButton,
  type MobileToolbarCommandButton,
} from '../../lib/mobileToolbarConfig'
import type { SettingsValue } from '../settings/settingsState'

// The floating selection toolbar's custom command slots. The clipboard block
// (cut/copy/paste/select-all) stays owned by the product state table and is
// never customizable; users choose ADDITIONAL commands from the same pool the
// bottom-toolbar quick bar offers. An empty list IS the default mode: the bar
// stays a pure clipboard surface, pixel-identical to the shipped behavior.
export type SelectionToolbarRows = 1 | 2

export const SELECTION_TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY = 'selectionToolbarCustomCommands'
export const SELECTION_TOOLBAR_ROWS_STORAGE_KEY = 'selectionToolbarRows'

// Sanity cap only — capacity per page is computed from the viewport at
// render time and overflow pages; the cap just keeps the picker honest.
export const SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS = 12

export const DEFAULT_SELECTION_TOOLBAR_ROWS: SelectionToolbarRows = 1

export const SELECTION_TOOLBAR_SETTING_KEYS = [
  SELECTION_TOOLBAR_ROWS_STORAGE_KEY,
  SELECTION_TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY,
] as const

const SELECTION_TOOLBAR_COMMAND_POOL = new Set<MobileCommandId>(
  MOBILE_TOOLBAR_PANELS.flatMap(panel => panel.commands.map(command => command.commandId)),
)

export interface SelectionToolbarSettings {
  rows: SelectionToolbarRows
  customCommandIds: readonly MobileCommandId[]
  customCommands: readonly MobileToolbarCommandButton[]
}

export type SelectionToolbarSettingsReader = <T extends SettingsValue>(
  key: string,
  defaultValue: T,
) => T

export function normalizeSelectionToolbarRows(value: unknown): SelectionToolbarRows {
  return value === '2' || value === 2 ? 2 : DEFAULT_SELECTION_TOOLBAR_ROWS
}

export function serializeSelectionToolbarCustomCommands(
  commandIds: readonly MobileCommandId[],
) {
  const seen = new Set<MobileCommandId>()

  return commandIds
    .filter(commandId => {
      if (!SELECTION_TOOLBAR_COMMAND_POOL.has(commandId) || seen.has(commandId)) {
        return false
      }

      seen.add(commandId)
      return true
    })
    .slice(0, SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS)
    .join(',')
}

export function normalizeSelectionToolbarCustomCommands(value: unknown) {
  const rawSlots = typeof value === 'string' ? value.split(',') : []
  const seen = new Set<MobileCommandId>()
  const commandIds: MobileCommandId[] = []

  for (const rawSlot of rawSlots) {
    const commandId = rawSlot as MobileCommandId
    if (!SELECTION_TOOLBAR_COMMAND_POOL.has(commandId) || seen.has(commandId)) {
      continue
    }

    seen.add(commandId)
    commandIds.push(commandId)
    if (commandIds.length >= SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS) {
      break
    }
  }

  return commandIds
}

export function getSelectionToolbarSettings(
  getValue: SelectionToolbarSettingsReader,
): SelectionToolbarSettings {
  const customCommandIds = normalizeSelectionToolbarCustomCommands(
    getValue(SELECTION_TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY, ''),
  )

  return {
    rows: normalizeSelectionToolbarRows(
      getValue(SELECTION_TOOLBAR_ROWS_STORAGE_KEY, String(DEFAULT_SELECTION_TOOLBAR_ROWS)),
    ),
    customCommandIds,
    customCommands: customCommandIds
      .map(commandId => getMobileToolbarCommandButton(commandId))
      .filter((command): command is MobileToolbarCommandButton => Boolean(command)),
  }
}
