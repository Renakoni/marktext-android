import { describe, expect, it } from 'vitest'
import {
  ADVANCED_MAINTENANCE_ACTION_IDS,
  ADVANCED_SETTING_KEYS,
  DEFAULT_ADVANCED_SETTINGS,
} from './advancedSettings'
import {
  APPEARANCE_CUSTOM_THEME_IDS,
  APPEARANCE_FIXED_THEME_IDS,
  APPEARANCE_SETTING_KEYS,
  DEFAULT_APPEARANCE_THEME_SETTINGS,
  DEFAULT_APPEARANCE_TEXT_SETTINGS,
} from './appearanceSettings'
import {
  SETTINGS_DETAIL_SECTIONS,
  type SettingsDetailRow,
} from './settingsContent'
import { EDITING_SETTING_KEYS, DEFAULT_EDITING_SETTINGS } from './editingSettings'
import { DOCUMENT_SETTING_KEYS, DEFAULT_DOCUMENT_SETTINGS } from '../document-session/documentSettings'
import {
  IMAGE_SHARING_SETTING_KEYS,
  DEFAULT_IMAGE_SHARING_SETTINGS,
} from '../android-documents/imageSharingSettings'
import {
  DEFAULT_EDITOR_TOOLBAR_SETTINGS,
  EDITOR_TOOLBAR_SETTING_KEYS,
} from '../editor/editorToolbarSettings'
import {
  DEFAULT_SELECTION_TOOLBAR_ROWS,
  SELECTION_TOOLBAR_SETTING_KEYS,
} from '../editor/selectionToolbarSettings'
import type { SettingsValue } from './settingsState'

type SettingsRowWithLocation = SettingsDetailRow & {
  page: string
  sectionTitleKey: string
}

type SettingsValueRow = Extract<
  SettingsDetailRow,
  { kind: 'toggle' | 'choice' | 'slider' | 'text' | 'customToolbar' | 'customSelectionToolbar' }
>
type SettingsDefaultValueRow = Exclude<
  SettingsValueRow,
  { kind: 'customToolbar' | 'customSelectionToolbar' }
>

const EXPECTED_STORED_ONLY_ROW_IDS = new Set([
  'sourceCodeModeEnabled',
  'preferHeadingStyle',
])

const EXPECTED_UNFINISHED_ROW_IDS = new Set([
  'shareLinkedImages',
  'customWords',
  'addWord',
  'removeWord',
])

const EXPECTED_DERIVED_ROW_IDS = new Set([
  'deviceInfo',
  'importedImageStorage',
  'webviewInfo',
])

const OWNED_STORED_SETTING_KEYS = new Set<string>([
  ...APPEARANCE_SETTING_KEYS,
  ...EDITING_SETTING_KEYS,
  ...EDITOR_TOOLBAR_SETTING_KEYS,
  ...SELECTION_TOOLBAR_SETTING_KEYS,
  ...DOCUMENT_SETTING_KEYS,
  ...IMAGE_SHARING_SETTING_KEYS,
  ...ADVANCED_SETTING_KEYS,
])

const RUNTIME_SETTING_DEFAULTS = new Map<string, SettingsValue>([
  ['themeMode', DEFAULT_APPEARANCE_THEME_SETTINGS.themeMode],
  ['customTheme', DEFAULT_APPEARANCE_THEME_SETTINGS.customTheme],

  ['fontSize', DEFAULT_APPEARANCE_TEXT_SETTINGS.fontSize],
  ['lineHeight', DEFAULT_APPEARANCE_TEXT_SETTINGS.lineHeight],
  ['editorLineWidth', DEFAULT_APPEARANCE_TEXT_SETTINGS.editorLineWidth],
  ['editorFontFamily', DEFAULT_APPEARANCE_TEXT_SETTINGS.editorFontFamily],
  ['textDirection', DEFAULT_APPEARANCE_TEXT_SETTINGS.textDirection],

  ['autoPairBracket', DEFAULT_EDITING_SETTINGS.autoPairBracket],
  ['autoPairMarkdownSyntax', DEFAULT_EDITING_SETTINGS.autoPairMarkdownSyntax],
  ['autoPairQuote', DEFAULT_EDITING_SETTINGS.autoPairQuote],
  ['quickInsert', DEFAULT_EDITING_SETTINGS.quickInsert],
  ['linkPopup', DEFAULT_EDITING_SETTINGS.linkPopup],
  ['autoCheck', DEFAULT_EDITING_SETTINGS.autoCheck],
  ['preferLooseListItem', DEFAULT_EDITING_SETTINGS.preferLooseListItem],
  ['bulletListMarker', DEFAULT_EDITING_SETTINGS.bulletListMarker],
  ['orderListDelimiter', DEFAULT_EDITING_SETTINGS.orderListDelimiter],
  ['listIndentation', String(DEFAULT_EDITING_SETTINGS.listIndentation)],
  ['frontmatterType', DEFAULT_EDITING_SETTINGS.frontmatterType],
  ['footnote', DEFAULT_EDITING_SETTINGS.footnote],
  ['superSubScript', DEFAULT_EDITING_SETTINGS.superSubScript],
  ['isHtmlEnabled', DEFAULT_EDITING_SETTINGS.isHtmlEnabled],
  ['isGitlabCompatibilityEnabled', DEFAULT_EDITING_SETTINGS.isGitlabCompatibilityEnabled],
  ['sequenceTheme', DEFAULT_EDITING_SETTINGS.sequenceTheme],
  ['plantumlServer', DEFAULT_EDITING_SETTINGS.plantumlServer],
  ['codeBlockLineNumbers', DEFAULT_EDITING_SETTINGS.codeBlockLineNumbers],
  ['wrapCodeBlocks', DEFAULT_EDITING_SETTINGS.wrapCodeBlocks],
  [
    'trimUnnecessaryCodeBlockEmptyLines',
    DEFAULT_EDITING_SETTINGS.trimUnnecessaryCodeBlockEmptyLines,
  ],
  ['codeFontSize', DEFAULT_EDITING_SETTINGS.codeFontSize],
  ['codeFontFamily', DEFAULT_EDITING_SETTINGS.codeFontFamily],
  ['tabSize', String(DEFAULT_EDITING_SETTINGS.tabSize)],
  ['spellcheckerEnabled', DEFAULT_EDITING_SETTINGS.spellcheckerEnabled],
  ['spellcheckerLanguage', DEFAULT_EDITING_SETTINGS.spellcheckerLanguage],
  ['spellcheckerUnderline', DEFAULT_EDITING_SETTINGS.spellcheckerUnderline],

  ['toolbarDisplayMode', DEFAULT_EDITOR_TOOLBAR_SETTINGS.displayMode],
  ['toolbarDefaultPanel', DEFAULT_EDITOR_TOOLBAR_SETTINGS.defaultPanel],
  ['toolbarRememberPanel', DEFAULT_EDITOR_TOOLBAR_SETTINGS.rememberPanel],
  ['toolbarCompact', DEFAULT_EDITOR_TOOLBAR_SETTINGS.compact],
  ['toolbarQuickBarMode', DEFAULT_EDITOR_TOOLBAR_SETTINGS.quickBarMode],

  ['selectionToolbarRows', String(DEFAULT_SELECTION_TOOLBAR_ROWS)],

  ['localDrafts', DEFAULT_DOCUMENT_SETTINGS.localDrafts],
  ['recoveryDrafts', DEFAULT_DOCUMENT_SETTINGS.recoveryDrafts],
  ['autoSave', DEFAULT_DOCUMENT_SETTINGS.autoSave],
  ['autoSaveDelay', DEFAULT_DOCUMENT_SETTINGS.autoSaveDelaySeconds],
  ['startUpAction', DEFAULT_DOCUMENT_SETTINGS.startUpAction],
  ['fileSortBy', DEFAULT_DOCUMENT_SETTINGS.fileSortBy],
  ['fileSortOrder', DEFAULT_DOCUMENT_SETTINGS.fileSortOrder],

  ['imageCopyImages', DEFAULT_IMAGE_SHARING_SETTINGS.imageCopyImages],
  ['shareImages', DEFAULT_IMAGE_SHARING_SETTINGS.shareImages],

  ['defaultEncoding', DEFAULT_ADVANCED_SETTINGS.defaultEncoding],
  ['autoGuessEncoding', DEFAULT_ADVANCED_SETTINGS.autoGuessEncoding],
  ['endOfLine', DEFAULT_ADVANCED_SETTINGS.endOfLine],
  ['trimTrailingNewline', String(DEFAULT_ADVANCED_SETTINGS.trimTrailingNewline)],
  ['selectionInputDiagnostics', DEFAULT_ADVANCED_SETTINGS.selectionInputDiagnostics],
])

const STORED_ONLY_SETTING_DEFAULTS = new Map<string, SettingsValue>([
  ['sourceCodeModeEnabled', DEFAULT_EDITING_SETTINGS.sourceCodeModeEnabled],
  ['preferHeadingStyle', DEFAULT_EDITING_SETTINGS.preferHeadingStyle],
])

function getRows(): SettingsRowWithLocation[] {
  return Object.entries(SETTINGS_DETAIL_SECTIONS).flatMap(([page, sections]) =>
    (sections ?? []).flatMap(section =>
      section.rows.map(row => ({
        ...row,
        page,
        sectionTitleKey: section.titleKey,
      })),
    ),
  )
}

function getStoredRows(rows: SettingsDetailRow[]): SettingsValueRow[] {
  return rows.filter((row): row is SettingsValueRow =>
    row.kind === 'toggle' ||
    row.kind === 'choice' ||
    row.kind === 'slider' ||
    row.kind === 'text' ||
    row.kind === 'customToolbar',
  )
}

function hasDefaultValue(row: SettingsValueRow): row is SettingsDefaultValueRow {
  return row.kind !== 'customToolbar'
}

function duplicates(values: readonly string[]) {
  const seen = new Set<string>()
  const repeated = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value)
    }
    seen.add(value)
  }

  return [...repeated].sort()
}

describe('settings content governance', () => {
  it('keeps row ids and test ids globally unique across rendered settings pages', () => {
    const rows = getRows()

    expect(duplicates(rows.map(row => row.id))).toEqual([])
    expect(duplicates(rows.map(row => row.testId))).toEqual([])
  })

  it('keeps every setting-backed row owned by a feature settings module', () => {
    const storedRows = getStoredRows(getRows())

    expect(storedRows.map(row => row.id).filter(id => !OWNED_STORED_SETTING_KEYS.has(id)))
      .toEqual([])
  })

  it('keeps runtime descriptor defaults aligned with feature defaults', () => {
    const runtimeRows = getStoredRows(getRows()).filter(
      (row): row is SettingsDefaultValueRow =>
        row.implementation === 'runtime' && hasDefaultValue(row),
    )

    expect(runtimeRows.map(row => row.id).filter(id => !RUNTIME_SETTING_DEFAULTS.has(id)))
      .toEqual([])

    for (const row of runtimeRows) {
      expect(row.defaultValue, row.id).toBe(RUNTIME_SETTING_DEFAULTS.get(row.id))
    }
  })

  it('keeps stored-only and unfinished rows explicit', () => {
    const rows = getRows()

    expect(rows.filter(row => row.implementation === 'storedOnly').map(row => row.id).sort())
      .toEqual([...EXPECTED_STORED_ONLY_ROW_IDS].sort())
    expect(rows.filter(row => row.implementation === 'unfinished').map(row => row.id).sort())
      .toEqual([...EXPECTED_UNFINISHED_ROW_IDS].sort())
  })

  it('keeps stored-only descriptor defaults aligned with feature defaults', () => {
    const storedOnlyRows = getStoredRows(getRows()).filter(
      (row): row is SettingsDefaultValueRow =>
        row.implementation === 'storedOnly' && hasDefaultValue(row),
    )

    expect(storedOnlyRows.map(row => row.id).filter(id => !STORED_ONLY_SETTING_DEFAULTS.has(id)))
      .toEqual([])

    for (const row of storedOnlyRows) {
      expect(row.defaultValue, row.id).toBe(STORED_ONLY_SETTING_DEFAULTS.get(row.id))
    }
  })

  it('keeps derived rows explicit and display-only', () => {
    const derivedRows = getRows().filter(row => row.implementation === 'derived')

    expect(derivedRows.map(row => row.id).sort()).toEqual([...EXPECTED_DERIVED_ROW_IDS].sort())
    expect(derivedRows.map(row => row.kind)).toEqual(['status', 'status', 'status'])
  })

  it('keeps choice defaults valid and option ids unique', () => {
    const choiceRows = getRows().filter(row => row.kind === 'choice')

    for (const row of choiceRows) {
      const optionIds = row.options.map(option => option.id)

      expect(optionIds, row.id).toContain(row.defaultValue)
      expect(duplicates(optionIds), row.id).toEqual([])
    }
  })

  it('keeps the curated mobile theme surface small and explicit', () => {
    const themeModeRow = getRows().find(row => row.id === 'themeMode')
    const customThemeRow = getRows().find(row => row.id === 'customTheme')

    expect(APPEARANCE_FIXED_THEME_IDS).toEqual({
      light: 'graphite',
      dark: 'dark',
    })
    expect(themeModeRow?.kind).toBe('choice')
    expect(themeModeRow?.kind === 'choice' ? themeModeRow.options.map(option => option.id) : [])
      .toEqual(['system', 'light', 'dark', 'custom'])
    expect(customThemeRow?.kind).toBe('choice')
    expect(customThemeRow?.kind === 'choice' ? customThemeRow.options.map(option => option.id) : [])
      .toEqual([...APPEARANCE_CUSTOM_THEME_IDS])
  })

  it('keeps slider defaults inside their declared range and step', () => {
    const sliderRows = getRows().filter(row => row.kind === 'slider')

    for (const row of sliderRows) {
      const offset = (row.defaultValue - row.min) / row.step

      expect(row.defaultValue, row.id).toBeGreaterThanOrEqual(row.min)
      expect(row.defaultValue, row.id).toBeLessThanOrEqual(row.max)
      expect(Math.abs(offset - Math.round(offset)), row.id).toBeLessThan(1e-8)
    }
  })

  it('keeps runtime action rows mapped to concrete handlers', () => {
    const runtimeActionIds = getRows()
      .filter(row => row.kind === 'action' && row.implementation === 'runtime')
      .map(row => row.id)
      .sort()

    expect(runtimeActionIds).toEqual([...ADVANCED_MAINTENANCE_ACTION_IDS].sort())
    expect(runtimeActionIds).toContain('cleanImportedImages')
  })
})
