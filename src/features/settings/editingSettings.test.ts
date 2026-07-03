import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDITING_SETTINGS,
  getEditingSettings,
  getMuyaEditingOptions,
  getMuyaEditingRuntimeUpdates,
  resolveCodeFontFamily,
  type EditingSettings,
} from './editingSettings'

describe('editingSettings', () => {
  it('uses the mobile Editing page defaults as runtime defaults', () => {
    const settings = getEditingSettings((_, defaultValue) => defaultValue)

    expect(settings).toEqual(DEFAULT_EDITING_SETTINGS)
    expect(getMuyaEditingOptions(settings)).toMatchObject({
      autoPairBracket: true,
      autoPairMarkdownSyntax: true,
      autoPairQuote: true,
      hideQuickInsertHint: false,
      hideLinkPopup: false,
      autoCheck: false,
      preferLooseListItem: true,
      bulletListMarker: '-',
      orderListDelimiter: '.',
      listIndentation: 1,
      frontmatterType: '-',
      footnote: false,
      superSubScript: false,
      disableHtml: false,
      isGitlabCompatibilityEnabled: false,
      codeBlockLineNumbers: false,
      wrapCodeBlocks: true,
      trimUnnecessaryCodeBlockEmptyLines: true,
      codeFontSize: 14,
      tabSize: 4,
      spellcheckEnabled: false,
      spellcheckHideMarks: false,
    })
  })

  it('normalizes stored values before handing them to Muya', () => {
    const values = new Map<string, boolean | number | string>([
      ['autoPairBracket', false],
      ['bulletListMarker', '+'],
      ['orderListDelimiter', ')'],
      ['listIndentation', 'dfm'],
      ['frontmatterType', '+'],
      ['sequenceTheme', 'simple'],
      ['plantumlServer', ' https://plantuml.example.com/uml '],
      ['codeFontSize', 99],
      ['codeFontFamily', 'system-mono'],
      ['tabSize', '2'],
      ['spellcheckerLanguage', 'zh-CN'],
    ])

    const settings = getEditingSettings((key, defaultValue) =>
      values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue,
    )

    expect(settings).toMatchObject({
      autoPairBracket: false,
      bulletListMarker: '+',
      orderListDelimiter: ')',
      listIndentation: 'dfm',
      frontmatterType: '+',
      sequenceTheme: 'simple',
      plantumlServer: 'https://plantuml.example.com/uml',
      codeFontSize: 28,
      codeFontFamily: 'system-mono',
      tabSize: 2,
      spellcheckerLanguage: 'zh-CN',
    })
    expect(resolveCodeFontFamily(settings.codeFontFamily)).toContain('ui-monospace')
  })

  it('falls back on invalid values instead of sending invalid runtime options', () => {
    const values = new Map<string, boolean | number | string>([
      ['autoPairQuote', 'false'],
      ['bulletListMarker', '~'],
      ['orderListDelimiter', ':'],
      ['listIndentation', 'wide'],
      ['frontmatterType', '='],
      ['sequenceTheme', 'plain'],
      ['plantumlServer', 'javascript:alert(1)'],
      ['codeFontSize', 'large'],
      ['codeFontFamily', 'comic-code'],
      ['tabSize', 'wide'],
      ['spellcheckerLanguage', 'it-IT'],
    ])

    const settings = getEditingSettings((key, defaultValue) =>
      values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue,
    )

    expect(settings).toMatchObject({
      autoPairQuote: true,
      bulletListMarker: '-',
      orderListDelimiter: '.',
      listIndentation: 1,
      frontmatterType: '-',
      sequenceTheme: 'hand',
      plantumlServer: DEFAULT_EDITING_SETTINGS.plantumlServer,
      codeFontSize: 14,
      codeFontFamily: 'dejavu-sans-mono',
      tabSize: 4,
      spellcheckerLanguage: 'en-US',
    })
  })

  it('maps positive UI toggles to Muya inverse options', () => {
    const settings: EditingSettings = {
      ...DEFAULT_EDITING_SETTINGS,
      quickInsert: false,
      linkPopup: false,
      isHtmlEnabled: false,
      spellcheckerUnderline: false,
    }

    expect(getMuyaEditingOptions(settings)).toMatchObject({
      hideQuickInsertHint: true,
      hideLinkPopup: true,
      disableHtml: true,
      spellcheckHideMarks: true,
    })
  })

  it('builds desktop-parity live runtime updates without touching UI-only rows', () => {
    const next: EditingSettings = {
      ...DEFAULT_EDITING_SETTINGS,
      autoPairBracket: false,
      footnote: true,
      codeBlockLineNumbers: true,
      listIndentation: 4,
      sourceCodeModeEnabled: true,
      preferHeadingStyle: 'setext',
      spellcheckerLanguage: 'zh-CN',
    }

    expect(getMuyaEditingRuntimeUpdates(next, DEFAULT_EDITING_SETTINGS)).toEqual([
      {
        kind: 'setOptions',
        options: { autoPairBracket: false },
        forceRender: false,
      },
      {
        kind: 'setListIndentation',
        listIndentation: 4,
      },
      {
        kind: 'setOptions',
        options: { footnote: true, codeBlockLineNumbers: true },
        forceRender: true,
      },
      {
        kind: 'setSpellcheckLanguage',
        language: 'zh-CN',
      },
    ])
  })

  it('does not emit runtime work for unsupported source and heading preference rows', () => {
    const next: EditingSettings = {
      ...DEFAULT_EDITING_SETTINGS,
      sourceCodeModeEnabled: true,
      preferHeadingStyle: 'setext',
    }

    expect(getMuyaEditingRuntimeUpdates(next, DEFAULT_EDITING_SETTINGS)).toEqual([])
  })
})
