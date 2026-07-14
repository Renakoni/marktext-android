import { readonly, ref } from 'vue'
import { en, type I18nKey } from './locales/en'
import { zhCN } from './locales/zh-CN'
import { zhTW } from './locales/zh-TW'
import { de } from './locales/de'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { ja } from './locales/ja'
import { ko } from './locales/ko'
import { pt } from './locales/pt'
import { tr } from './locales/tr'

export type { I18nKey }

const APP_LOCALES = Object.freeze({
  EN: 'en',
  ZH_CN: 'zh-CN',
  ZH_TW: 'zh-TW',
  DE: 'de',
  ES: 'es',
  FR: 'fr',
  JA: 'ja',
  KO: 'ko',
  PT: 'pt',
  TR: 'tr',
} as const)

export type AppLocale = (typeof APP_LOCALES)[keyof typeof APP_LOCALES]
export const AUTO_APP_LOCALE = 'auto' as const
export type AppLocalePreference = typeof AUTO_APP_LOCALE | AppLocale

const DEFAULT_APP_LOCALE: AppLocale = APP_LOCALES.EN
const APP_LOCALE_STORAGE_KEY = 'marktext-for-android:locale'
const SUPPORTED_APP_LOCALES = Object.values(APP_LOCALES)

const MESSAGES: Record<AppLocale, Record<I18nKey, string>> = {
  [APP_LOCALES.EN]: en,
  [APP_LOCALES.ZH_CN]: zhCN,
  [APP_LOCALES.ZH_TW]: zhTW,
  [APP_LOCALES.DE]: de,
  [APP_LOCALES.ES]: es,
  [APP_LOCALES.FR]: fr,
  [APP_LOCALES.JA]: ja,
  [APP_LOCALES.KO]: ko,
  [APP_LOCALES.PT]: pt,
  [APP_LOCALES.TR]: tr,
}

const KNOWN_TEXT_MESSAGE_KEYS = {
  Ready: 'app.status.ready',
  Edited: 'app.status.edited',
  'Autosaving locally': 'app.status.autosavingLocally',
  'Autosaved locally': 'app.status.autosavedLocally',
  'Autosave failed': 'app.status.autosaveFailed',
  'Editor failed': 'app.status.editorFailed',
  'Read only': 'app.status.readOnly',
  Editing: 'app.status.editing',
  'Save failed': 'app.status.saveFailed',
  Saving: 'app.status.saving',
  Saved: 'app.status.saved',
  'Choose a location': 'app.status.chooseLocation',
  Sharing: 'app.status.sharing',
  'Exporting PDF': 'app.status.exportingPdf',
  'Opened temporarily': 'app.status.openedTemporarily',
  'Share sheet opened': 'app.status.shareSheetOpened',
  'Saved to device. Kept local draft because Android did not grant long-term access.':
    'app.notice.transientAndroidSave',
  'Saved to device. Reopen it from Android to keep editing later.':
    'app.notice.transientAndroidSaveWithoutDraft',
  'Opened with temporary Android access. Save a copy to keep editing later.':
    'app.notice.openWithTemporaryAccess',
  'Opened from Android share with temporary access. Save a copy to keep editing later.':
    'app.notice.shareTemporaryAccess',
  'Imported shared text as a local draft.': 'app.notice.sharedTextImported',
  'Save failed. A local recovery draft was kept.': 'app.notice.androidSaveRecovery',
  'Unsaved changes were kept as a recovery draft.': 'app.notice.androidExitRecovery',
  'Unsaved changes were discarded.': 'app.notice.androidExitDiscard',
  'Open Markdown files from the Android app build.': 'android.message.openFromAppBuild',
  'Choose a Markdown or plain text file.': 'android.message.chooseMarkdown',
  'Open a Markdown file.': 'android.message.openMarkdown',
  'This Android open-with request is not supported.': 'android.message.openWithUnsupported',
  'Share Markdown text or a Markdown file.': 'android.message.shareMarkdown',
  'This Android share request is not supported.': 'android.message.shareUnsupported',
  'This Android share did not provide a supported file URI.': 'android.message.shareMissingUri',
  'This Android share did not include Markdown content.': 'android.message.shareMissingContent',
  'No Android share target is available.': 'android.message.noShareTarget',
  'Could not prepare this Markdown file for sharing.': 'android.message.sharePrepareFailed',
  'Could not export this document as a PDF.': 'android.message.pdfExportFailed',
  'Could not prepare the PDF file for sharing.': 'android.message.pdfPrepareFailed',
  'This Markdown file is larger than the current 5 MB limit.': 'android.message.markdownTooLarge',
  'This recent file can no longer be opened.': 'android.message.recentGone',
  'This file was moved or deleted. Open it again from Android.': 'android.message.fileMoved',
  'Reopen this file from Android before saving again.': 'android.message.permissionLost',
  'Enter a name for this file.': 'android.message.renameNameRequired',
  'This file’s storage location does not support renaming.': 'android.message.renameUnsupported',
  'Could not rename this Markdown file.': 'android.message.renameFailed',
  'Renamed, but Android only kept temporary access. Reopen it from Android to add it back to Recents.':
    'app.notice.renameTemporaryAccess',
  'Could not read this Markdown file.': 'android.message.readFailed',
  'This file is read-only.': 'android.message.readOnly',
  'Could not save this Markdown file.': 'android.message.saveFailed',
  'This text encoding is not available on this device.': 'android.message.encodingUnsupported',
  'Could not read or save this file with the selected encoding.': 'android.message.encodingFailed',
  'Could not create a Markdown file on this device.': 'android.message.createFailed',
  'Could not open this Markdown file.': 'android.message.openFailed',
  'Insert images from the Android app build.': 'android.image.fromAppBuild',
  'No Android image picker is available.': 'android.image.noPicker',
  'Choose a JPEG, PNG, GIF, WebP, or SVG image.': 'android.image.unsupportedType',
  'This image is larger than the current 15 MB limit.': 'android.image.tooLarge',
  'This image was moved or deleted.': 'android.image.moved',
  'Choose this image again from Android.': 'android.image.permissionLost',
  'Could not import this image.': 'android.image.importFailed',
  'Could not insert this image.': 'android.image.insertFailed',
} as const satisfies Record<string, I18nKey>

export const APP_LANGUAGE_OPTIONS = [
  {
    id: APP_LOCALES.EN,
    labelKey: 'settings.language.english',
  },
  {
    id: APP_LOCALES.ZH_CN,
    labelKey: 'settings.language.chineseSimplified',
  },
  {
    id: APP_LOCALES.ZH_TW,
    labelKey: 'settings.language.chineseTraditional',
  },
  {
    id: APP_LOCALES.DE,
    labelKey: 'settings.language.german',
  },
  {
    id: APP_LOCALES.ES,
    labelKey: 'settings.language.spanish',
  },
  {
    id: APP_LOCALES.FR,
    labelKey: 'settings.language.french',
  },
  {
    id: APP_LOCALES.JA,
    labelKey: 'settings.language.japanese',
  },
  {
    id: APP_LOCALES.KO,
    labelKey: 'settings.language.korean',
  },
  {
    id: APP_LOCALES.PT,
    labelKey: 'settings.language.portuguese',
  },
  {
    id: APP_LOCALES.TR,
    labelKey: 'settings.language.turkish',
  },
] as const satisfies readonly {
  id: AppLocale
  labelKey: I18nKey
}[]

function isAppLocale(value: unknown): value is AppLocale {
  return SUPPORTED_APP_LOCALES.includes(value as AppLocale)
}

function getSystemLanguages() {
  if (typeof navigator === 'undefined') {
    return []
  }
  return navigator.languages?.length > 0
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : []
}

export function resolveSystemLocale(languages: readonly string[]): AppLocale {
  for (const language of languages) {
    const normalized = language.replaceAll('_', '-').toLowerCase()
    const exactLocale = SUPPORTED_APP_LOCALES.find(locale => locale.toLowerCase() === normalized)
    if (exactLocale) {
      return exactLocale
    }

    const [baseLanguage, ...subtags] = normalized.split('-')
    if (baseLanguage === 'zh') {
      if (subtags.includes('hant')) {
        return APP_LOCALES.ZH_TW
      }
      if (subtags.includes('hans')) {
        return APP_LOCALES.ZH_CN
      }
      return subtags.some(subtag => ['tw', 'hk', 'mo'].includes(subtag))
        ? APP_LOCALES.ZH_TW
        : APP_LOCALES.ZH_CN
    }

    const baseLocale = SUPPORTED_APP_LOCALES.find(locale => locale === baseLanguage)
    if (baseLocale) {
      return baseLocale
    }
  }

  return DEFAULT_APP_LOCALE
}

function resolveLocalePreference(preference: AppLocalePreference) {
  return preference === AUTO_APP_LOCALE
    ? resolveSystemLocale(getSystemLanguages())
    : preference
}

function getStoredLocalePreference(): AppLocalePreference {
  if (typeof window === 'undefined') {
    return AUTO_APP_LOCALE
  }

  try {
    const storedLocale = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY)
    return storedLocale === AUTO_APP_LOCALE || isAppLocale(storedLocale)
      ? storedLocale
      : AUTO_APP_LOCALE
  } catch {
    return AUTO_APP_LOCALE
  }
}

function writeStoredLocalePreference(nextPreference: AppLocalePreference) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, nextPreference)
  } catch {
    // Changing language should still work for the current session if storage is unavailable.
  }
}

function applyDocumentLocale(nextLocale: AppLocale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = nextLocale
  }
}

function interpolate(message: string, params: Record<string, string | number> = {}) {
  return message.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  )
}

const appLocalePreference = ref<AppLocalePreference>(getStoredLocalePreference())
const appLocale = ref<AppLocale>(resolveLocalePreference(appLocalePreference.value))
applyDocumentLocale(appLocale.value)

function setAppLocalePreference(nextPreference: AppLocalePreference) {
  appLocalePreference.value = nextPreference
  appLocale.value = resolveLocalePreference(nextPreference)
  writeStoredLocalePreference(nextPreference)
  applyDocumentLocale(appLocale.value)
}

function setAppLocale(nextLocale: AppLocale) {
  setAppLocalePreference(nextLocale)
}

if (typeof window !== 'undefined') {
  window.addEventListener('languagechange', () => {
    if (appLocalePreference.value === AUTO_APP_LOCALE) {
      appLocale.value = resolveLocalePreference(AUTO_APP_LOCALE)
      applyDocumentLocale(appLocale.value)
    }
  })
}

function t(key: I18nKey, params?: Record<string, string | number>) {
  const message = MESSAGES[appLocale.value][key] ?? MESSAGES[DEFAULT_APP_LOCALE][key]
  return interpolate(message, params)
}

export function translateKnownText(message: string) {
  const key = (KNOWN_TEXT_MESSAGE_KEYS as Partial<Record<string, I18nKey>>)[message]
  return key ? t(key) : message
}

export function useI18n() {
  return {
    locale: readonly(appLocale),
    localePreference: readonly(appLocalePreference),
    setLocale: setAppLocale,
    setLocalePreference: setAppLocalePreference,
    t,
  }
}
