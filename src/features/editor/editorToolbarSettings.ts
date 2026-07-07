import { MOBILE_COMMANDS, type MobileCommandId } from '../../lib/mobileCommands'
import {
  DEFAULT_MOBILE_TOOLBAR_PANEL,
  MOBILE_TOOLBAR_PANELS,
  MOBILE_TOOLBAR_QUICK_COMMANDS,
  getMobileToolbarCommandButton,
  type MobileEditorToolbarPanel,
  type MobileToolbarCommandButton,
} from '../../lib/mobileToolbarConfig'
import type { SettingsValue } from '../settings/settingsState'

export type ToolbarDisplayMode = 'docked' | 'hidden'
export type ToolbarQuickBarMode = 'default' | 'custom'
export type EditorToolbarSettingKey =
  | 'toolbarDisplayMode'
  | 'toolbarDefaultPanel'
  | 'toolbarRememberPanel'
  | 'toolbarCompact'
  | 'toolbarQuickBarMode'
  | 'toolbarCustomQuickCommands'
export type ToolbarSettingsReader = <T extends SettingsValue>(key: string, defaultValue: T) => T

export interface EditorToolbarSettings {
  displayMode: ToolbarDisplayMode
  defaultPanel: MobileEditorToolbarPanel
  rememberPanel: boolean
  compact: boolean
  quickBarMode: ToolbarQuickBarMode
  customQuickCommandIds: readonly MobileCommandId[]
  quickCommands: readonly MobileToolbarCommandButton[]
}

export const TOOLBAR_FIXED_QUICK_COMMAND_ID = MOBILE_COMMANDS.EDIT_UNDO
export const TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY = 'toolbarCustomQuickCommands'

export const TOOLBAR_DISPLAY_MODE_STORAGE_KEY = 'toolbarDisplayMode'
export const TOOLBAR_DEFAULT_PANEL_STORAGE_KEY = 'toolbarDefaultPanel'
export const TOOLBAR_REMEMBER_PANEL_STORAGE_KEY = 'toolbarRememberPanel'
export const TOOLBAR_QUICK_BAR_MODE_STORAGE_KEY = 'toolbarQuickBarMode'

export const EDITOR_TOOLBAR_SETTING_KEYS = [
  TOOLBAR_DISPLAY_MODE_STORAGE_KEY,
  TOOLBAR_DEFAULT_PANEL_STORAGE_KEY,
  TOOLBAR_REMEMBER_PANEL_STORAGE_KEY,
  'toolbarCompact',
  TOOLBAR_QUICK_BAR_MODE_STORAGE_KEY,
  TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY,
] as const satisfies readonly EditorToolbarSettingKey[]

const TOOLBAR_DISPLAY_MODES = new Set<ToolbarDisplayMode>(['docked', 'hidden'])
const TOOLBAR_QUICK_BAR_MODES = new Set<ToolbarQuickBarMode>(['default', 'custom'])
const TOOLBAR_PANEL_IDS = new Set<MobileEditorToolbarPanel>(
  MOBILE_TOOLBAR_PANELS.map(panel => panel.id),
)
const TOOLBAR_CUSTOM_COMMAND_IDS = new Set<MobileCommandId>(
  MOBILE_TOOLBAR_PANELS.flatMap(panel => panel.commands.map(command => command.commandId)),
)

export const DEFAULT_EDITOR_TOOLBAR_SETTINGS = {
  displayMode: 'docked',
  defaultPanel: DEFAULT_MOBILE_TOOLBAR_PANEL,
  rememberPanel: true,
  compact: false,
  quickBarMode: 'default',
} as const satisfies Omit<EditorToolbarSettings, 'customQuickCommandIds' | 'quickCommands'>

export const DEFAULT_TOOLBAR_CUSTOM_COMMAND_IDS = MOBILE_TOOLBAR_QUICK_COMMANDS
  .map(command => command.commandId)
  .filter(commandId => commandId !== TOOLBAR_FIXED_QUICK_COMMAND_ID)

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeChoice<T extends string>(value: unknown, options: Set<T>, fallback: T): T {
  return options.has(value as T) ? (value as T) : fallback
}

export function normalizeToolbarDisplayMode(value: unknown): ToolbarDisplayMode {
  return normalizeChoice(
    value,
    TOOLBAR_DISPLAY_MODES,
    DEFAULT_EDITOR_TOOLBAR_SETTINGS.displayMode,
  )
}

export function normalizeToolbarPanel(value: unknown): MobileEditorToolbarPanel {
  return normalizeChoice(value, TOOLBAR_PANEL_IDS, DEFAULT_EDITOR_TOOLBAR_SETTINGS.defaultPanel)
}

export function normalizeToolbarQuickBarMode(value: unknown): ToolbarQuickBarMode {
  return normalizeChoice(
    value,
    TOOLBAR_QUICK_BAR_MODES,
    DEFAULT_EDITOR_TOOLBAR_SETTINGS.quickBarMode,
  )
}

export function serializeToolbarCustomQuickCommands(commandIds: readonly MobileCommandId[]) {
  const seen = new Set<MobileCommandId>()

  return commandIds
    .filter(commandId => {
      if (
        commandId === TOOLBAR_FIXED_QUICK_COMMAND_ID ||
        !TOOLBAR_CUSTOM_COMMAND_IDS.has(commandId) ||
        seen.has(commandId)
      ) {
        return false
      }

      seen.add(commandId)
      return true
    })
    .join(',')
}

export function normalizeToolbarCustomQuickCommands(value: unknown) {
  const rawSlots = typeof value === 'string' ? value.split(',') : []
  const seen = new Set<MobileCommandId>()

  return rawSlots.reduce<MobileCommandId[]>((commandIds, commandId) => {
    if (
      commandId === TOOLBAR_FIXED_QUICK_COMMAND_ID ||
      !TOOLBAR_CUSTOM_COMMAND_IDS.has(commandId as MobileCommandId) ||
      seen.has(commandId as MobileCommandId)
    ) {
      return commandIds
    }

    seen.add(commandId as MobileCommandId)
    commandIds.push(commandId as MobileCommandId)
    return commandIds
  }, [])
}

export function getQuickToolbarCommands(
  quickBarMode: ToolbarQuickBarMode,
  customQuickCommandIds: readonly MobileCommandId[],
) {
  if (quickBarMode === 'default') {
    return MOBILE_TOOLBAR_QUICK_COMMANDS
  }

  return [
    getMobileToolbarCommandButton(TOOLBAR_FIXED_QUICK_COMMAND_ID),
    ...customQuickCommandIds.map(commandId => getMobileToolbarCommandButton(commandId)),
  ].filter((command): command is MobileToolbarCommandButton => Boolean(command))
}

export function getEditorToolbarSettings(getValue: ToolbarSettingsReader): EditorToolbarSettings {
  const customQuickCommandIds = normalizeToolbarCustomQuickCommands(
    getValue(TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY, ''),
  )
  const quickBarMode = normalizeToolbarQuickBarMode(
    getValue(TOOLBAR_QUICK_BAR_MODE_STORAGE_KEY, DEFAULT_EDITOR_TOOLBAR_SETTINGS.quickBarMode),
  )

  return {
    displayMode: normalizeToolbarDisplayMode(
      getValue(TOOLBAR_DISPLAY_MODE_STORAGE_KEY, DEFAULT_EDITOR_TOOLBAR_SETTINGS.displayMode),
    ),
    defaultPanel: normalizeToolbarPanel(
      getValue(TOOLBAR_DEFAULT_PANEL_STORAGE_KEY, DEFAULT_EDITOR_TOOLBAR_SETTINGS.defaultPanel),
    ),
    rememberPanel: normalizeBoolean(
      getValue(TOOLBAR_REMEMBER_PANEL_STORAGE_KEY, DEFAULT_EDITOR_TOOLBAR_SETTINGS.rememberPanel),
      DEFAULT_EDITOR_TOOLBAR_SETTINGS.rememberPanel,
    ),
    compact: normalizeBoolean(
      getValue('toolbarCompact', DEFAULT_EDITOR_TOOLBAR_SETTINGS.compact),
      DEFAULT_EDITOR_TOOLBAR_SETTINGS.compact,
    ),
    quickBarMode,
    customQuickCommandIds,
    quickCommands: getQuickToolbarCommands(quickBarMode, customQuickCommandIds),
  }
}
