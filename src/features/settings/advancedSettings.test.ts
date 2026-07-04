import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADVANCED_SETTINGS,
  getAdvancedSettings,
  getAndroidMarkdownSettings,
  getMarkdownSaveSettings,
  normalizeAdvancedSettingValue,
  normalizeMarkdownEncoding,
  type AdvancedSettingKey,
} from './advancedSettings'
import type { SettingsValue } from './settingsState'

function createGetter(values: Record<string, SettingsValue>) {
  return <T extends SettingsValue>(key: string, defaultValue: T): T =>
    (values[key] ?? defaultValue) as T
}

describe('advancedSettings', () => {
  it('returns normalized defaults for missing or invalid settings', () => {
    expect(getAdvancedSettings(createGetter({}))).toEqual(DEFAULT_ADVANCED_SETTINGS)
    expect(getAdvancedSettings(createGetter({
      defaultEncoding: 'bad-encoding',
      autoGuessEncoding: 'yes',
      endOfLine: 'native',
      trimTrailingNewline: 9,
    }))).toEqual(DEFAULT_ADVANCED_SETTINGS)
  })

  it('normalizes each advanced setting value by key', () => {
    const cases: Array<[AdvancedSettingKey, SettingsValue, unknown]> = [
      ['defaultEncoding', 'gbk', 'gbk'],
      ['autoGuessEncoding', false, false],
      ['endOfLine', 'crlf', 'crlf'],
      ['trimTrailingNewline', '0', 0],
    ]

    for (const [key, value, expected] of cases) {
      expect(normalizeAdvancedSettingValue(key, value)).toBe(expected)
    }
  })

  it('builds Android Markdown settings from Advanced file settings', () => {
    expect(getAndroidMarkdownSettings({
      defaultEncoding: 'gb18030',
      autoGuessEncoding: false,
    })).toEqual({
      defaultEncoding: 'gb18030',
      autoDetectEncoding: false,
    })
  })

  it('uses detected document encoding only when auto-detect is enabled', () => {
    expect(getMarkdownSaveSettings({
      defaultEncoding: 'gbk',
      autoGuessEncoding: true,
      endOfLine: 'lf',
      trimTrailingNewline: 1,
    }, 'utf16le')).toEqual({
      encoding: 'utf16le',
      lineEnding: 'lf',
      trimTrailingNewline: 1,
    })

    expect(getMarkdownSaveSettings({
      defaultEncoding: 'gbk',
      autoGuessEncoding: false,
      endOfLine: 'crlf',
      trimTrailingNewline: 0,
    }, 'utf16le')).toEqual({
      encoding: 'gbk',
      lineEnding: 'crlf',
      trimTrailingNewline: 0,
    })
  })

  it('uses the default encoding when no document encoding was detected', () => {
    expect(getMarkdownSaveSettings({
      defaultEncoding: 'gb18030',
      autoGuessEncoding: true,
      endOfLine: 'default',
      trimTrailingNewline: 2,
    })).toMatchObject({
      encoding: 'gb18030',
    })
  })

  it('falls back to UTF-8 for unknown encoding metadata', () => {
    expect(normalizeMarkdownEncoding('not-real')).toBe('utf8')
  })
})
