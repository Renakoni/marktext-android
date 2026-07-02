export const HOME_TABS = Object.freeze({
  DOCUMENTS: 'documents',
  SETTINGS: 'settings',
} as const)

export type HomeTab = (typeof HOME_TABS)[keyof typeof HOME_TABS]
export type HomeTabIcon = 'document' | 'settings'

export interface HomeTabItem {
  id: HomeTab
  label: string
  icon: HomeTabIcon
}

export const HOME_TAB_ITEMS = [
  {
    id: HOME_TABS.DOCUMENTS,
    label: 'Documents',
    icon: 'document',
  },
  {
    id: HOME_TABS.SETTINGS,
    label: 'Settings',
    icon: 'settings',
  },
] as const satisfies readonly HomeTabItem[]

export const DEFAULT_HOME_TAB: HomeTab = HOME_TABS.DOCUMENTS
