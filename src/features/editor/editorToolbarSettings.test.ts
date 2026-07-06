import { describe, expect, it } from 'vitest'
import { MOBILE_COMMANDS } from '../../lib/mobileCommands'
import { MOBILE_TOOLBAR_QUICK_COMMANDS } from '../../lib/mobileToolbarConfig'
import {
  DEFAULT_EDITOR_TOOLBAR_SETTINGS,
  DEFAULT_TOOLBAR_CUSTOM_COMMAND_IDS,
  TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY,
  getEditorToolbarSettings,
  migrateEditorToolbarSettings,
  normalizeToolbarCustomQuickCommands,
  serializeToolbarCustomQuickCommands,
} from './editorToolbarSettings'

describe('editorToolbarSettings', () => {
  it('uses docked default toolbar behavior when no values are stored', () => {
    const settings = getEditorToolbarSettings((_, defaultValue) => defaultValue)

    expect(settings).toMatchObject({
      displayMode: 'docked',
      defaultPanel: 'format',
      rememberPanel: true,
      compact: false,
      quickBarMode: 'default',
      customQuickCommandIds: [],
    })
    expect(settings.quickCommands).toBe(MOBILE_TOOLBAR_QUICK_COMMANDS)
  })

  it('normalizes legacy toolbar keys without preserving the unsupported floating mode', () => {
    const values = new Map<string, boolean | number | string>([
      ['toolbarKeyboard', 'floating'],
      ['toolbarDefaultTab', 'paragraph'],
      ['toolbarRememberTab', false],
    ])

    const settings = getEditorToolbarSettings((key, defaultValue) =>
      values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue,
    )

    expect(settings).toMatchObject({
      displayMode: DEFAULT_EDITOR_TOOLBAR_SETTINGS.displayMode,
      defaultPanel: 'paragraph',
      rememberPanel: false,
    })
  })

  it('migrates legacy toolbar keys into the current storage keys', () => {
    const values = new Map<string, boolean | number | string>([
      ['toolbarKeyboard', 'floating'],
      ['toolbarDefaultTab', 'paragraph'],
      ['toolbarRememberTab', false],
    ])

    migrateEditorToolbarSettings(
      key => values.has(key),
      (key, defaultValue) => (values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue),
      (key, value) => values.set(key, value),
    )

    expect(values.get('toolbarDisplayMode')).toBe(DEFAULT_EDITOR_TOOLBAR_SETTINGS.displayMode)
    expect(values.get('toolbarDefaultPanel')).toBe('paragraph')
    expect(values.get('toolbarRememberPanel')).toBe(false)
  })

  it('keeps explicit current toolbar settings when legacy values also exist', () => {
    const values = new Map<string, boolean | number | string>([
      ['toolbarKeyboard', 'hidden'],
      ['toolbarDisplayMode', 'docked'],
      ['toolbarDefaultTab', 'paragraph'],
      ['toolbarDefaultPanel', 'markdown'],
      ['toolbarRememberTab', false],
      ['toolbarRememberPanel', true],
    ])

    migrateEditorToolbarSettings(
      key => values.has(key),
      (key, defaultValue) => (values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue),
      (key, value) => values.set(key, value),
    )

    expect(values.get('toolbarDisplayMode')).toBe('docked')
    expect(values.get('toolbarDefaultPanel')).toBe('markdown')
    expect(values.get('toolbarRememberPanel')).toBe(true)
  })

  it('initializes custom quick commands from the default quick bar when custom mode has no stored list', () => {
    const values = new Map<string, boolean | number | string>([['toolbarQuickBarMode', 'custom']])

    migrateEditorToolbarSettings(
      key => values.has(key),
      (key, defaultValue) => (values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue),
      (key, value) => values.set(key, value),
    )

    expect(values.get(TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY)).toBe(
      serializeToolbarCustomQuickCommands(DEFAULT_TOOLBAR_CUSTOM_COMMAND_IDS),
    )
  })

  it('builds custom quick commands from valid stored slot values', () => {
    const storedCustomCommands = serializeToolbarCustomQuickCommands([
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
      MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
    ])
    const values = new Map<string, boolean | number | string>([
      ['toolbarQuickBarMode', 'custom'],
      [TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY, storedCustomCommands],
    ])

    const settings = getEditorToolbarSettings((key, defaultValue) =>
      values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue,
    )

    expect(settings.customQuickCommandIds).toEqual([
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
      MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
    ])
    expect(settings.quickCommands.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.EDIT_UNDO,
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
      MOBILE_COMMANDS.PARAGRAPH_TASK_LIST,
    ])
  })

  it('drops empty, unknown, duplicate, and fixed commands from custom slots', () => {
    expect(
      normalizeToolbarCustomQuickCommands(
        [
          MOBILE_COMMANDS.EDIT_UNDO,
          MOBILE_COMMANDS.FORMAT_STRONG,
          MOBILE_COMMANDS.FORMAT_STRONG,
          'missing.command',
          MOBILE_COMMANDS.FORMAT_IMAGE,
        ].join(','),
      ),
    ).toEqual([MOBILE_COMMANDS.FORMAT_STRONG, MOBILE_COMMANDS.FORMAT_IMAGE])
  })

  it('reads legacy five-slot custom command strings as ordered command lists', () => {
    expect(
      normalizeToolbarCustomQuickCommands(
        [
          MOBILE_COMMANDS.FORMAT_STRONG,
          '',
          MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
          '',
          MOBILE_COMMANDS.FORMAT_IMAGE,
        ].join(','),
      ),
    ).toEqual([
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
      MOBILE_COMMANDS.FORMAT_IMAGE,
    ])
  })
})
