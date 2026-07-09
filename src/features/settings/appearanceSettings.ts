import type { SettingsValue } from './settingsState'

export type AppearanceTextSettingKey =
  | 'fontSize'
  | 'lineHeight'
  | 'editorLineWidth'
  | 'editorFontFamily'
  | 'textDirection'

export type AppearanceThemeSettingKey =
  | 'themeMode'
  | 'customTheme'

export type AppearanceSettingKey = AppearanceTextSettingKey | AppearanceThemeSettingKey

export type EditorFontFamily = 'open-sans' | 'system' | 'serif' | 'monospace'
export type TextDirection = 'ltr' | 'rtl'

export interface AppearanceThemeSettings {
  themeMode: 'system' | 'light' | 'dark' | 'custom'
  customTheme: string
}

export interface AppearanceTextSettings {
  fontSize: number
  lineHeight: number
  editorLineWidth: string
  editorFontFamily: EditorFontFamily
  textDirection: TextDirection
}

export const APPEARANCE_FIXED_THEME_IDS = {
  light: 'graphite',
  dark: 'dark',
} as const

export const APPEARANCE_CUSTOM_THEME_IDS = [
  'ayu-light',
  'one-dark',
] as const

export const APPEARANCE_TEXT_SETTING_KEYS = [
  'fontSize',
  'lineHeight',
  'editorLineWidth',
  'editorFontFamily',
  'textDirection',
] as const satisfies readonly AppearanceTextSettingKey[]

export const APPEARANCE_THEME_SETTING_KEYS = [
  'themeMode',
  'customTheme',
] as const satisfies readonly AppearanceThemeSettingKey[]

export const APPEARANCE_SETTING_KEYS = [
  ...APPEARANCE_THEME_SETTING_KEYS,
  ...APPEARANCE_TEXT_SETTING_KEYS,
] as const satisfies readonly AppearanceSettingKey[]

export const DEFAULT_APPEARANCE_THEME_SETTINGS = {
  themeMode: 'system',
  customTheme: APPEARANCE_CUSTOM_THEME_IDS[0],
} as const satisfies AppearanceThemeSettings

export const DEFAULT_APPEARANCE_TEXT_SETTINGS = {
  fontSize: 16,
  lineHeight: 1.6,
  editorLineWidth: '',
  editorFontFamily: 'open-sans',
  textDirection: 'ltr',
} as const satisfies AppearanceTextSettings

const EDITOR_LINE_WIDTH_PATTERN = /^(?:$|[0-9]+(?:ch|px|%)$)/
const EDITOR_FONT_FAMILIES = new Set<EditorFontFamily>([
  'open-sans',
  'system',
  'serif',
  'monospace',
])

const TEXT_DIRECTIONS = new Set<TextDirection>(['ltr', 'rtl'])

const OPEN_SANS_STACK =
  '"Open Sans", "Clear Sans", "Helvetica Neue", Helvetica, Arial, sans-serif, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"'
const SYSTEM_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
const SERIF_FONT_STACK = 'Georgia, "Times New Roman", Times, serif'
const MONOSPACE_FONT_STACK =
  "'DejaVu Sans Mono', 'Source Code Pro', 'Droid Sans Mono', Consolas, monospace"

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeNumber(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

export function isAppearanceTextSettingKey(key: string): key is AppearanceTextSettingKey {
  return APPEARANCE_TEXT_SETTING_KEYS.includes(key as AppearanceTextSettingKey)
}

export function normalizeFontSize(value: unknown) {
  return Math.round(clamp(normalizeNumber(value, DEFAULT_APPEARANCE_TEXT_SETTINGS.fontSize), 12, 32))
}

export function normalizeLineHeight(value: unknown) {
  const normalized = clamp(normalizeNumber(value, DEFAULT_APPEARANCE_TEXT_SETTINGS.lineHeight), 1.2, 2)
  return Number(normalized.toFixed(1))
}

export function normalizeEditorLineWidth(value: unknown) {
  if (typeof value !== 'string') {
    return DEFAULT_APPEARANCE_TEXT_SETTINGS.editorLineWidth
  }

  const trimmed = value.trim()
  return EDITOR_LINE_WIDTH_PATTERN.test(trimmed)
    ? trimmed
    : DEFAULT_APPEARANCE_TEXT_SETTINGS.editorLineWidth
}

export function normalizeEditorFontFamily(value: unknown): EditorFontFamily {
  return EDITOR_FONT_FAMILIES.has(value as EditorFontFamily)
    ? (value as EditorFontFamily)
    : DEFAULT_APPEARANCE_TEXT_SETTINGS.editorFontFamily
}

export function normalizeTextDirection(value: unknown): TextDirection {
  return TEXT_DIRECTIONS.has(value as TextDirection)
    ? (value as TextDirection)
    : DEFAULT_APPEARANCE_TEXT_SETTINGS.textDirection
}

export function normalizeAppearanceTextSettingValue(
  key: AppearanceTextSettingKey,
  value: SettingsValue,
) {
  switch (key) {
    case 'fontSize':
      return normalizeFontSize(value)
    case 'lineHeight':
      return normalizeLineHeight(value)
    case 'editorLineWidth':
      return normalizeEditorLineWidth(value)
    case 'editorFontFamily':
      return normalizeEditorFontFamily(value)
    case 'textDirection':
      return normalizeTextDirection(value)
  }
}

export function getAppearanceTextSettings(
  getValue: <T extends SettingsValue>(key: string, defaultValue: T) => T,
): AppearanceTextSettings {
  return {
    fontSize: normalizeFontSize(
      getValue('fontSize', DEFAULT_APPEARANCE_TEXT_SETTINGS.fontSize),
    ),
    lineHeight: normalizeLineHeight(
      getValue('lineHeight', DEFAULT_APPEARANCE_TEXT_SETTINGS.lineHeight),
    ),
    editorLineWidth: normalizeEditorLineWidth(
      getValue('editorLineWidth', DEFAULT_APPEARANCE_TEXT_SETTINGS.editorLineWidth),
    ),
    editorFontFamily: normalizeEditorFontFamily(
      getValue('editorFontFamily', DEFAULT_APPEARANCE_TEXT_SETTINGS.editorFontFamily),
    ),
    textDirection: normalizeTextDirection(
      getValue('textDirection', DEFAULT_APPEARANCE_TEXT_SETTINGS.textDirection),
    ),
  }
}

export function resolveEditorFontFamily(fontFamily: EditorFontFamily) {
  switch (fontFamily) {
    case 'system':
      return `${SYSTEM_FONT_STACK}, ${OPEN_SANS_STACK}`
    case 'serif':
      return `${SERIF_FONT_STACK}, ${OPEN_SANS_STACK}`
    case 'monospace':
      return `${MONOSPACE_FONT_STACK}, ${OPEN_SANS_STACK}`
    case 'open-sans':
      return OPEN_SANS_STACK
  }
}

export function resolveEditorLineWidthStyleValue(editorLineWidth: string) {
  const normalized = normalizeEditorLineWidth(editorLineWidth)
  return normalized ? `calc(100px + ${normalized})` : undefined
}

export function getEditorStyleVars(settings: AppearanceTextSettings) {
  const editorLineWidth = resolveEditorLineWidthStyleValue(settings.editorLineWidth)
  return editorLineWidth ? { '--editor-area-width': editorLineWidth } : {}
}
