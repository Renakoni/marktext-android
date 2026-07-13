import { describe, expect, it } from 'vitest'
import { MOBILE_COMMANDS, type MobileCommandId } from '../../lib/mobileCommands'
import {
  DEFAULT_SELECTION_TOOLBAR_ROWS,
  SELECTION_TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY,
  SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS,
  SELECTION_TOOLBAR_ROWS_STORAGE_KEY,
  getSelectionToolbarSettings,
  normalizeSelectionToolbarCustomCommands,
  normalizeSelectionToolbarRows,
  serializeSelectionToolbarCustomCommands,
} from './selectionToolbarSettings'

describe('selectionToolbarSettings', () => {
  it('normalizes the row layout to single row unless two rows is stored', () => {
    expect(normalizeSelectionToolbarRows('1')).toBe(1)
    expect(normalizeSelectionToolbarRows('2')).toBe(2)
    expect(normalizeSelectionToolbarRows(2)).toBe(2)
    expect(normalizeSelectionToolbarRows('3')).toBe(DEFAULT_SELECTION_TOOLBAR_ROWS)
    expect(normalizeSelectionToolbarRows(undefined)).toBe(DEFAULT_SELECTION_TOOLBAR_ROWS)
  })

  it('keeps only known panel commands, deduplicated and capped', () => {
    const stored = [
      MOBILE_COMMANDS.FORMAT_STRONG,
      'not-a-command',
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.EDIT_UNDO, // edit commands are not part of the pool
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
    ].join(',')

    expect(normalizeSelectionToolbarCustomCommands(stored)).toEqual([
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
    ])
    expect(normalizeSelectionToolbarCustomCommands(42)).toEqual([])
  })

  it('caps the list at the sanity limit in both directions', () => {
    const tooMany = [
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
      MOBILE_COMMANDS.FORMAT_UNDERLINE,
      MOBILE_COMMANDS.FORMAT_STRIKE,
      MOBILE_COMMANDS.FORMAT_HIGHLIGHT,
      MOBILE_COMMANDS.FORMAT_CLEAR,
      MOBILE_COMMANDS.FORMAT_INLINE_CODE,
      MOBILE_COMMANDS.FORMAT_INLINE_MATH,
      MOBILE_COMMANDS.FORMAT_SUPERSCRIPT,
      MOBILE_COMMANDS.FORMAT_SUBSCRIPT,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_1,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_2,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_3,
      MOBILE_COMMANDS.PARAGRAPH_HEADING_4,
    ]

    expect(serializeSelectionToolbarCustomCommands(tooMany).split(',')).toHaveLength(
      SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS,
    )
    expect(
      normalizeSelectionToolbarCustomCommands(tooMany.join(',')),
    ).toHaveLength(SELECTION_TOOLBAR_MAX_CUSTOM_COMMANDS)
  })

  it('round-trips serialize and normalize', () => {
    const ids: MobileCommandId[] = [
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.PARAGRAPH_QUOTE_BLOCK,
    ]

    expect(
      normalizeSelectionToolbarCustomCommands(serializeSelectionToolbarCustomCommands(ids)),
    ).toEqual(ids)
  })

  it('resolves stored settings into command buttons and rows', () => {
    const stored: Record<string, string> = {
      [SELECTION_TOOLBAR_CUSTOM_COMMANDS_STORAGE_KEY]: [
        MOBILE_COMMANDS.FORMAT_STRONG,
        MOBILE_COMMANDS.FORMAT_EMPHASIS,
      ].join(','),
      [SELECTION_TOOLBAR_ROWS_STORAGE_KEY]: '2',
    }
    const settings = getSelectionToolbarSettings(
      <T,>(key: string, defaultValue: T) => (stored[key] as T | undefined) ?? defaultValue,
    )

    expect(settings.rows).toBe(2)
    expect(settings.customCommands.map(command => command.commandId)).toEqual([
      MOBILE_COMMANDS.FORMAT_STRONG,
      MOBILE_COMMANDS.FORMAT_EMPHASIS,
    ])

    const empty = getSelectionToolbarSettings(<T,>(_key: string, defaultValue: T) => defaultValue)
    expect(empty.rows).toBe(1)
    expect(empty.customCommands).toEqual([])
  })
})
