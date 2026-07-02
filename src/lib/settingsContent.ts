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

export const SETTINGS_PAGE_TITLE_KEYS = {
  [SETTINGS_PAGES.INDEX]: 'settings.title',
  [SETTINGS_PAGES.APPEARANCE]: 'settings.appearance',
  [SETTINGS_PAGES.EDITING]: 'settings.editing',
  [SETTINGS_PAGES.MARKDOWN]: 'settings.markdown',
  [SETTINGS_PAGES.FILES_MEDIA]: 'settings.filesMedia',
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
      titleKey: 'settings.section.reading',
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
      titleKey: 'settings.section.codeBlocks',
      rows: [
        {
          labelKey: 'settings.editing.codeLineNumbers',
          valueKey: 'settings.value.off',
          testId: 'settings-editing-code-lines',
        },
        {
          labelKey: 'settings.editing.wrapCodeBlocks',
          valueKey: 'settings.value.on',
          testId: 'settings-editing-code-wrap',
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
      ],
    },
  ],
  [SETTINGS_PAGES.MARKDOWN]: [
    {
      titleKey: 'settings.section.style',
      rows: [
        {
          labelKey: 'settings.markdown.headingStyle',
          valueKey: 'settings.value.atxHeading',
          testId: 'settings-markdown-heading-style',
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
      titleKey: 'settings.section.rendering',
      rows: [
        {
          labelKey: 'settings.markdown.htmlRendering',
          valueKey: 'settings.value.on',
          testId: 'settings-markdown-html-rendering',
        },
        {
          labelKey: 'settings.markdown.footnotes',
          valueKey: 'settings.value.on',
          testId: 'settings-markdown-footnotes',
        },
        {
          labelKey: 'settings.markdown.superSub',
          valueKey: 'settings.value.on',
          testId: 'settings-markdown-super-sub',
        },
      ],
    },
  ],
  [SETTINGS_PAGES.FILES_MEDIA]: [
    {
      titleKey: 'settings.section.drafts',
      rows: [
        {
          labelKey: 'settings.files.localDrafts',
          valueKey: 'settings.value.keepRecentDrafts',
          testId: 'settings-files-local-drafts',
        },
        {
          labelKey: 'settings.files.recoveryDrafts',
          valueKey: 'settings.value.keepOnSaveFailure',
          testId: 'settings-files-recovery-drafts',
        },
      ],
    },
    {
      titleKey: 'settings.section.images',
      rows: [
        {
          labelKey: 'settings.files.imageImport',
          valueKey: 'settings.value.copyIntoAppStorage',
          testId: 'settings-files-image-import',
        },
        {
          labelKey: 'settings.files.imageShare',
          valueKey: 'settings.value.attachImportedImages',
          testId: 'settings-files-image-share',
        },
        {
          labelKey: 'settings.files.imageFolder',
          valueKey: 'settings.value.androidPicker',
          testId: 'settings-files-image-folder',
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
          valueKey: 'settings.value.available',
          testId: 'settings-advanced-diagnostics',
        },
        {
          labelKey: 'settings.advanced.markdownCompat',
          valueKey: 'settings.value.advanced',
          testId: 'settings-advanced-markdown-compat',
        },
        {
          labelKey: 'settings.advanced.diagrams',
          valueKey: 'settings.value.advanced',
          testId: 'settings-advanced-diagrams',
        },
      ],
    },
  ],
} as const
