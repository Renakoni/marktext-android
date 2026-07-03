import type { SettingsValue } from './settingsState'

export type BulletListMarker = '-' | '*' | '+'
export type OrderListDelimiter = '.' | ')'
export type ListIndentation = 'dfm' | 'tab' | 1 | 2 | 3 | 4
export type FrontmatterType = '-' | '+' | ';' | '{'
export type SequenceTheme = 'hand' | 'simple'
export type PreferHeadingStyle = 'atx' | 'setext'
export type CodeFontFamily = 'dejavu-sans-mono' | 'system-mono' | 'monospace'
export type SpellcheckerLanguage = 'en-US' | 'zh-CN' | 'de-DE' | 'fr-FR'

export type EditingSettingKey =
  | 'autoPairBracket'
  | 'autoPairMarkdownSyntax'
  | 'autoPairQuote'
  | 'quickInsert'
  | 'linkPopup'
  | 'autoCheck'
  | 'sourceCodeModeEnabled'
  | 'preferLooseListItem'
  | 'bulletListMarker'
  | 'orderListDelimiter'
  | 'listIndentation'
  | 'preferHeadingStyle'
  | 'frontmatterType'
  | 'footnote'
  | 'superSubScript'
  | 'isHtmlEnabled'
  | 'isGitlabCompatibilityEnabled'
  | 'sequenceTheme'
  | 'plantumlServer'
  | 'codeBlockLineNumbers'
  | 'wrapCodeBlocks'
  | 'trimUnnecessaryCodeBlockEmptyLines'
  | 'codeFontSize'
  | 'codeFontFamily'
  | 'tabSize'
  | 'spellcheckerEnabled'
  | 'spellcheckerLanguage'
  | 'spellcheckerUnderline'

export interface EditingSettings {
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  autoPairQuote: boolean
  quickInsert: boolean
  linkPopup: boolean
  autoCheck: boolean
  sourceCodeModeEnabled: boolean
  preferLooseListItem: boolean
  bulletListMarker: BulletListMarker
  orderListDelimiter: OrderListDelimiter
  listIndentation: ListIndentation
  preferHeadingStyle: PreferHeadingStyle
  frontmatterType: FrontmatterType
  footnote: boolean
  superSubScript: boolean
  isHtmlEnabled: boolean
  isGitlabCompatibilityEnabled: boolean
  sequenceTheme: SequenceTheme
  plantumlServer: string
  codeBlockLineNumbers: boolean
  wrapCodeBlocks: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  codeFontSize: number
  codeFontFamily: CodeFontFamily
  tabSize: 1 | 2 | 3 | 4
  spellcheckerEnabled: boolean
  spellcheckerLanguage: SpellcheckerLanguage
  spellcheckerUnderline: boolean
}

export type MuyaEditingOptions = Record<string, boolean | number | string>

export type MuyaEditingRuntimeUpdate =
  | {
      kind: 'setOptions'
      options: MuyaEditingOptions
      forceRender: boolean
    }
  | {
      kind: 'setListIndentation'
      listIndentation: ListIndentation
    }
  | {
      kind: 'setSpellcheckLanguage'
      language: SpellcheckerLanguage
    }

export const EDITING_SETTING_KEYS = [
  'autoPairBracket',
  'autoPairMarkdownSyntax',
  'autoPairQuote',
  'quickInsert',
  'linkPopup',
  'autoCheck',
  'sourceCodeModeEnabled',
  'preferLooseListItem',
  'bulletListMarker',
  'orderListDelimiter',
  'listIndentation',
  'preferHeadingStyle',
  'frontmatterType',
  'footnote',
  'superSubScript',
  'isHtmlEnabled',
  'isGitlabCompatibilityEnabled',
  'sequenceTheme',
  'plantumlServer',
  'codeBlockLineNumbers',
  'wrapCodeBlocks',
  'trimUnnecessaryCodeBlockEmptyLines',
  'codeFontSize',
  'codeFontFamily',
  'tabSize',
  'spellcheckerEnabled',
  'spellcheckerLanguage',
  'spellcheckerUnderline',
] as const satisfies readonly EditingSettingKey[]

export const DEFAULT_EDITING_SETTINGS = {
  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  quickInsert: true,
  linkPopup: true,
  autoCheck: false,
  sourceCodeModeEnabled: false,
  preferLooseListItem: true,
  bulletListMarker: '-',
  orderListDelimiter: '.',
  listIndentation: 1,
  preferHeadingStyle: 'atx',
  frontmatterType: '-',
  footnote: false,
  superSubScript: false,
  isHtmlEnabled: true,
  isGitlabCompatibilityEnabled: false,
  sequenceTheme: 'hand',
  plantumlServer: 'https://www.plantuml.com/plantuml',
  codeBlockLineNumbers: false,
  wrapCodeBlocks: true,
  trimUnnecessaryCodeBlockEmptyLines: true,
  codeFontSize: 14,
  codeFontFamily: 'dejavu-sans-mono',
  tabSize: 4,
  spellcheckerEnabled: false,
  spellcheckerLanguage: 'en-US',
  spellcheckerUnderline: true,
} as const satisfies EditingSettings

const BULLET_LIST_MARKERS = new Set<BulletListMarker>(['-', '*', '+'])
const ORDER_LIST_DELIMITERS = new Set<OrderListDelimiter>(['.', ')'])
const FRONTMATTER_TYPES = new Set<FrontmatterType>(['-', '+', ';', '{'])
const SEQUENCE_THEMES = new Set<SequenceTheme>(['hand', 'simple'])
const HEADING_STYLES = new Set<PreferHeadingStyle>(['atx', 'setext'])
const CODE_FONT_FAMILIES = new Set<CodeFontFamily>([
  'dejavu-sans-mono',
  'system-mono',
  'monospace',
])
const SPELLCHECKER_LANGUAGES = new Set<SpellcheckerLanguage>([
  'en-US',
  'zh-CN',
  'de-DE',
  'fr-FR',
])

const DEJAVU_MONO_STACK =
  '"DejaVu Sans Mono", "Source Code Pro", "Droid Sans Mono", Consolas, monospace'
const SYSTEM_MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
const MONOSPACE_STACK = 'monospace'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeChoice<T extends string>(value: unknown, options: Set<T>, fallback: T): T {
  return options.has(value as T) ? (value as T) : fallback
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number) {
  return Math.round(clamp(normalizeNumber(value, fallback), min, max))
}

function normalizeTabSize(value: unknown): EditingSettings['tabSize'] {
  const tabSize = normalizeInteger(value, DEFAULT_EDITING_SETTINGS.tabSize, 1, 4)
  return tabSize as EditingSettings['tabSize']
}

function normalizeListIndentation(value: unknown): ListIndentation {
  if (value === 'dfm' || value === 'tab') {
    return value
  }

  const indentation = normalizeInteger(value, DEFAULT_EDITING_SETTINGS.listIndentation, 1, 4)
  return indentation as ListIndentation
}

function normalizePlantumlServer(value: unknown) {
  if (typeof value !== 'string') {
    return DEFAULT_EDITING_SETTINGS.plantumlServer
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return DEFAULT_EDITING_SETTINGS.plantumlServer
  }

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? trimmed
      : DEFAULT_EDITING_SETTINGS.plantumlServer
  } catch {
    return DEFAULT_EDITING_SETTINGS.plantumlServer
  }
}

export function normalizeCodeFontSize(value: unknown) {
  return normalizeInteger(value, DEFAULT_EDITING_SETTINGS.codeFontSize, 12, 28)
}

export function normalizeCodeFontFamily(value: unknown): CodeFontFamily {
  return normalizeChoice(value, CODE_FONT_FAMILIES, DEFAULT_EDITING_SETTINGS.codeFontFamily)
}

export function resolveCodeFontFamily(fontFamily: CodeFontFamily) {
  switch (fontFamily) {
    case 'system-mono':
      return SYSTEM_MONO_STACK
    case 'monospace':
      return `${MONOSPACE_STACK}, ${DEJAVU_MONO_STACK}`
    case 'dejavu-sans-mono':
      return DEJAVU_MONO_STACK
  }
}

export function normalizeEditingSettingValue(key: EditingSettingKey, value: SettingsValue) {
  switch (key) {
    case 'autoPairBracket':
    case 'autoPairMarkdownSyntax':
    case 'autoPairQuote':
    case 'quickInsert':
    case 'linkPopup':
    case 'autoCheck':
    case 'sourceCodeModeEnabled':
    case 'preferLooseListItem':
    case 'footnote':
    case 'superSubScript':
    case 'isHtmlEnabled':
    case 'isGitlabCompatibilityEnabled':
    case 'codeBlockLineNumbers':
    case 'wrapCodeBlocks':
    case 'trimUnnecessaryCodeBlockEmptyLines':
    case 'spellcheckerEnabled':
    case 'spellcheckerUnderline':
      return normalizeBoolean(value, DEFAULT_EDITING_SETTINGS[key])
    case 'bulletListMarker':
      return normalizeChoice(value, BULLET_LIST_MARKERS, DEFAULT_EDITING_SETTINGS.bulletListMarker)
    case 'orderListDelimiter':
      return normalizeChoice(
        value,
        ORDER_LIST_DELIMITERS,
        DEFAULT_EDITING_SETTINGS.orderListDelimiter,
      )
    case 'listIndentation':
      return normalizeListIndentation(value)
    case 'preferHeadingStyle':
      return normalizeChoice(value, HEADING_STYLES, DEFAULT_EDITING_SETTINGS.preferHeadingStyle)
    case 'frontmatterType':
      return normalizeChoice(value, FRONTMATTER_TYPES, DEFAULT_EDITING_SETTINGS.frontmatterType)
    case 'sequenceTheme':
      return normalizeChoice(value, SEQUENCE_THEMES, DEFAULT_EDITING_SETTINGS.sequenceTheme)
    case 'plantumlServer':
      return normalizePlantumlServer(value)
    case 'codeFontSize':
      return normalizeCodeFontSize(value)
    case 'codeFontFamily':
      return normalizeCodeFontFamily(value)
    case 'tabSize':
      return normalizeTabSize(value)
    case 'spellcheckerLanguage':
      return normalizeChoice(
        value,
        SPELLCHECKER_LANGUAGES,
        DEFAULT_EDITING_SETTINGS.spellcheckerLanguage,
      )
  }
}

export function getEditingSettings(
  getValue: <T extends SettingsValue>(key: string, defaultValue: T) => T,
): EditingSettings {
  return {
    autoPairBracket: normalizeBoolean(
      getValue('autoPairBracket', DEFAULT_EDITING_SETTINGS.autoPairBracket),
      DEFAULT_EDITING_SETTINGS.autoPairBracket,
    ),
    autoPairMarkdownSyntax: normalizeBoolean(
      getValue(
        'autoPairMarkdownSyntax',
        DEFAULT_EDITING_SETTINGS.autoPairMarkdownSyntax,
      ),
      DEFAULT_EDITING_SETTINGS.autoPairMarkdownSyntax,
    ),
    autoPairQuote: normalizeBoolean(
      getValue('autoPairQuote', DEFAULT_EDITING_SETTINGS.autoPairQuote),
      DEFAULT_EDITING_SETTINGS.autoPairQuote,
    ),
    quickInsert: normalizeBoolean(
      getValue('quickInsert', DEFAULT_EDITING_SETTINGS.quickInsert),
      DEFAULT_EDITING_SETTINGS.quickInsert,
    ),
    linkPopup: normalizeBoolean(
      getValue('linkPopup', DEFAULT_EDITING_SETTINGS.linkPopup),
      DEFAULT_EDITING_SETTINGS.linkPopup,
    ),
    autoCheck: normalizeBoolean(
      getValue('autoCheck', DEFAULT_EDITING_SETTINGS.autoCheck),
      DEFAULT_EDITING_SETTINGS.autoCheck,
    ),
    sourceCodeModeEnabled: normalizeBoolean(
      getValue('sourceCodeModeEnabled', DEFAULT_EDITING_SETTINGS.sourceCodeModeEnabled),
      DEFAULT_EDITING_SETTINGS.sourceCodeModeEnabled,
    ),
    preferLooseListItem: normalizeBoolean(
      getValue('preferLooseListItem', DEFAULT_EDITING_SETTINGS.preferLooseListItem),
      DEFAULT_EDITING_SETTINGS.preferLooseListItem,
    ),
    bulletListMarker: normalizeChoice(
      getValue('bulletListMarker', DEFAULT_EDITING_SETTINGS.bulletListMarker),
      BULLET_LIST_MARKERS,
      DEFAULT_EDITING_SETTINGS.bulletListMarker,
    ),
    orderListDelimiter: normalizeChoice(
      getValue('orderListDelimiter', DEFAULT_EDITING_SETTINGS.orderListDelimiter),
      ORDER_LIST_DELIMITERS,
      DEFAULT_EDITING_SETTINGS.orderListDelimiter,
    ),
    listIndentation: normalizeListIndentation(
      getValue('listIndentation', String(DEFAULT_EDITING_SETTINGS.listIndentation)),
    ),
    preferHeadingStyle: normalizeChoice(
      getValue('preferHeadingStyle', DEFAULT_EDITING_SETTINGS.preferHeadingStyle),
      HEADING_STYLES,
      DEFAULT_EDITING_SETTINGS.preferHeadingStyle,
    ),
    frontmatterType: normalizeChoice(
      getValue('frontmatterType', DEFAULT_EDITING_SETTINGS.frontmatterType),
      FRONTMATTER_TYPES,
      DEFAULT_EDITING_SETTINGS.frontmatterType,
    ),
    footnote: normalizeBoolean(
      getValue('footnote', DEFAULT_EDITING_SETTINGS.footnote),
      DEFAULT_EDITING_SETTINGS.footnote,
    ),
    superSubScript: normalizeBoolean(
      getValue('superSubScript', DEFAULT_EDITING_SETTINGS.superSubScript),
      DEFAULT_EDITING_SETTINGS.superSubScript,
    ),
    isHtmlEnabled: normalizeBoolean(
      getValue('isHtmlEnabled', DEFAULT_EDITING_SETTINGS.isHtmlEnabled),
      DEFAULT_EDITING_SETTINGS.isHtmlEnabled,
    ),
    isGitlabCompatibilityEnabled: normalizeBoolean(
      getValue(
        'isGitlabCompatibilityEnabled',
        DEFAULT_EDITING_SETTINGS.isGitlabCompatibilityEnabled,
      ),
      DEFAULT_EDITING_SETTINGS.isGitlabCompatibilityEnabled,
    ),
    sequenceTheme: normalizeChoice(
      getValue('sequenceTheme', DEFAULT_EDITING_SETTINGS.sequenceTheme),
      SEQUENCE_THEMES,
      DEFAULT_EDITING_SETTINGS.sequenceTheme,
    ),
    plantumlServer: normalizePlantumlServer(
      getValue('plantumlServer', DEFAULT_EDITING_SETTINGS.plantumlServer),
    ),
    codeBlockLineNumbers: normalizeBoolean(
      getValue('codeBlockLineNumbers', DEFAULT_EDITING_SETTINGS.codeBlockLineNumbers),
      DEFAULT_EDITING_SETTINGS.codeBlockLineNumbers,
    ),
    wrapCodeBlocks: normalizeBoolean(
      getValue('wrapCodeBlocks', DEFAULT_EDITING_SETTINGS.wrapCodeBlocks),
      DEFAULT_EDITING_SETTINGS.wrapCodeBlocks,
    ),
    trimUnnecessaryCodeBlockEmptyLines: normalizeBoolean(
      getValue(
        'trimUnnecessaryCodeBlockEmptyLines',
        DEFAULT_EDITING_SETTINGS.trimUnnecessaryCodeBlockEmptyLines,
      ),
      DEFAULT_EDITING_SETTINGS.trimUnnecessaryCodeBlockEmptyLines,
    ),
    codeFontSize: normalizeCodeFontSize(
      getValue('codeFontSize', DEFAULT_EDITING_SETTINGS.codeFontSize),
    ),
    codeFontFamily: normalizeCodeFontFamily(
      getValue('codeFontFamily', DEFAULT_EDITING_SETTINGS.codeFontFamily),
    ),
    tabSize: normalizeTabSize(getValue('tabSize', String(DEFAULT_EDITING_SETTINGS.tabSize))),
    spellcheckerEnabled: normalizeBoolean(
      getValue('spellcheckerEnabled', DEFAULT_EDITING_SETTINGS.spellcheckerEnabled),
      DEFAULT_EDITING_SETTINGS.spellcheckerEnabled,
    ),
    spellcheckerLanguage: normalizeChoice(
      getValue('spellcheckerLanguage', DEFAULT_EDITING_SETTINGS.spellcheckerLanguage),
      SPELLCHECKER_LANGUAGES,
      DEFAULT_EDITING_SETTINGS.spellcheckerLanguage,
    ),
    spellcheckerUnderline: normalizeBoolean(
      getValue('spellcheckerUnderline', DEFAULT_EDITING_SETTINGS.spellcheckerUnderline),
      DEFAULT_EDITING_SETTINGS.spellcheckerUnderline,
    ),
  }
}

export function getMuyaEditingOptions(settings: EditingSettings): MuyaEditingOptions {
  return {
    preferLooseListItem: settings.preferLooseListItem,
    autoPairBracket: settings.autoPairBracket,
    autoPairMarkdownSyntax: settings.autoPairMarkdownSyntax,
    trimUnnecessaryCodeBlockEmptyLines: settings.trimUnnecessaryCodeBlockEmptyLines,
    autoPairQuote: settings.autoPairQuote,
    bulletListMarker: settings.bulletListMarker,
    orderListDelimiter: settings.orderListDelimiter,
    tabSize: settings.tabSize,
    codeFontSize: settings.codeFontSize,
    codeFontFamily: resolveCodeFontFamily(settings.codeFontFamily),
    wrapCodeBlocks: settings.wrapCodeBlocks,
    codeBlockLineNumbers: settings.codeBlockLineNumbers,
    listIndentation: settings.listIndentation,
    frontmatterType: settings.frontmatterType,
    superSubScript: settings.superSubScript,
    footnote: settings.footnote,
    disableHtml: !settings.isHtmlEnabled,
    isGitlabCompatibilityEnabled: settings.isGitlabCompatibilityEnabled,
    hideQuickInsertHint: !settings.quickInsert,
    hideLinkPopup: !settings.linkPopup,
    autoCheck: settings.autoCheck,
    sequenceTheme: settings.sequenceTheme,
    plantumlServer: settings.plantumlServer,
    spellcheckEnabled: settings.spellcheckerEnabled,
    spellcheckHideMarks: !settings.spellcheckerUnderline,
  }
}

export function getMuyaEditingRuntimeUpdates(
  next: EditingSettings,
  previous?: EditingSettings,
): MuyaEditingRuntimeUpdate[] {
  if (!previous) {
    return [
      {
        kind: 'setOptions',
        options: getMuyaEditingOptions(next),
        forceRender: true,
      },
      { kind: 'setSpellcheckLanguage', language: next.spellcheckerLanguage },
    ]
  }

  const noRenderOptions: MuyaEditingOptions = {}
  const forceRenderOptions: MuyaEditingOptions = {}
  const updates: MuyaEditingRuntimeUpdate[] = []

  function setOption(
    settingChanged: boolean,
    optionName: string,
    value: boolean | number | string,
    forceRender = false,
  ) {
    if (!settingChanged) {
      return
    }

    const target = forceRender ? forceRenderOptions : noRenderOptions
    target[optionName] = value
  }

  setOption(
    next.autoPairBracket !== previous.autoPairBracket,
    'autoPairBracket',
    next.autoPairBracket,
  )
  setOption(
    next.autoPairMarkdownSyntax !== previous.autoPairMarkdownSyntax,
    'autoPairMarkdownSyntax',
    next.autoPairMarkdownSyntax,
  )
  setOption(next.autoPairQuote !== previous.autoPairQuote, 'autoPairQuote', next.autoPairQuote)
  setOption(next.quickInsert !== previous.quickInsert, 'hideQuickInsertHint', !next.quickInsert)
  setOption(next.linkPopup !== previous.linkPopup, 'hideLinkPopup', !next.linkPopup)
  setOption(next.autoCheck !== previous.autoCheck, 'autoCheck', next.autoCheck)
  setOption(
    next.preferLooseListItem !== previous.preferLooseListItem,
    'preferLooseListItem',
    next.preferLooseListItem,
  )
  setOption(
    next.bulletListMarker !== previous.bulletListMarker,
    'bulletListMarker',
    next.bulletListMarker,
  )
  setOption(
    next.orderListDelimiter !== previous.orderListDelimiter,
    'orderListDelimiter',
    next.orderListDelimiter,
  )
  setOption(next.frontmatterType !== previous.frontmatterType, 'frontmatterType', next.frontmatterType)
  setOption(
    next.wrapCodeBlocks !== previous.wrapCodeBlocks,
    'wrapCodeBlocks',
    next.wrapCodeBlocks,
  )
  setOption(
    next.trimUnnecessaryCodeBlockEmptyLines !== previous.trimUnnecessaryCodeBlockEmptyLines,
    'trimUnnecessaryCodeBlockEmptyLines',
    next.trimUnnecessaryCodeBlockEmptyLines,
  )
  setOption(next.codeFontSize !== previous.codeFontSize, 'codeFontSize', next.codeFontSize)
  setOption(
    next.codeFontFamily !== previous.codeFontFamily,
    'codeFontFamily',
    resolveCodeFontFamily(next.codeFontFamily),
  )
  setOption(next.tabSize !== previous.tabSize, 'tabSize', next.tabSize)
  setOption(
    next.spellcheckerEnabled !== previous.spellcheckerEnabled,
    'spellcheckEnabled',
    next.spellcheckerEnabled,
  )
  setOption(
    next.spellcheckerUnderline !== previous.spellcheckerUnderline,
    'spellcheckHideMarks',
    !next.spellcheckerUnderline,
  )

  setOption(next.footnote !== previous.footnote, 'footnote', next.footnote, true)
  setOption(
    next.superSubScript !== previous.superSubScript,
    'superSubScript',
    next.superSubScript,
    true,
  )
  setOption(
    next.isHtmlEnabled !== previous.isHtmlEnabled,
    'disableHtml',
    !next.isHtmlEnabled,
    true,
  )
  setOption(
    next.isGitlabCompatibilityEnabled !== previous.isGitlabCompatibilityEnabled,
    'isGitlabCompatibilityEnabled',
    next.isGitlabCompatibilityEnabled,
    true,
  )
  setOption(next.sequenceTheme !== previous.sequenceTheme, 'sequenceTheme', next.sequenceTheme, true)
  setOption(
    next.plantumlServer !== previous.plantumlServer,
    'plantumlServer',
    next.plantumlServer,
    true,
  )
  setOption(
    next.codeBlockLineNumbers !== previous.codeBlockLineNumbers,
    'codeBlockLineNumbers',
    next.codeBlockLineNumbers,
    true,
  )

  if (Object.keys(noRenderOptions).length > 0) {
    updates.push({ kind: 'setOptions', options: noRenderOptions, forceRender: false })
  }

  if (next.listIndentation !== previous.listIndentation) {
    updates.push({ kind: 'setListIndentation', listIndentation: next.listIndentation })
  }

  if (Object.keys(forceRenderOptions).length > 0) {
    updates.push({ kind: 'setOptions', options: forceRenderOptions, forceRender: true })
  }

  if (next.spellcheckerLanguage !== previous.spellcheckerLanguage) {
    updates.push({ kind: 'setSpellcheckLanguage', language: next.spellcheckerLanguage })
  }

  return updates
}
