// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSystemLocale } from './i18n'

const LOCALE_STORAGE_KEY = 'marktext-for-android:locale'

function setSystemLanguages(languages: readonly string[]) {
  return vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages)
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  window.localStorage.clear()
  document.documentElement.removeAttribute('lang')
})

describe('resolveSystemLocale', () => {
  it('matches supported regional and Chinese script variants', () => {
    const cases = [
      ['en-US', 'en'],
      ['zh-Hans-TW', 'zh-CN'],
      ['zh-Hant-CN', 'zh-TW'],
      ['de-AT', 'de'],
      ['es-MX', 'es'],
      ['fr-CA', 'fr'],
      ['ja-JP', 'ja'],
      ['ko-KR', 'ko'],
      ['pt-BR', 'pt'],
      ['tr-TR', 'tr'],
    ] as const

    for (const [systemLanguage, expectedLocale] of cases) {
      expect(resolveSystemLocale([systemLanguage])).toBe(expectedLocale)
    }
    expect(resolveSystemLocale(['it-IT', 'fr-CA'])).toBe('fr')
  })

  it('falls back to English when no system language is supported', () => {
    expect(resolveSystemLocale(['ar', 'it-IT'])).toBe('en')
    expect(resolveSystemLocale([])).toBe('en')
  })
})

describe('locale preference', () => {
  it('defaults to Auto and resolves the current system language', async () => {
    setSystemLanguages(['ja-JP'])
    const { useI18n } = await import('./i18n')
    const { locale, localePreference } = useI18n()

    expect(localePreference.value).toBe('auto')
    expect(locale.value).toBe('ja')
    expect(document.documentElement.lang).toBe('ja')
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })

  it('persists an explicit selection and stops following system changes', async () => {
    const languages = ['de-DE']
    const languageSpy = setSystemLanguages(languages)
    const { useI18n } = await import('./i18n')
    const { locale, localePreference, setLocale } = useI18n()

    setLocale('fr')
    expect(document.documentElement.lang).toBe('fr')

    languageSpy.mockReturnValue(['ko-KR'])
    window.dispatchEvent(new Event('languagechange'))

    expect(localePreference.value).toBe('fr')
    expect(locale.value).toBe('fr')
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('fr')
  })

  it('updates an Auto selection when the system language changes', async () => {
    const languageSpy = setSystemLanguages(['de-DE'])
    const { useI18n } = await import('./i18n')
    const { locale, localePreference } = useI18n()

    expect(localePreference.value).toBe('auto')
    expect(locale.value).toBe('de')

    languageSpy.mockReturnValue(['zh-Hant-TW'])
    window.dispatchEvent(new Event('languagechange'))

    expect(localePreference.value).toBe('auto')
    expect(locale.value).toBe('zh-TW')
    expect(document.documentElement.lang).toBe('zh-TW')
  })
})
