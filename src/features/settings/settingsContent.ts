import type { I18nKey } from '../../lib/i18n'
import { SETTINGS_PAGES, type SettingsPage } from './settingsNavigation'

interface SettingsOption {
  id: string
  labelKey: I18nKey
}

interface SettingsBaseRow {
  id: string
  labelKey: I18nKey
  testId: string
}

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

export type SettingsDetailRow =
  | SettingsToggleRow
  | SettingsChoiceRow
  | SettingsSliderRow
  | SettingsTextRow
  | SettingsActionRow
  | SettingsStatusRow

export interface SettingsDetailSection {
  titleKey: I18nKey
  rows: readonly SettingsDetailRow[]
}

// Settings descriptors are front-end-only metadata. Until each setting is wired
// explicitly, controls must not change editor behavior, document text, or files.
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

const toolbarTabOptions = [
  { id: 'format', labelKey: 'settings.option.toolbar.format' },
  { id: 'paragraph', labelKey: 'settings.option.toolbar.paragraph' },
  { id: 'insert', labelKey: 'settings.option.toolbar.insert' },
  { id: 'markdown', labelKey: 'settings.option.toolbar.markdown' },
] as const satisfies readonly SettingsOption[]

const keyboardToolbarOptions = [
  { id: 'docked', labelKey: 'settings.option.keyboard.docked' },
  { id: 'floating', labelKey: 'settings.option.keyboard.floating' },
  { id: 'hidden', labelKey: 'settings.option.keyboard.hidden' },
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

const draftOptions = [
  { id: 'recent', labelKey: 'settings.option.drafts.recent' },
  { id: 'all', labelKey: 'settings.option.drafts.all' },
  { id: 'off', labelKey: 'settings.option.off' },
] as const satisfies readonly SettingsOption[]

const startupOptions = [
  { id: 'restoreAll', labelKey: 'settings.option.startup.restoreAll' },
  { id: 'openLastFolder', labelKey: 'settings.option.startup.openLastFolder' },
  { id: 'folder', labelKey: 'settings.option.startup.folder' },
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

const imageImportOptions = [
  { id: 'copy', labelKey: 'settings.option.image.copy' },
  { id: 'link', labelKey: 'settings.option.image.link' },
  { id: 'ask', labelKey: 'settings.option.image.ask' },
] as const satisfies readonly SettingsOption[]

const relativeBaseOptions = [
  { id: 'file', labelKey: 'settings.option.relative.file' },
  { id: 'folder', labelKey: 'settings.option.relative.folder' },
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
  { id: '0', labelKey: 'settings.option.trailing.trim' },
  { id: '1', labelKey: 'settings.option.trailing.ensureOne' },
  { id: '2', labelKey: 'settings.option.trailing.preserve' },
  { id: '3', labelKey: 'settings.option.trailing.doNothing' },
] as const satisfies readonly SettingsOption[]

const SETTINGS_DETAIL_SECTIONS_BASE: Partial<Record<SettingsPage, readonly SettingsDetailSection[]>> = {
  [SETTINGS_PAGES.APPEARANCE]: [
    {
      titleKey: 'settings.section.theme',
      rows: [
        {
          kind: 'toggle',
          id: 'followSystemTheme',
          labelKey: 'settings.appearance.followSystemTheme',
          defaultValue: true,
          testId: 'settings-appearance-system-theme',
        },
        {
          kind: 'choice',
          id: 'appTheme',
          labelKey: 'settings.appearance.appTheme',
          defaultValue: 'system',
          options: appThemeOptions,
          testId: 'settings-appearance-app-theme',
        },
        {
          kind: 'choice',
          id: 'lightModeTheme',
          labelKey: 'settings.appearance.lightTheme',
          defaultValue: 'light',
          display: 'select',
          options: lightThemeOptions,
          testId: 'settings-appearance-light-theme',
        },
        {
          kind: 'choice',
          id: 'darkModeTheme',
          labelKey: 'settings.appearance.darkTheme',
          defaultValue: 'dark',
          display: 'select',
          options: darkThemeOptions,
          testId: 'settings-appearance-dark-theme',
        },
        {
          kind: 'choice',
          id: 'theme',
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
          labelKey: 'settings.appearance.lineWidth',
          defaultValue: '',
          placeholderKey: 'settings.placeholder.lineWidth',
          testId: 'settings-appearance-line-width',
        },
        {
          kind: 'choice',
          id: 'editorFontFamily',
          labelKey: 'settings.appearance.font',
          defaultValue: 'open-sans',
          display: 'select',
          options: editorFontOptions,
          testId: 'settings-appearance-font',
        },
        {
          kind: 'choice',
          id: 'textDirection',
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
          labelKey: 'settings.editing.autoPairBrackets',
          defaultValue: true,
          testId: 'settings-editing-brackets',
        },
        {
          kind: 'toggle',
          id: 'autoPairMarkdownSyntax',
          labelKey: 'settings.editing.autoPairMarkdown',
          defaultValue: true,
          testId: 'settings-editing-markdown-syntax',
        },
        {
          kind: 'toggle',
          id: 'autoPairQuote',
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
          labelKey: 'settings.editing.quickInsert',
          defaultValue: true,
          testId: 'settings-editing-quick-insert',
        },
        {
          kind: 'toggle',
          id: 'linkPopup',
          labelKey: 'settings.editing.linkPopup',
          defaultValue: true,
          testId: 'settings-editing-link-popup',
        },
        {
          kind: 'toggle',
          id: 'autoCheck',
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
          labelKey: 'settings.editing.sourceMode',
          defaultValue: false,
          testId: 'settings-editing-source-mode',
        },
      ],
    },
    {
      titleKey: 'settings.section.mobileToolbar',
      rows: [
        {
          kind: 'choice',
          id: 'toolbarKeyboard',
          labelKey: 'settings.editing.keyboardBehavior',
          defaultValue: 'docked',
          options: keyboardToolbarOptions,
          testId: 'settings-editing-toolbar-keyboard',
        },
        {
          kind: 'choice',
          id: 'toolbarDefaultTab',
          labelKey: 'settings.editing.defaultToolbar',
          defaultValue: 'format',
          options: toolbarTabOptions,
          testId: 'settings-editing-toolbar-default',
        },
        {
          kind: 'toggle',
          id: 'toolbarRememberTab',
          labelKey: 'settings.editing.rememberToolbar',
          defaultValue: true,
          testId: 'settings-editing-toolbar-remember',
        },
        {
          kind: 'toggle',
          id: 'toolbarCompact',
          labelKey: 'settings.editing.compactToolbar',
          defaultValue: false,
          testId: 'settings-editing-toolbar-compact',
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
          labelKey: 'settings.code.lineNumbers',
          defaultValue: false,
          testId: 'settings-code-line-numbers',
        },
        {
          kind: 'toggle',
          id: 'wrapCodeBlocks',
          labelKey: 'settings.code.wrapLines',
          defaultValue: true,
          testId: 'settings-code-wrap-lines',
        },
        {
          kind: 'toggle',
          id: 'trimUnnecessaryCodeBlockEmptyLines',
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
          labelKey: 'settings.code.font',
          defaultValue: 'dejavu-sans-mono',
          display: 'select',
          options: codeFontOptions,
          testId: 'settings-code-font',
        },
        {
          kind: 'choice',
          id: 'tabSize',
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
          labelKey: 'settings.markdown.looseLists',
          defaultValue: true,
          testId: 'settings-markdown-loose-lists',
        },
        {
          kind: 'choice',
          id: 'bulletListMarker',
          labelKey: 'settings.markdown.bulletMarker',
          defaultValue: '-',
          options: bulletMarkerOptions,
          testId: 'settings-markdown-bullet-marker',
        },
        {
          kind: 'choice',
          id: 'orderListDelimiter',
          labelKey: 'settings.markdown.orderedDelimiter',
          defaultValue: '.',
          options: orderedDelimiterOptions,
          testId: 'settings-markdown-ordered-delimiter',
        },
        {
          kind: 'choice',
          id: 'listIndentation',
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
          labelKey: 'settings.markdown.frontMatter',
          defaultValue: '-',
          display: 'select',
          options: frontMatterOptions,
          testId: 'settings-markdown-front-matter',
        },
        {
          kind: 'toggle',
          id: 'footnote',
          labelKey: 'settings.markdown.footnotes',
          defaultValue: false,
          testId: 'settings-markdown-footnotes',
        },
        {
          kind: 'toggle',
          id: 'superSubScript',
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
          labelKey: 'settings.markdown.htmlRendering',
          defaultValue: true,
          testId: 'settings-markdown-html-rendering',
        },
        {
          kind: 'toggle',
          id: 'isGitlabCompatibilityEnabled',
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
          labelKey: 'settings.markdown.sequenceTheme',
          defaultValue: 'hand',
          options: sequenceThemeOptions,
          testId: 'settings-markdown-sequence-theme',
        },
        {
          kind: 'text',
          id: 'plantumlServer',
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
          kind: 'choice',
          id: 'localDrafts',
          labelKey: 'settings.documents.localDrafts',
          defaultValue: 'recent',
          options: draftOptions,
          testId: 'settings-documents-local-drafts',
        },
        {
          kind: 'toggle',
          id: 'recoveryDrafts',
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
          labelKey: 'settings.documents.autosave',
          defaultValue: false,
          testId: 'settings-documents-autosave',
        },
        {
          kind: 'slider',
          id: 'autoSaveDelay',
          labelKey: 'settings.documents.saveDelay',
          defaultValue: 5,
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
          kind: 'toggle',
          id: 'restoreLayoutState',
          labelKey: 'settings.documents.restoreSession',
          defaultValue: true,
          testId: 'settings-documents-restore-session',
        },
        {
          kind: 'choice',
          id: 'startUpAction',
          labelKey: 'settings.documents.startupAction',
          defaultValue: 'restoreAll',
          options: startupOptions,
          testId: 'settings-documents-startup-action',
        },
        {
          kind: 'action',
          id: 'defaultDirectoryToOpen',
          labelKey: 'settings.documents.defaultFolder',
          valueKey: 'settings.value.choose',
          testId: 'settings-documents-default-folder',
        },
      ],
    },
    {
      titleKey: 'settings.section.recent',
      rows: [
        {
          kind: 'choice',
          id: 'fileSortBy',
          labelKey: 'settings.documents.sortBy',
          defaultValue: 'created',
          display: 'select',
          options: sortByOptions,
          testId: 'settings-documents-sort-by',
        },
        {
          kind: 'choice',
          id: 'fileSortOrder',
          labelKey: 'settings.documents.sortOrder',
          defaultValue: 'asc',
          options: sortOrderOptions,
          testId: 'settings-documents-sort-order',
        },
        {
          kind: 'action',
          id: 'clearRecent',
          labelKey: 'settings.documents.clearRecent',
          valueKey: 'settings.value.manual',
          testId: 'settings-documents-clear-recent',
        },
      ],
    },
    {
      titleKey: 'settings.section.folders',
      rows: [
        {
          kind: 'text',
          id: 'treePathExcludePatterns',
          labelKey: 'settings.documents.folderExcludes',
          defaultValue: '',
          placeholderKey: 'settings.placeholder.globPatterns',
          multiline: true,
          testId: 'settings-documents-folder-excludes',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.IMAGES_SHARING]: [
    {
      titleKey: 'settings.section.import',
      rows: [
        {
          kind: 'choice',
          id: 'imageInsertAction',
          labelKey: 'settings.images.imageImport',
          defaultValue: 'copy',
          options: imageImportOptions,
          testId: 'settings-images-import',
        },
        {
          kind: 'toggle',
          id: 'imageCopyImages',
          labelKey: 'settings.images.copyImages',
          defaultValue: true,
          testId: 'settings-images-copy',
        },
      ],
    },
    {
      titleKey: 'settings.section.folder',
      rows: [
        {
          kind: 'action',
          id: 'imageFolder',
          labelKey: 'settings.images.imageFolder',
          valueKey: 'settings.value.choose',
          testId: 'settings-images-folder',
        },
        {
          kind: 'text',
          id: 'imageRelativeDirectoryName',
          labelKey: 'settings.images.relativeFolder',
          defaultValue: 'assets',
          placeholderKey: 'settings.placeholder.folder',
          testId: 'settings-images-relative-folder',
        },
        {
          kind: 'toggle',
          id: 'imagePreferRelativeDirectory',
          labelKey: 'settings.images.preferRelative',
          defaultValue: false,
          testId: 'settings-images-prefer-relative',
        },
        {
          kind: 'choice',
          id: 'imageRelativeDirectoryBase',
          labelKey: 'settings.images.relativeBase',
          defaultValue: 'file',
          options: relativeBaseOptions,
          testId: 'settings-images-relative-base',
        },
      ],
    },
    {
      titleKey: 'settings.section.sharing',
      rows: [
        {
          kind: 'choice',
          id: 'shareImages',
          labelKey: 'settings.images.shareImages',
          defaultValue: 'attach',
          options: imageShareOptions,
          testId: 'settings-images-share',
        },
        {
          kind: 'toggle',
          id: 'shareAttachLocal',
          labelKey: 'settings.images.attachLocal',
          defaultValue: true,
          testId: 'settings-images-attach-local',
        },
        {
          kind: 'toggle',
          id: 'shareLinkedImages',
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
          labelKey: 'settings.spelling.enabled',
          defaultValue: false,
          testId: 'settings-spelling-enabled',
        },
        {
          kind: 'choice',
          id: 'spellcheckerLanguage',
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
          labelKey: 'settings.spelling.underlines',
          defaultValue: true,
          testId: 'settings-spelling-underlines',
        },
      ],
    },
    {
      titleKey: 'settings.section.dictionary',
      rows: [
        {
          kind: 'action',
          id: 'customWords',
          labelKey: 'settings.spelling.dictionary',
          valueKey: 'settings.value.open',
          testId: 'settings-spelling-dictionary',
        },
        {
          kind: 'action',
          id: 'addWord',
          labelKey: 'settings.spelling.addWord',
          valueKey: 'settings.value.manual',
          testId: 'settings-spelling-add-word',
        },
        {
          kind: 'action',
          id: 'removeWord',
          labelKey: 'settings.spelling.removeWord',
          valueKey: 'settings.value.manual',
          testId: 'settings-spelling-remove-word',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.ADVANCED]: [
    {
      titleKey: 'settings.section.maintenance',
      rows: [
        {
          kind: 'action',
          id: 'exportLogs',
          labelKey: 'settings.advanced.exportLogs',
          valueKey: 'settings.value.manual',
          testId: 'settings-advanced-export-logs',
        },
        {
          kind: 'action',
          id: 'clearDrafts',
          labelKey: 'settings.advanced.clearDrafts',
          valueKey: 'settings.value.manual',
          testId: 'settings-advanced-clear-drafts',
        },
        {
          kind: 'action',
          id: 'resetSettings',
          labelKey: 'settings.advanced.reset',
          valueKey: 'settings.value.manual',
          testId: 'settings-advanced-reset',
        },
      ],
    },
    {
      titleKey: 'settings.section.diagnostics',
      rows: [
        {
          kind: 'status',
          id: 'deviceInfo',
          labelKey: 'settings.advanced.diagnostics',
          valueKey: 'settings.value.ready',
          testId: 'settings-advanced-diagnostics',
        },
        {
          kind: 'status',
          id: 'webviewInfo',
          labelKey: 'settings.advanced.webview',
          valueKey: 'settings.value.ready',
          testId: 'settings-advanced-webview',
        },
      ],
    },
    {
      titleKey: 'settings.section.files',
      rows: [
        {
          kind: 'choice',
          id: 'defaultEncoding',
          labelKey: 'settings.advanced.encoding',
          defaultValue: 'utf8',
          display: 'select',
          options: encodingOptions,
          testId: 'settings-advanced-encoding',
        },
        {
          kind: 'toggle',
          id: 'autoGuessEncoding',
          labelKey: 'settings.advanced.autoDetectEncoding',
          defaultValue: true,
          testId: 'settings-advanced-auto-detect-encoding',
        },
        {
          kind: 'choice',
          id: 'endOfLine',
          labelKey: 'settings.advanced.lineEndings',
          defaultValue: 'default',
          options: lineEndingOptions,
          testId: 'settings-advanced-line-endings',
        },
        {
          kind: 'toggle',
          id: 'autoNormalizeLineEndings',
          labelKey: 'settings.advanced.normalizeEndings',
          defaultValue: false,
          testId: 'settings-advanced-normalize-endings',
        },
        {
          kind: 'choice',
          id: 'trimTrailingNewline',
          labelKey: 'settings.advanced.trailingNewline',
          defaultValue: '2',
          display: 'select',
          options: trailingNewlineOptions,
          testId: 'settings-advanced-trailing-newline',
        },
      ],
    },
    {
      titleKey: 'settings.section.search',
      rows: [
        {
          kind: 'text',
          id: 'searchExclusions',
          labelKey: 'settings.advanced.searchExclusions',
          defaultValue: '',
          placeholderKey: 'settings.placeholder.globPatterns',
          multiline: true,
          testId: 'settings-advanced-search-exclusions',
        },
        {
          kind: 'text',
          id: 'searchMaxFileSize',
          labelKey: 'settings.advanced.searchMaxFileSize',
          defaultValue: '',
          placeholderKey: 'settings.placeholder.fileSize',
          testId: 'settings-advanced-search-max-file-size',
        },
        {
          kind: 'toggle',
          id: 'searchIncludeHidden',
          labelKey: 'settings.advanced.searchIncludeHidden',
          defaultValue: false,
          testId: 'settings-advanced-search-include-hidden',
        },
        {
          kind: 'toggle',
          id: 'searchNoIgnore',
          labelKey: 'settings.advanced.searchNoIgnore',
          defaultValue: false,
          testId: 'settings-advanced-search-no-ignore',
        },
        {
          kind: 'toggle',
          id: 'searchFollowSymlinks',
          labelKey: 'settings.advanced.searchFollowSymlinks',
          defaultValue: true,
          testId: 'settings-advanced-search-follow-symlinks',
        },
      ],
    },
    {
      titleKey: 'settings.section.keyboard',
      rows: [
        {
          kind: 'action',
          id: 'keybindings',
          labelKey: 'settings.advanced.keybindings',
          valueKey: 'settings.value.open',
          testId: 'settings-advanced-keybindings',
        },
      ],
    },
    {
      titleKey: 'settings.section.custom',
      rows: [
        {
          kind: 'text',
          id: 'customCss',
          labelKey: 'settings.advanced.customCss',
          defaultValue: '',
          placeholderKey: 'settings.placeholder.customCss',
          multiline: true,
          testId: 'settings-advanced-custom-css',
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
  section => section.titleKey === 'settings.section.mobileToolbar',
)
const editingSections = [
  ...editingBaseSections.filter(section => section.titleKey !== 'settings.section.mobileToolbar'),
  ...markdownSections,
  ...codeSections,
  ...spellingSections,
]

export const SETTINGS_DETAIL_SECTIONS: Partial<Record<SettingsPage, readonly SettingsDetailSection[]>> = {
  ...settingsDetailSectionsWithoutMergedPages,
  [SETTINGS_PAGES.EDITING]: editingSections,
  [SETTINGS_PAGES.TOOLBAR]: toolbarSections,
} as const
