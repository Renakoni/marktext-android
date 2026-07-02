import type { I18nKey } from './i18n'

export const SETTINGS_PAGES = Object.freeze({
  INDEX: 'index',
  APPEARANCE: 'appearance',
  EDITING: 'editing',
  CODE: 'code',
  MARKDOWN: 'markdown',
  DOCUMENTS: 'documents',
  IMAGES_SHARING: 'images-sharing',
  SPELLING: 'spelling',
  ADVANCED: 'advanced',
  ABOUT: 'about',
} as const)

export type SettingsPage = (typeof SETTINGS_PAGES)[keyof typeof SETTINGS_PAGES]

export interface SettingsHomeItem {
  id: Exclude<SettingsPage, typeof SETTINGS_PAGES.INDEX>
  labelKey: I18nKey
  valueKey: I18nKey
  testId: string
}

export interface SettingsHomeSection {
  titleKey: I18nKey
  items: readonly SettingsHomeItem[]
}

export const SETTINGS_HOME_SECTIONS = [
  {
    titleKey: 'settings.display',
    items: [
      {
        id: SETTINGS_PAGES.APPEARANCE,
        labelKey: 'settings.appearance',
        valueKey: 'settings.entry.appearance',
        testId: 'settings-entry-appearance',
      },
    ],
  },
  {
    titleKey: 'settings.editor',
    items: [
      {
        id: SETTINGS_PAGES.EDITING,
        labelKey: 'settings.editing',
        valueKey: 'settings.entry.editing',
        testId: 'settings-entry-editing',
      },
      {
        id: SETTINGS_PAGES.CODE,
        labelKey: 'settings.code',
        valueKey: 'settings.entry.code',
        testId: 'settings-entry-code',
      },
      {
        id: SETTINGS_PAGES.MARKDOWN,
        labelKey: 'settings.markdown',
        valueKey: 'settings.entry.markdown',
        testId: 'settings-entry-markdown',
      },
      {
        id: SETTINGS_PAGES.SPELLING,
        labelKey: 'settings.spelling',
        valueKey: 'settings.entry.spelling',
        testId: 'settings-entry-spelling',
      },
    ],
  },
  {
    titleKey: 'settings.files',
    items: [
      {
        id: SETTINGS_PAGES.DOCUMENTS,
        labelKey: 'settings.documents',
        valueKey: 'settings.entry.documents',
        testId: 'settings-entry-documents',
      },
      {
        id: SETTINGS_PAGES.IMAGES_SHARING,
        labelKey: 'settings.imagesSharing',
        valueKey: 'settings.entry.imagesSharing',
        testId: 'settings-entry-images-sharing',
      },
    ],
  },
  {
    titleKey: 'settings.more',
    items: [
      {
        id: SETTINGS_PAGES.ADVANCED,
        labelKey: 'settings.advanced',
        valueKey: 'settings.entry.advanced',
        testId: 'settings-entry-advanced',
      },
      {
        id: SETTINGS_PAGES.ABOUT,
        labelKey: 'settings.about',
        valueKey: 'settings.entry.about',
        testId: 'settings-entry-about',
      },
    ],
  },
] as const satisfies readonly SettingsHomeSection[]

export const SETTINGS_HOME_ITEMS = SETTINGS_HOME_SECTIONS.flatMap(section => [...section.items])

export const DEFAULT_SETTINGS_PAGE: SettingsPage = SETTINGS_PAGES.INDEX
