import {
  APPEARANCE_CUSTOM_THEME_IDS,
  normalizeCustomTheme,
  type AppearanceThemeSettings,
} from './appearanceSettings'

/**
 * Shipped app themes. Light and Dark are fixed product modes; every theme id
 * must have a matching `:root[data-theme='<id>']` palette in
 * src/styles/themes/. Adding a future custom theme means adding its palette
 * file plus one entry in CUSTOM_THEME_APP_THEMES.
 */
export type AppThemeId = 'graphite-light' | 'cadmium-dark' | 'ayu-light' | 'one-dark'

export const APP_THEME_IDS = [
  'graphite-light',
  'cadmium-dark',
  'ayu-light',
  'one-dark',
] as const satisfies readonly AppThemeId[]

const CUSTOM_THEME_APP_THEMES: Record<(typeof APPEARANCE_CUSTOM_THEME_IDS)[number], AppThemeId> = {
  'ayu-light': 'ayu-light',
  'one-dark': 'one-dark',
}

const DARK_APP_THEMES: readonly AppThemeId[] = ['cadmium-dark', 'one-dark']

export function isDarkAppTheme(theme: AppThemeId): boolean {
  return DARK_APP_THEMES.includes(theme)
}

export function resolveAppTheme(
  settings: AppearanceThemeSettings,
  systemPrefersDark: boolean,
): AppThemeId {
  switch (settings.themeMode) {
    case 'light':
      return 'graphite-light'
    case 'dark':
      return 'cadmium-dark'
    case 'custom': {
      const customTheme = normalizeCustomTheme(settings.customTheme)
      return CUSTOM_THEME_APP_THEMES[customTheme as keyof typeof CUSTOM_THEME_APP_THEMES]
    }
    case 'system':
      return systemPrefersDark ? 'cadmium-dark' : 'graphite-light'
  }
}

export function applyAppTheme(theme: AppThemeId, root?: HTMLElement) {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!target) {
    return
  }

  target.dataset.theme = theme
}

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

function getSystemDarkMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }

  return window.matchMedia(SYSTEM_DARK_QUERY)
}

export function getSystemPrefersDark(): boolean {
  return getSystemDarkMediaQuery()?.matches ?? false
}

export function watchSystemColorScheme(onChange: (prefersDark: boolean) => void): () => void {
  const mediaQuery = getSystemDarkMediaQuery()
  if (!mediaQuery) {
    return () => {}
  }

  const listener = (event: MediaQueryListEvent) => {
    onChange(event.matches)
  }

  // Older Android WebViews expose only the legacy addListener/removeListener
  // pair on MediaQueryList. This runs early in App mount, so throwing here
  // would abort draft restoration and startup actions on those devices —
  // fall back instead of assuming the EventTarget API, and keep the cleanup
  // on the same API that registered the listener.
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener)
    return () => {
      mediaQuery.removeEventListener('change', listener)
    }
  }

  if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(listener)
    return () => {
      mediaQuery.removeListener(listener)
    }
  }

  return () => {}
}
