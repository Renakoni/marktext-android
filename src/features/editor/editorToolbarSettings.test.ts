import { describe, expect, it } from 'vitest'
import { MOBILE_COMMANDS } from '../../lib/mobileCommands'
import { MOBILE_TOOLBAR_QUICK_COMMANDS } from '../../lib/mobileToolbarConfig'
import {
  TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY,
  getEditorToolbarSettings,
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

  it('drops empty custom command entries from stored command lists', () => {
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
