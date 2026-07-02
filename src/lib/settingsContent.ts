import type { I18nKey } from './i18n'
import { SETTINGS_PAGES, type SettingsPage } from './settingsNavigation'

export interface SettingsDetailRow {
  labelKey: I18nKey
  valueKey: I18nKey
  testId: string
}

export interface SettingsDetailSection {
  titleKey: I18nKey
  rows: readonly SettingsDetailRow[]
}

// Settings descriptors are read-only UI metadata. Markdown, editing, and file
// preferences must not rewrite document text while opening, rendering, or browsing settings.
export const SETTINGS_PAGE_TITLE_KEYS = {
  [SETTINGS_PAGES.INDEX]: 'settings.title',
  [SETTINGS_PAGES.APPEARANCE]: 'settings.appearance',
  [SETTINGS_PAGES.EDITING]: 'settings.editing',
  [SETTINGS_PAGES.CODE]: 'settings.code',
  [SETTINGS_PAGES.MARKDOWN]: 'settings.markdown',
  [SETTINGS_PAGES.DOCUMENTS]: 'settings.documents',
  [SETTINGS_PAGES.IMAGES_SHARING]: 'settings.imagesSharing',
  [SETTINGS_PAGES.SPELLING]: 'settings.spelling',
  [SETTINGS_PAGES.ADVANCED]: 'settings.advanced',
  [SETTINGS_PAGES.ABOUT]: 'settings.about',
} as const satisfies Record<SettingsPage, I18nKey>

export const SETTINGS_DETAIL_SECTIONS: Partial<Record<SettingsPage, readonly SettingsDetailSection[]>> = {
  [SETTINGS_PAGES.APPEARANCE]: [
    {
      titleKey: 'settings.section.theme',
      rows: [
        {
          labelKey: 'settings.appearance.followSystemTheme',
          valueKey: 'settings.value.on',
          testId: 'settings-appearance-system-theme',
        },
        {
          labelKey: 'settings.appearance.appTheme',
          valueKey: 'settings.value.system',
          testId: 'settings-appearance-app-theme',
        },
        {
          labelKey: 'settings.appearance.editorTheme',
          valueKey: 'settings.value.default',
          testId: 'settings-appearance-editor-theme',
        },
      ],
    },
    {
      titleKey: 'settings.section.text',
      rows: [
        {
          labelKey: 'settings.appearance.fontSize',
          valueKey: 'settings.value.medium',
          testId: 'settings-appearance-font-size',
        },
        {
          labelKey: 'settings.appearance.lineHeight',
          valueKey: 'settings.value.normal',
          testId: 'settings-appearance-line-height',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.EDITING]: [
    {
      titleKey: 'settings.section.autoPair',
      rows: [
        {
          labelKey: 'settings.editing.autoPairBrackets',
          valueKey: 'settings.value.on',
          testId: 'settings-editing-brackets',
        },
        {
          labelKey: 'settings.editing.autoPairMarkdown',
          valueKey: 'settings.value.on',
          testId: 'settings-editing-markdown-syntax',
        },
        {
          labelKey: 'settings.editing.autoPairQuotes',
          valueKey: 'settings.value.on',
          testId: 'settings-editing-quotes',
        },
      ],
    },
    {
      titleKey: 'settings.section.assist',
      rows: [
        {
          labelKey: 'settings.editing.quickInsert',
          valueKey: 'settings.value.on',
          testId: 'settings-editing-quick-insert',
        },
        {
          labelKey: 'settings.editing.linkPopup',
          valueKey: 'settings.value.on',
          testId: 'settings-editing-link-popup',
        },
        {
          labelKey: 'settings.editing.taskSync',
          valueKey: 'settings.value.off',
          testId: 'settings-editing-task-sync',
        },
      ],
    },
    {
      titleKey: 'settings.section.mobileToolbar',
      rows: [
        {
          labelKey: 'settings.editing.keyboardBehavior',
          valueKey: 'settings.value.dockAboveKeyboard',
          testId: 'settings-editing-toolbar-keyboard',
        },
        {
          labelKey: 'settings.editing.defaultToolbar',
          valueKey: 'settings.value.format',
          testId: 'settings-editing-toolbar-default',
        },
        {
          labelKey: 'settings.editing.rememberToolbar',
          valueKey: 'settings.value.on',
          testId: 'settings-editing-toolbar-remember',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.CODE]: [
    {
      titleKey: 'settings.section.codeBlocks',
      rows: [
        {
          labelKey: 'settings.code.lineNumbers',
          valueKey: 'settings.value.off',
          testId: 'settings-code-line-numbers',
        },
        {
          labelKey: 'settings.code.wrapLines',
          valueKey: 'settings.value.on',
          testId: 'settings-code-wrap-lines',
        },
        {
          labelKey: 'settings.code.trimEmptyLines',
          valueKey: 'settings.value.on',
          testId: 'settings-code-trim-empty-lines',
        },
      ],
    },
    {
      titleKey: 'settings.section.style',
      rows: [
        {
          labelKey: 'settings.code.fontSize',
          valueKey: 'settings.value.medium',
          testId: 'settings-code-font-size',
        },
        {
          labelKey: 'settings.code.font',
          valueKey: 'settings.value.default',
          testId: 'settings-code-font',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.MARKDOWN]: [
    {
      titleKey: 'settings.section.lists',
      rows: [
        {
          labelKey: 'settings.markdown.looseLists',
          valueKey: 'settings.value.on',
          testId: 'settings-markdown-loose-lists',
        },
        {
          labelKey: 'settings.markdown.bulletMarker',
          valueKey: 'settings.value.hyphen',
          testId: 'settings-markdown-bullet-marker',
        },
        {
          labelKey: 'settings.markdown.orderedDelimiter',
          valueKey: 'settings.value.period',
          testId: 'settings-markdown-ordered-delimiter',
        },
        {
          labelKey: 'settings.markdown.listIndentation',
          valueKey: 'settings.value.twoSpaces',
          testId: 'settings-markdown-list-indentation',
        },
      ],
    },
    {
      titleKey: 'settings.section.headings',
      rows: [
        {
          labelKey: 'settings.markdown.headingStyle',
          valueKey: 'settings.value.atxHeading',
          testId: 'settings-markdown-heading-style',
        },
      ],
    },
    {
      titleKey: 'settings.section.extensions',
      rows: [
        {
          labelKey: 'settings.markdown.frontMatter',
          valueKey: 'settings.value.yaml',
          testId: 'settings-markdown-front-matter',
        },
        {
          labelKey: 'settings.markdown.footnotes',
          valueKey: 'settings.value.off',
          testId: 'settings-markdown-footnotes',
        },
        {
          labelKey: 'settings.markdown.superSub',
          valueKey: 'settings.value.off',
          testId: 'settings-markdown-super-sub',
        },
      ],
    },
    {
      titleKey: 'settings.section.rendering',
      rows: [
        {
          labelKey: 'settings.markdown.htmlRendering',
          valueKey: 'settings.value.on',
          testId: 'settings-markdown-html-rendering',
        },
        {
          labelKey: 'settings.markdown.gitlab',
          valueKey: 'settings.value.off',
          testId: 'settings-markdown-gitlab',
        },
        {
          labelKey: 'settings.markdown.sequenceTheme',
          valueKey: 'settings.value.handDrawn',
          testId: 'settings-markdown-sequence-theme',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.DOCUMENTS]: [
    {
      titleKey: 'settings.section.drafts',
      rows: [
        {
          labelKey: 'settings.documents.localDrafts',
          valueKey: 'settings.value.recent',
          testId: 'settings-documents-local-drafts',
        },
        {
          labelKey: 'settings.documents.recovery',
          valueKey: 'settings.value.onFailure',
          testId: 'settings-documents-recovery',
        },
      ],
    },
    {
      titleKey: 'settings.section.save',
      rows: [
        {
          labelKey: 'settings.documents.autosave',
          valueKey: 'settings.value.off',
          testId: 'settings-documents-autosave',
        },
        {
          labelKey: 'settings.documents.saveDelay',
          valueKey: 'settings.value.fiveSeconds',
          testId: 'settings-documents-save-delay',
        },
      ],
    },
    {
      titleKey: 'settings.section.startup',
      rows: [
        {
          labelKey: 'settings.documents.restoreSession',
          valueKey: 'settings.value.on',
          testId: 'settings-documents-restore-session',
        },
        {
          labelKey: 'settings.documents.openLast',
          valueKey: 'settings.value.on',
          testId: 'settings-documents-open-last',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.IMAGES_SHARING]: [
    {
      titleKey: 'settings.section.import',
      rows: [
        {
          labelKey: 'settings.images.imageImport',
          valueKey: 'settings.value.copy',
          testId: 'settings-images-import',
        },
        {
          labelKey: 'settings.images.copyImages',
          valueKey: 'settings.value.appStorage',
          testId: 'settings-images-copy',
        },
      ],
    },
    {
      titleKey: 'settings.section.folder',
      rows: [
        {
          labelKey: 'settings.images.imageFolder',
          valueKey: 'settings.value.picker',
          testId: 'settings-images-folder',
        },
        {
          labelKey: 'settings.images.relativeFolder',
          valueKey: 'settings.value.assets',
          testId: 'settings-images-relative-folder',
        },
      ],
    },
    {
      titleKey: 'settings.section.sharing',
      rows: [
        {
          labelKey: 'settings.images.shareImages',
          valueKey: 'settings.value.attach',
          testId: 'settings-images-share',
        },
        {
          labelKey: 'settings.images.attachLocal',
          valueKey: 'settings.value.on',
          testId: 'settings-images-attach-local',
        },
        {
          labelKey: 'settings.images.includeLinked',
          valueKey: 'settings.value.off',
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
          labelKey: 'settings.spelling.enabled',
          valueKey: 'settings.value.off',
          testId: 'settings-spelling-enabled',
        },
        {
          labelKey: 'settings.spelling.language',
          valueKey: 'settings.value.english',
          testId: 'settings-spelling-language',
        },
      ],
    },
    {
      titleKey: 'settings.section.marks',
      rows: [
        {
          labelKey: 'settings.spelling.underlines',
          valueKey: 'settings.value.on',
          testId: 'settings-spelling-underlines',
        },
      ],
    },
    {
      titleKey: 'settings.section.dictionary',
      rows: [
        {
          labelKey: 'settings.spelling.dictionary',
          valueKey: 'settings.value.later',
          testId: 'settings-spelling-dictionary',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.ADVANCED]: [
    {
      titleKey: 'settings.section.maintenance',
      rows: [
        {
          labelKey: 'settings.advanced.exportLogs',
          valueKey: 'settings.value.manual',
          testId: 'settings-advanced-export-logs',
        },
        {
          labelKey: 'settings.advanced.clearDrafts',
          valueKey: 'settings.value.manual',
          testId: 'settings-advanced-clear-drafts',
        },
        {
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
          labelKey: 'settings.advanced.diagnostics',
          valueKey: 'settings.value.ready',
          testId: 'settings-advanced-diagnostics',
        },
        {
          labelKey: 'settings.advanced.webview',
          valueKey: 'settings.value.ready',
          testId: 'settings-advanced-webview',
        },
        {
          labelKey: 'settings.advanced.markdownCompat',
          valueKey: 'settings.value.advanced',
          testId: 'settings-advanced-markdown-compat',
        },
      ],
    },
    {
      titleKey: 'settings.section.files',
      rows: [
        {
          labelKey: 'settings.advanced.encoding',
          valueKey: 'settings.value.utf8',
          testId: 'settings-advanced-encoding',
        },
        {
          labelKey: 'settings.advanced.lineEndings',
          valueKey: 'settings.value.system',
          testId: 'settings-advanced-line-endings',
        },
        {
          labelKey: 'settings.advanced.normalizeEndings',
          valueKey: 'settings.value.off',
          testId: 'settings-advanced-normalize-endings',
        },
        {
          labelKey: 'settings.advanced.trailingNewline',
          valueKey: 'settings.value.preserve',
          testId: 'settings-advanced-trailing-newline',
        },
      ],
    },
    {
      titleKey: 'settings.section.diagrams',
      rows: [
        {
          labelKey: 'settings.advanced.plantumlServer',
          valueKey: 'settings.value.default',
          testId: 'settings-advanced-plantuml-server',
        },
      ],
    },
  ],
} as const
