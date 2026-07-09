import { describe, expect, it } from 'vitest'

import {
  getAppearanceThemeSettings,
  normalizeCustomTheme,
  normalizeThemeMode,
} from './appearanceSettings'
import {
  applyAppTheme,
  getSystemPrefersDark,
  isDarkAppTheme,
  resolveAppTheme,
  watchSystemColorScheme,
} from './themeRuntime'

describe('appearance theme settings', () => {
  it('normalizes unknown theme modes and custom themes to defaults', () => {
    expect(normalizeThemeMode('dark')).toBe('dark')
    expect(normalizeThemeMode('sepia')).toBe('system')
    expect(normalizeThemeMode(42)).toBe('system')

    expect(normalizeCustomTheme('one-dark')).toBe('one-dark')
    expect(normalizeCustomTheme('dracula')).toBe('ayu-light')
    expect(normalizeCustomTheme(undefined)).toBe('ayu-light')
  })

  it('reads normalized theme settings through the settings getter', () => {
    const stored: Record<string, string> = {
      themeMode: 'custom',
      customTheme: 'one-dark',
    }

    const settings = getAppearanceThemeSettings(
      (key, defaultValue) => (stored[key] as never) ?? defaultValue,
    )

    expect(settings).toEqual({ themeMode: 'custom', customTheme: 'one-dark' })
  })
})

describe('resolveAppTheme', () => {
  it('maps the fixed modes regardless of the system scheme', () => {
    expect(resolveAppTheme({ themeMode: 'light', customTheme: 'one-dark' }, true))
      .toBe('graphite-light')
    expect(resolveAppTheme({ themeMode: 'dark', customTheme: 'ayu-light' }, false))
      .toBe('cadmium-dark')
  })

  it('follows the system scheme in system mode', () => {
    expect(resolveAppTheme({ themeMode: 'system', customTheme: 'ayu-light' }, false))
      .toBe('graphite-light')
    expect(resolveAppTheme({ themeMode: 'system', customTheme: 'ayu-light' }, true))
      .toBe('cadmium-dark')
  })

  it('resolves custom themes to their base mode until dedicated palettes ship', () => {
    expect(resolveAppTheme({ themeMode: 'custom', customTheme: 'ayu-light' }, true))
      .toBe('graphite-light')
    expect(resolveAppTheme({ themeMode: 'custom', customTheme: 'one-dark' }, false))
      .toBe('cadmium-dark')
    expect(resolveAppTheme({ themeMode: 'custom', customTheme: 'not-a-theme' }, false))
      .toBe('graphite-light')
  })
})

describe('applyAppTheme', () => {
  it('stamps the theme id onto the root element dataset', () => {
    const root = { dataset: {} as DOMStringMap } as HTMLElement

    applyAppTheme('cadmium-dark', root)
    expect(root.dataset.theme).toBe('cadmium-dark')

    applyAppTheme('graphite-light', root)
    expect(root.dataset.theme).toBe('graphite-light')
  })

  it('degrades gracefully without a document or matchMedia', () => {
    expect(() => applyAppTheme('graphite-light')).not.toThrow()
    expect(getSystemPrefersDark()).toBe(false)
    expect(() => watchSystemColorScheme(() => {})()).not.toThrow()
  })
})

describe('isDarkAppTheme', () => {
  it('classifies shipped themes', () => {
    expect(isDarkAppTheme('graphite-light')).toBe(false)
    expect(isDarkAppTheme('cadmium-dark')).toBe(true)
  })
})
