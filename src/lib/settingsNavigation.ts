export const SETTINGS_PAGES = Object.freeze({
  INDEX: 'index',
  ABOUT: 'about',
  REFERENCES: 'references',
} as const)

export type SettingsPage = (typeof SETTINGS_PAGES)[keyof typeof SETTINGS_PAGES]

export interface SettingsHomeItem {
  id: Exclude<SettingsPage, typeof SETTINGS_PAGES.INDEX>
  label: string
  value: string
  testId: string
}

export const SETTINGS_HOME_ITEMS = [
  {
    id: SETTINGS_PAGES.ABOUT,
    label: 'About MarkText',
    value: 'Version and updates',
    testId: 'settings-entry-about',
  },
  {
    id: SETTINGS_PAGES.REFERENCES,
    label: 'References',
    value: 'Repository and upstream',
    testId: 'settings-entry-references',
  },
] as const satisfies readonly SettingsHomeItem[]

export const DEFAULT_SETTINGS_PAGE: SettingsPage = SETTINGS_PAGES.INDEX
