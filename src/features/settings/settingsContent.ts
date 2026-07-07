import type { I18nKey } from '../../lib/i18n'
import { SETTINGS_PAGES, type SettingsPage } from './settingsNavigation'

interface SettingsOption {
  id: string
  labelKey: I18nKey
}

interface SettingsBaseRow {
  id: string
  implementation: SettingsRowImplementation
  labelKey: I18nKey
  testId: string
}

export type SettingsRowImplementation = 'runtime' | 'storedOnly' | 'derived' | 'unfinished'

export interface SettingsToggleRow extends SettingsBaseRow {
  kind: 'toggle'
  defaultValue: boolean
}

export interface SettingsChoiceRow extends SettingsBaseRow {
  kind: 'choice'
  defaultValue: string
  options: readonly SettingsOption[]
  display?: 'segmented' | 'select'
}

export interface SettingsSliderRow extends SettingsBaseRow {
  kind: 'slider'
  defaultValue: number
  min: number
  max: number
  step: number
  unitKey?: I18nKey
}

export interface SettingsTextRow extends SettingsBaseRow {
  kind: 'text'
  defaultValue: string
  placeholderKey?: I18nKey
  multiline?: boolean
}

export interface SettingsActionRow extends SettingsBaseRow {
  kind: 'action'
  valueKey?: I18nKey
}

export interface SettingsStatusRow extends SettingsBaseRow {
  kind: 'status'
  valueKey: I18nKey
}

export interface SettingsCustomToolbarRow extends SettingsBaseRow {
  kind: 'customToolbar'
}

export type SettingsDetailRow =
  | SettingsToggleRow
  | SettingsChoiceRow
  | SettingsSliderRow
  | SettingsTextRow
  | SettingsActionRow
  | SettingsStatusRow
  | SettingsCustomToolbarRow

export interface SettingsDetailSection {
  titleKey: I18nKey
  rows: readonly SettingsDetailRow[]
}

// Settings descriptors define the mobile settings UI. Individual settings are
// wired only where a feature module explicitly consumes their stored values.
export const SETTINGS_PAGE_TITLE_KEYS = {
  [SETTINGS_PAGES.INDEX]: 'settings.title',
  [SETTINGS_PAGES.APPEARANCE]: 'settings.appearance',
  [SETTINGS_PAGES.EDITING]: 'settings.editing',
  [SETTINGS_PAGES.TOOLBAR]: 'settings.section.mobileToolbar',
  [SETTINGS_PAGES.CODE]: 'settings.code',
  [SETTINGS_PAGES.MARKDOWN]: 'settings.markdown',
  [SETTINGS_PAGES.DOCUMENTS]: 'settings.documents',
  [SETTINGS_PAGES.IMAGES_SHARING]: 'settings.imagesSharing',
  [SETTINGS_PAGES.SPELLING]: 'settings.spelling',
  [SETTINGS_PAGES.ADVANCED]: 'settings.advanced',
  [SETTINGS_PAGES.ABOUT]: 'settings.about',
} as const satisfies Record<SettingsPage, I18nKey>

const themeOptions = [
  { id: 'ayu-light', labelKey: 'settings.option.theme.ayuLight' },
  { id: 'light', labelKey: 'settings.option.theme.cadmiumLight' },
  { id: 'catppuccin-latte', labelKey: 'settings.option.theme.catppuccinLatte' },
  { id: 'everforest-light', labelKey: 'settings.option.theme.everforestLight' },
  { id: 'graphite', labelKey: 'settings.option.theme.graphiteLight' },
  { id: 'gruvbox-light', labelKey: 'settings.option.theme.gruvboxLight' },
  { id: 'rose-pine-dawn', labelKey: 'settings.option.theme.rosePineDawn' },
  { id: 'solarized-light', labelKey: 'settings.option.theme.solarizedLight' },
  { id: 'tokyo-night-light', labelKey: 'settings.option.theme.tokyoNightLight' },
  { id: 'ulysses', labelKey: 'settings.option.theme.ulyssesLight' },
  { id: 'ayu-dark', labelKey: 'settings.option.theme.ayuDark' },
  { id: 'ayu-mirage', labelKey: 'settings.option.theme.ayuMirage' },
  { id: 'dark', labelKey: 'settings.option.theme.cadmiumDark' },
  { id: 'catppuccin-mocha', labelKey: 'settings.option.theme.catppuccinMocha' },
  { id: 'cyberdream', labelKey: 'settings.option.theme.cyberdream' },
  { id: 'dracula', labelKey: 'settings.option.theme.dracula' },
  { id: 'everforest-dark', labelKey: 'settings.option.theme.everforestDark' },
  { id: 'gruvbox-dark', labelKey: 'settings.option.theme.gruvboxDark' },
  { id: 'horizon-dark', labelKey: 'settings.option.theme.horizonDark' },
  { id: 'kanagawa', labelKey: 'settings.option.theme.kanagawa' },
  { id: 'material-dark', labelKey: 'settings.option.theme.materialDark' },
  { id: 'monokai-pro', labelKey: 'settings.option.theme.monokaiPro' },
  { id: 'nightfox', labelKey: 'settings.option.theme.nightfox' },
  { id: 'nord', labelKey: 'settings.option.theme.nord' },
  { id: 'one-dark', labelKey: 'settings.option.theme.oneDark' },
  { id: 'oxocarbon-dark', labelKey: 'settings.option.theme.oxocarbonDark' },
  { id: 'palenight', labelKey: 'settings.option.theme.palenight' },
  { id: 'rose-pine', labelKey: 'settings.option.theme.rosePine' },
  { id: 'rose-pine-moon', labelKey: 'settings.option.theme.rosePineMoon' },
  { id: 'solarized-dark', labelKey: 'settings.option.theme.solarizedDark' },
  { id: 'synthwave-84', labelKey: 'settings.option.theme.synthwave84' },
  { id: 'tokyo-night', labelKey: 'settings.option.theme.tokyoNight' },
  { id: 'tokyo-night-storm', labelKey: 'settings.option.theme.tokyoNightStorm' },
] as const satisfies readonly SettingsOption[]

const lightThemeOptions = themeOptions.slice(0, 10)
const darkThemeOptions = themeOptions.slice(10)

const appThemeOptions = [
  { id: 'system', labelKey: 'settings.option.system' },
  { id: 'light', labelKey: 'settings.option.light' },
  { id: 'dark', labelKey: 'settings.option.dark' },
] as const satisfies readonly SettingsOption[]

const textDirectionOptions = [
  { id: 'ltr', labelKey: 'settings.option.ltr' },
  { id: 'rtl', labelKey: 'settings.option.rtl' },
] as const satisfies readonly SettingsOption[]

const editorFontOptions = [
  { id: 'system', labelKey: 'settings.option.font.system' },
  { id: 'open-sans', labelKey: 'settings.option.font.openSans' },
  { id: 'serif', labelKey: 'settings.option.font.serif' },
  { id: 'monospace', labelKey: 'settings.option.font.monospace' },
] as const satisfies readonly SettingsOption[]

const codeFontOptions = [
  { id: 'dejavu-sans-mono', labelKey: 'settings.option.font.dejavuSansMono' },
  { id: 'system-mono', labelKey: 'settings.option.font.systemMono' },
  { id: 'monospace', labelKey: 'settings.option.font.monospace' },
] as const satisfies readonly SettingsOption[]

const toolbarPanelOptions = [
  { id: 'format', labelKey: 'settings.option.toolbar.format' },
  { id: 'paragraph', labelKey: 'settings.option.toolbar.paragraph' },
  { id: 'insert', labelKey: 'settings.option.toolbar.insert' },
  { id: 'markdown', labelKey: 'settings.option.toolbar.markdown' },
] as const satisfies readonly SettingsOption[]

const toolbarDisplayOptions = [
  { id: 'docked', labelKey: 'settings.option.toolbarDisplay.docked' },
  { id: 'hidden', labelKey: 'settings.option.toolbarDisplay.hidden' },
] as const satisfies readonly SettingsOption[]

const quickBarContentOptions = [
  { id: 'default', labelKey: 'settings.option.quickBar.default' },
  { id: 'custom', labelKey: 'settings.option.quickBar.custom' },
] as const satisfies readonly SettingsOption[]

const tabWidthOptions = [
  { id: '1', labelKey: 'settings.option.one' },
  { id: '2', labelKey: 'settings.option.two' },
  { id: '3', labelKey: 'settings.option.three' },
  { id: '4', labelKey: 'settings.option.four' },
] as const satisfies readonly SettingsOption[]

const bulletMarkerOptions = [
  { id: '-', labelKey: 'settings.option.hyphen' },
  { id: '*', labelKey: 'settings.option.asterisk' },
  { id: '+', labelKey: 'settings.option.plus' },
] as const satisfies readonly SettingsOption[]

const orderedDelimiterOptions = [
  { id: '.', labelKey: 'settings.option.period' },
  { id: ')', labelKey: 'settings.option.parenthesis' },
] as const satisfies readonly SettingsOption[]

const listIndentOptions = [
  { id: 'dfm', labelKey: 'settings.option.indent.dfm' },
  { id: 'tab', labelKey: 'settings.option.indent.tab' },
  { id: '1', labelKey: 'settings.option.indent.one' },
  { id: '2', labelKey: 'settings.option.indent.two' },
  { id: '3', labelKey: 'settings.option.indent.three' },
  { id: '4', labelKey: 'settings.option.indent.four' },
] as const satisfies readonly SettingsOption[]

const headingStyleOptions = [
  { id: 'atx', labelKey: 'settings.option.heading.atx' },
  { id: 'setext', labelKey: 'settings.option.heading.setext' },
] as const satisfies readonly SettingsOption[]

const frontMatterOptions = [
  { id: '-', labelKey: 'settings.option.frontMatter.yaml' },
  { id: '+', labelKey: 'settings.option.frontMatter.toml' },
  { id: ';', labelKey: 'settings.option.frontMatter.jsonSemicolon' },
  { id: '{', labelKey: 'settings.option.frontMatter.jsonBrace' },
] as const satisfies readonly SettingsOption[]

const sequenceThemeOptions = [
  { id: 'hand', labelKey: 'settings.option.sequence.hand' },
  { id: 'simple', labelKey: 'settings.option.sequence.simple' },
] as const satisfies readonly SettingsOption[]

const startupOptions = [
  { id: 'home', labelKey: 'settings.option.startup.home' },
  { id: 'lastEdit', labelKey: 'settings.option.startup.lastEdit' },
  { id: 'blank', labelKey: 'settings.option.startup.blank' },
] as const satisfies readonly SettingsOption[]

const sortByOptions = [
  { id: 'created', labelKey: 'settings.option.sort.created' },
  { id: 'modified', labelKey: 'settings.option.sort.modified' },
  { id: 'title', labelKey: 'settings.option.sort.name' },
] as const satisfies readonly SettingsOption[]

const sortOrderOptions = [
  { id: 'asc', labelKey: 'settings.option.sort.asc' },
  { id: 'desc', labelKey: 'settings.option.sort.desc' },
] as const satisfies readonly SettingsOption[]

const imageShareOptions = [
  { id: 'attach', labelKey: 'settings.option.share.attach' },
  { id: 'link-only', labelKey: 'settings.option.share.linkOnly' },
] as const satisfies readonly SettingsOption[]

const spellingLanguageOptions = [
  { id: 'en-US', labelKey: 'settings.option.language.enUS' },
  { id: 'zh-CN', labelKey: 'settings.option.language.zhCN' },
  { id: 'de-DE', labelKey: 'settings.option.language.deDE' },
  { id: 'fr-FR', labelKey: 'settings.option.language.frFR' },
] as const satisfies readonly SettingsOption[]

const encodingOptions = [
  { id: 'ascii', labelKey: 'settings.option.encoding.ascii' },
  { id: 'utf8', labelKey: 'settings.option.encoding.utf8' },
  { id: 'utf16be', labelKey: 'settings.option.encoding.utf16be' },
  { id: 'utf16le', labelKey: 'settings.option.encoding.utf16le' },
  { id: 'utf32be', labelKey: 'settings.option.encoding.utf32be' },
  { id: 'utf32le', labelKey: 'settings.option.encoding.utf32le' },
  { id: 'latin3', labelKey: 'settings.option.encoding.latin3' },
  { id: 'iso885915', labelKey: 'settings.option.encoding.iso885915' },
  { id: 'cp1252', labelKey: 'settings.option.encoding.cp1252' },
  { id: 'arabic', labelKey: 'settings.option.encoding.arabic' },
  { id: 'cp1256', labelKey: 'settings.option.encoding.cp1256' },
  { id: 'latin4', labelKey: 'settings.option.encoding.latin4' },
  { id: 'cp1257', labelKey: 'settings.option.encoding.cp1257' },
  { id: 'iso88592', labelKey: 'settings.option.encoding.iso88592' },
  { id: 'windows1250', labelKey: 'settings.option.encoding.windows1250' },
  { id: 'cp866', labelKey: 'settings.option.encoding.cp866' },
  { id: 'iso88595', labelKey: 'settings.option.encoding.iso88595' },
  { id: 'koi8r', labelKey: 'settings.option.encoding.koi8r' },
  { id: 'koi8u', labelKey: 'settings.option.encoding.koi8u' },
  { id: 'cp1251', labelKey: 'settings.option.encoding.cp1251' },
  { id: 'iso885913', labelKey: 'settings.option.encoding.iso885913' },
  { id: 'greek', labelKey: 'settings.option.encoding.greek' },
  { id: 'cp1253', labelKey: 'settings.option.encoding.cp1253' },
  { id: 'hebrew', labelKey: 'settings.option.encoding.hebrew' },
  { id: 'cp1255', labelKey: 'settings.option.encoding.cp1255' },
  { id: 'latin5', labelKey: 'settings.option.encoding.latin5' },
  { id: 'cp1254', labelKey: 'settings.option.encoding.cp1254' },
  { id: 'gb2312', labelKey: 'settings.option.encoding.gb2312' },
  { id: 'gb18030', labelKey: 'settings.option.encoding.gb18030' },
  { id: 'gbk', labelKey: 'settings.option.encoding.gbk' },
  { id: 'big5', labelKey: 'settings.option.encoding.big5' },
  { id: 'big5hkscs', labelKey: 'settings.option.encoding.big5hkscs' },
  { id: 'shiftjis', labelKey: 'settings.option.encoding.shiftjis' },
  { id: 'eucjp', labelKey: 'settings.option.encoding.eucjp' },
  { id: 'euckr', labelKey: 'settings.option.encoding.euckr' },
  { id: 'latin6', labelKey: 'settings.option.encoding.latin6' },
] as const satisfies readonly SettingsOption[]

const lineEndingOptions = [
  { id: 'default', labelKey: 'settings.option.lineEnding.default' },
  { id: 'lf', labelKey: 'settings.option.lineEnding.lf' },
  { id: 'crlf', labelKey: 'settings.option.lineEnding.crlf' },
] as const satisfies readonly SettingsOption[]

const trailingNewlineOptions = [
  { id: '2', labelKey: 'settings.option.trailing.preserve' },
  { id: '1', labelKey: 'settings.option.trailing.ensureOne' },
  { id: '0', labelKey: 'settings.option.trailing.trim' },
] as const satisfies readonly SettingsOption[]

const SETTINGS_DETAIL_SECTIONS_BASE: Partial<Record<SettingsPage, readonly SettingsDetailSection[]>> = {
  [SETTINGS_PAGES.APPEARANCE]: [
    {
      titleKey: 'settings.section.theme',
      rows: [
        {
          kind: 'toggle',
          id: 'followSystemTheme',
          implementation: 'storedOnly',
          labelKey: 'settings.appearance.followSystemTheme',
          defaultValue: true,
          testId: 'settings-appearance-system-theme',
        },
        {
          kind: 'choice',
          id: 'appTheme',
          implementation: 'storedOnly',
          labelKey: 'settings.appearance.appTheme',
          defaultValue: 'system',
          options: appThemeOptions,
          testId: 'settings-appearance-app-theme',
        },
        {
          kind: 'choice',
          id: 'lightModeTheme',
          implementation: 'storedOnly',
          labelKey: 'settings.appearance.lightTheme',
          defaultValue: 'light',
          display: 'select',
          options: lightThemeOptions,
          testId: 'settings-appearance-light-theme',
        },
        {
          kind: 'choice',
          id: 'darkModeTheme',
          implementation: 'storedOnly',
          labelKey: 'settings.appearance.darkTheme',
          defaultValue: 'dark',
          display: 'select',
          options: darkThemeOptions,
          testId: 'settings-appearance-dark-theme',
        },
        {
          kind: 'choice',
          id: 'theme',
          implementation: 'storedOnly',
          labelKey: 'settings.appearance.editorTheme',
          defaultValue: 'light',
          display: 'select',
          options: themeOptions,
          testId: 'settings-appearance-editor-theme',
        },
      ],
    },
    {
      titleKey: 'settings.section.text',
      rows: [
        {
          kind: 'slider',
          id: 'fontSize',
          implementation: 'runtime',
          labelKey: 'settings.appearance.fontSize',
          defaultValue: 16,
          min: 12,
          max: 32,
          step: 1,
          unitKey: 'settings.unit.px',
          testId: 'settings-appearance-font-size',
        },
        {
          kind: 'slider',
          id: 'lineHeight',
          implementation: 'runtime',
          labelKey: 'settings.appearance.lineHeight',
          defaultValue: 1.6,
          min: 1.2,
          max: 2,
          step: 0.1,
          testId: 'settings-appearance-line-height',
        },
        {
          kind: 'text',
          id: 'editorLineWidth',
          implementation: 'runtime',
          labelKey: 'settings.appearance.lineWidth',
          defaultValue: '',
          placeholderKey: 'settings.placeholder.lineWidth',
          testId: 'settings-appearance-line-width',
        },
        {
          kind: 'choice',
          id: 'editorFontFamily',
          implementation: 'runtime',
          labelKey: 'settings.appearance.font',
          defaultValue: 'open-sans',
          display: 'select',
          options: editorFontOptions,
          testId: 'settings-appearance-font',
        },
        {
          kind: 'choice',
          id: 'textDirection',
          implementation: 'runtime',
          labelKey: 'settings.appearance.direction',
          defaultValue: 'ltr',
          options: textDirectionOptions,
          testId: 'settings-appearance-direction',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.EDITING]: [
    {
      titleKey: 'settings.section.autoPair',
      rows: [
        {
          kind: 'toggle',
          id: 'autoPairBracket',
          implementation: 'runtime',
          labelKey: 'settings.editing.autoPairBrackets',
          defaultValue: true,
          testId: 'settings-editing-brackets',
        },
        {
          kind: 'toggle',
          id: 'autoPairMarkdownSyntax',
          implementation: 'runtime',
          labelKey: 'settings.editing.autoPairMarkdown',
          defaultValue: true,
          testId: 'settings-editing-markdown-syntax',
        },
        {
          kind: 'toggle',
          id: 'autoPairQuote',
          implementation: 'runtime',
          labelKey: 'settings.editing.autoPairQuotes',
          defaultValue: true,
          testId: 'settings-editing-quotes',
        },
      ],
    },
    {
      titleKey: 'settings.section.assist',
      rows: [
        {
          kind: 'toggle',
          id: 'quickInsert',
          implementation: 'runtime',
          labelKey: 'settings.editing.quickInsert',
          defaultValue: true,
          testId: 'settings-editing-quick-insert',
        },
        {
          kind: 'toggle',
          id: 'linkPopup',
          implementation: 'runtime',
          labelKey: 'settings.editing.linkPopup',
          defaultValue: true,
          testId: 'settings-editing-link-popup',
        },
        {
          kind: 'toggle',
          id: 'autoCheck',
          implementation: 'runtime',
          labelKey: 'settings.editing.taskSync',
          defaultValue: false,
          testId: 'settings-editing-task-sync',
        },
      ],
    },
    {
      titleKey: 'settings.section.mode',
      rows: [
        {
          kind: 'toggle',
          id: 'sourceCodeModeEnabled',
          implementation: 'storedOnly',
          labelKey: 'settings.editing.sourceMode',
          defaultValue: false,
          testId: 'settings-editing-source-mode',
        },
      ],
    },
    {
      titleKey: 'settings.section.toolbar',
      rows: [
        {
          kind: 'choice',
          id: 'toolbarDisplayMode',
          implementation: 'runtime',
          labelKey: 'settings.editing.toolbarDisplayMode',
          defaultValue: 'docked',
          options: toolbarDisplayOptions,
          testId: 'settings-editing-toolbar-display',
        },
        {
          kind: 'choice',
          id: 'toolbarDefaultPanel',
          implementation: 'runtime',
          labelKey: 'settings.editing.defaultToolbarPanel',
          defaultValue: 'format',
          options: toolbarPanelOptions,
          testId: 'settings-editing-toolbar-default',
        },
        {
          kind: 'toggle',
          id: 'toolbarRememberPanel',
          implementation: 'runtime',
          labelKey: 'settings.editing.rememberToolbarPanel',
          defaultValue: true,
          testId: 'settings-editing-toolbar-remember',
        },
        {
          kind: 'toggle',
          id: 'toolbarCompact',
          implementation: 'runtime',
          labelKey: 'settings.editing.compactToolbar',
          defaultValue: false,
          testId: 'settings-editing-toolbar-compact',
        },
      ],
    },
    {
      titleKey: 'settings.section.quickBar',
      rows: [
        {
          kind: 'choice',
          id: 'toolbarQuickBarMode',
          implementation: 'runtime',
          labelKey: 'settings.editing.quickBarContent',
          defaultValue: 'default',
          options: quickBarContentOptions,
          testId: 'settings-editing-quickbar-content',
        },
        {
          kind: 'customToolbar',
          id: 'toolbarCustomQuickCommands',
          implementation: 'runtime',
          labelKey: 'settings.toolbar.custom.title',
          testId: 'settings-editing-quickbar-custom',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.CODE]: [
    {
      titleKey: 'settings.section.codeBlocks',
      rows: [
        {
          kind: 'toggle',
          id: 'codeBlockLineNumbers',
          implementation: 'runtime',
          labelKey: 'settings.code.lineNumbers',
          defaultValue: false,
          testId: 'settings-code-line-numbers',
        },
        {
          kind: 'toggle',
          id: 'wrapCodeBlocks',
          implementation: 'runtime',
          labelKey: 'settings.code.wrapLines',
          defaultValue: true,
          testId: 'settings-code-wrap-lines',
        },
        {
          kind: 'toggle',
          id: 'trimUnnecessaryCodeBlockEmptyLines',
          implementation: 'runtime',
          labelKey: 'settings.code.trimEmptyLines',
          defaultValue: true,
          testId: 'settings-code-trim-empty-lines',
        },
      ],
    },
    {
      titleKey: 'settings.section.style',
      rows: [
        {
          kind: 'slider',
          id: 'codeFontSize',
          implementation: 'runtime',
          labelKey: 'settings.code.fontSize',
          defaultValue: 14,
          min: 12,
          max: 28,
          step: 1,
          unitKey: 'settings.unit.px',
          testId: 'settings-code-font-size',
        },
        {
          kind: 'choice',
          id: 'codeFontFamily',
          implementation: 'runtime',
          labelKey: 'settings.code.font',
          defaultValue: 'dejavu-sans-mono',
          display: 'select',
          options: codeFontOptions,
          testId: 'settings-code-font',
        },
        {
          kind: 'choice',
          id: 'tabSize',
          implementation: 'runtime',
          labelKey: 'settings.code.tabWidth',
          defaultValue: '4',
          options: tabWidthOptions,
          testId: 'settings-code-tab-width',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.MARKDOWN]: [
    {
      titleKey: 'settings.section.lists',
      rows: [
        {
          kind: 'toggle',
          id: 'preferLooseListItem',
          implementation: 'runtime',
          labelKey: 'settings.markdown.looseLists',
          defaultValue: true,
          testId: 'settings-markdown-loose-lists',
        },
        {
          kind: 'choice',
          id: 'bulletListMarker',
          implementation: 'runtime',
          labelKey: 'settings.markdown.bulletMarker',
          defaultValue: '-',
          options: bulletMarkerOptions,
          testId: 'settings-markdown-bullet-marker',
        },
        {
          kind: 'choice',
          id: 'orderListDelimiter',
          implementation: 'runtime',
          labelKey: 'settings.markdown.orderedDelimiter',
          defaultValue: '.',
          options: orderedDelimiterOptions,
          testId: 'settings-markdown-ordered-delimiter',
        },
        {
          kind: 'choice',
          id: 'listIndentation',
          implementation: 'runtime',
          labelKey: 'settings.markdown.listIndentation',
          defaultValue: '1',
          display: 'select',
          options: listIndentOptions,
          testId: 'settings-markdown-list-indentation',
        },
      ],
    },
    {
      titleKey: 'settings.section.headings',
      rows: [
        {
          kind: 'choice',
          id: 'preferHeadingStyle',
          implementation: 'storedOnly',
          labelKey: 'settings.markdown.headingStyle',
          defaultValue: 'atx',
          options: headingStyleOptions,
          testId: 'settings-markdown-heading-style',
        },
      ],
    },
    {
      titleKey: 'settings.section.extensions',
      rows: [
        {
          kind: 'choice',
          id: 'frontmatterType',
          implementation: 'runtime',
          labelKey: 'settings.markdown.frontMatter',
          defaultValue: '-',
          display: 'select',
          options: frontMatterOptions,
          testId: 'settings-markdown-front-matter',
        },
        {
          kind: 'toggle',
          id: 'footnote',
          implementation: 'runtime',
          labelKey: 'settings.markdown.footnotes',
          defaultValue: false,
          testId: 'settings-markdown-footnotes',
        },
        {
          kind: 'toggle',
          id: 'superSubScript',
          implementation: 'runtime',
          labelKey: 'settings.markdown.superSub',
          defaultValue: false,
          testId: 'settings-markdown-super-sub',
        },
      ],
    },
    {
      titleKey: 'settings.section.rendering',
      rows: [
        {
          kind: 'toggle',
          id: 'isHtmlEnabled',
          implementation: 'runtime',
          labelKey: 'settings.markdown.htmlRendering',
          defaultValue: true,
          testId: 'settings-markdown-html-rendering',
        },
        {
          kind: 'toggle',
          id: 'isGitlabCompatibilityEnabled',
          implementation: 'runtime',
          labelKey: 'settings.markdown.gitlab',
          defaultValue: false,
          testId: 'settings-markdown-gitlab',
        },
      ],
    },
    {
      titleKey: 'settings.section.diagrams',
      rows: [
        {
          kind: 'choice',
          id: 'sequenceTheme',
          implementation: 'runtime',
          labelKey: 'settings.markdown.sequenceTheme',
          defaultValue: 'hand',
          options: sequenceThemeOptions,
          testId: 'settings-markdown-sequence-theme',
        },
        {
          kind: 'text',
          id: 'plantumlServer',
          implementation: 'runtime',
          labelKey: 'settings.markdown.plantumlServer',
          defaultValue: 'https://www.plantuml.com/plantuml',
          placeholderKey: 'settings.placeholder.url',
          testId: 'settings-markdown-plantuml-server',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.DOCUMENTS]: [
    {
      titleKey: 'settings.section.drafts',
      rows: [
        {
          kind: 'toggle',
          id: 'localDrafts',
          implementation: 'runtime',
          labelKey: 'settings.documents.localDrafts',
          defaultValue: true,
          testId: 'settings-documents-local-drafts',
        },
        {
          kind: 'toggle',
          id: 'recoveryDrafts',
          implementation: 'runtime',
          labelKey: 'settings.documents.recovery',
          defaultValue: true,
          testId: 'settings-documents-recovery',
        },
      ],
    },
    {
      titleKey: 'settings.section.save',
      rows: [
        {
          kind: 'toggle',
          id: 'autoSave',
          implementation: 'runtime',
          labelKey: 'settings.documents.autosave',
          defaultValue: true,
          testId: 'settings-documents-autosave',
        },
        {
          kind: 'slider',
          id: 'autoSaveDelay',
          implementation: 'runtime',
          labelKey: 'settings.documents.saveDelay',
          defaultValue: 1,
          min: 1,
          max: 10,
          step: 1,
          unitKey: 'settings.unit.seconds',
          testId: 'settings-documents-save-delay',
        },
      ],
    },
    {
      titleKey: 'settings.section.startup',
      rows: [
        {
          kind: 'choice',
          id: 'startUpAction',
          implementation: 'runtime',
          labelKey: 'settings.documents.startupAction',
          defaultValue: 'home',
          options: startupOptions,
          testId: 'settings-documents-startup-action',
        },
      ],
    },
    {
      titleKey: 'settings.section.recent',
      rows: [
        {
          kind: 'choice',
          id: 'fileSortBy',
          implementation: 'runtime',
          labelKey: 'settings.documents.sortBy',
          defaultValue: 'modified',
          display: 'select',
          options: sortByOptions,
          testId: 'settings-documents-sort-by',
        },
        {
          kind: 'choice',
          id: 'fileSortOrder',
          implementation: 'runtime',
          labelKey: 'settings.documents.sortOrder',
          defaultValue: 'desc',
          options: sortOrderOptions,
          testId: 'settings-documents-sort-order',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.IMAGES_SHARING]: [
    {
      titleKey: 'settings.section.import',
      rows: [
        {
          kind: 'toggle',
          id: 'imageCopyImages',
          implementation: 'runtime',
          labelKey: 'settings.images.copyImages',
          defaultValue: true,
          testId: 'settings-images-copy',
        },
      ],
    },
    {
      titleKey: 'settings.section.sharing',
      rows: [
        {
          kind: 'choice',
          id: 'shareImages',
          implementation: 'runtime',
          labelKey: 'settings.images.shareImages',
          defaultValue: 'attach',
          options: imageShareOptions,
          testId: 'settings-images-share',
        },
        {
          kind: 'toggle',
          id: 'shareLinkedImages',
          implementation: 'unfinished',
          labelKey: 'settings.images.includeLinked',
          defaultValue: false,
          testId: 'settings-images-include-linked',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.SPELLING]: [
    {
      titleKey: 'settings.section.spellcheck',
      rows: [
        {
          kind: 'toggle',
          id: 'spellcheckerEnabled',
          implementation: 'runtime',
          labelKey: 'settings.spelling.enabled',
          defaultValue: false,
          testId: 'settings-spelling-enabled',
        },
        {
          kind: 'choice',
          id: 'spellcheckerLanguage',
          implementation: 'runtime',
          labelKey: 'settings.spelling.language',
          defaultValue: 'en-US',
          display: 'select',
          options: spellingLanguageOptions,
          testId: 'settings-spelling-language',
        },
      ],
    },
    {
      titleKey: 'settings.section.marks',
      rows: [
        {
          kind: 'toggle',
          id: 'spellcheckerUnderline',
          implementation: 'runtime',
          labelKey: 'settings.spelling.underlines',
          defaultValue: true,
          testId: 'settings-spelling-underlines',
        },
      ],
    },
    {
      titleKey: 'settings.section.dictionary',
      // TODO: Wire these dictionary action rows to a real Android spellchecker backend.
      rows: [
        {
          kind: 'action',
          id: 'customWords',
          implementation: 'unfinished',
          labelKey: 'settings.spelling.dictionary',
          valueKey: 'settings.value.open',
          testId: 'settings-spelling-dictionary',
        },
        {
          kind: 'action',
          id: 'addWord',
          implementation: 'unfinished',
          labelKey: 'settings.spelling.addWord',
          valueKey: 'settings.value.manual',
          testId: 'settings-spelling-add-word',
        },
        {
          kind: 'action',
          id: 'removeWord',
          implementation: 'unfinished',
          labelKey: 'settings.spelling.removeWord',
          valueKey: 'settings.value.manual',
          testId: 'settings-spelling-remove-word',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.ADVANCED]: [
    {
      titleKey: 'settings.section.files',
      rows: [
        {
          kind: 'choice',
          id: 'defaultEncoding',
          implementation: 'runtime',
          labelKey: 'settings.advanced.encoding',
          defaultValue: 'utf8',
          display: 'select',
          options: encodingOptions,
          testId: 'settings-advanced-encoding',
        },
        {
          kind: 'toggle',
          id: 'autoGuessEncoding',
          implementation: 'runtime',
          labelKey: 'settings.advanced.autoDetectEncoding',
          defaultValue: true,
          testId: 'settings-advanced-auto-detect-encoding',
        },
        {
          kind: 'choice',
          id: 'endOfLine',
          implementation: 'runtime',
          labelKey: 'settings.advanced.lineEndings',
          defaultValue: 'default',
          options: lineEndingOptions,
          testId: 'settings-advanced-line-endings',
        },
        {
          kind: 'choice',
          id: 'trimTrailingNewline',
          implementation: 'runtime',
          labelKey: 'settings.advanced.trailingNewline',
          defaultValue: '2',
          display: 'select',
          options: trailingNewlineOptions,
          testId: 'settings-advanced-trailing-newline',
        },
      ],
    },
    {
      titleKey: 'settings.section.diagnostics',
      rows: [
        {
          kind: 'status',
          id: 'deviceInfo',
          implementation: 'derived',
          labelKey: 'settings.advanced.diagnostics',
          valueKey: 'settings.value.ready',
          testId: 'settings-advanced-diagnostics',
        },
        {
          kind: 'status',
          id: 'webviewInfo',
          implementation: 'derived',
          labelKey: 'settings.advanced.webview',
          valueKey: 'settings.value.ready',
          testId: 'settings-advanced-webview',
        },
      ],
    },
    {
      titleKey: 'settings.section.maintenance',
      rows: [
        {
          kind: 'action',
          id: 'exportLogs',
          implementation: 'runtime',
          labelKey: 'settings.advanced.exportLogs',
          testId: 'settings-advanced-export-logs',
        },
        {
          kind: 'action',
          id: 'clearDrafts',
          implementation: 'runtime',
          labelKey: 'settings.advanced.clearDrafts',
          testId: 'settings-advanced-clear-drafts',
        },
        {
          kind: 'action',
          id: 'resetSettings',
          implementation: 'runtime',
          labelKey: 'settings.advanced.reset',
          testId: 'settings-advanced-reset',
        },
      ],
    },
  ],
} as const

const {
  [SETTINGS_PAGES.CODE]: codeSections = [],
  [SETTINGS_PAGES.MARKDOWN]: markdownSections = [],
  [SETTINGS_PAGES.SPELLING]: spellingSections = [],
  ...settingsDetailSectionsWithoutMergedPages
} = SETTINGS_DETAIL_SECTIONS_BASE

const editingBaseSections = settingsDetailSectionsWithoutMergedPages[SETTINGS_PAGES.EDITING] ?? []
const toolbarSections = editingBaseSections.filter(
  section =>
    section.titleKey === 'settings.section.toolbar' ||
    section.titleKey === 'settings.section.quickBar',
)
const editingSections = [
  ...editingBaseSections.filter(
    section =>
      section.titleKey !== 'settings.section.toolbar' &&
      section.titleKey !== 'settings.section.quickBar',
  ),
  ...markdownSections,
  ...codeSections,
  ...spellingSections,
]

export const SETTINGS_DETAIL_SECTIONS: Partial<Record<SettingsPage, readonly SettingsDetailSection[]>> = {
  ...settingsDetailSectionsWithoutMergedPages,
  [SETTINGS_PAGES.EDITING]: editingSections,
  [SETTINGS_PAGES.TOOLBAR]: toolbarSections,
} as const
