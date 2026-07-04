import { reactive, readonly } from 'vue'

export type SettingsValue = boolean | number | string

const SETTINGS_STORAGE_KEY = 'marktext-for-android:settings-ui'
const settingsValues = reactive<Record<string, SettingsValue>>({})

let loaded = false

function isSettingsValue(value: unknown): value is SettingsValue {
  return ['boolean', 'number', 'string'].includes(typeof value)
}

function loadSettings() {
  if (loaded || typeof window === 'undefined') {
    loaded = true
    return
  }

  loaded = true

  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return
    }

    for (const [key, value] of Object.entries(parsed)) {
      if (isSettingsValue(value)) {
        settingsValues[key] = value
      }
    }
  } catch {
    // Settings controls are front-end-only for now; failed persistence must not break Settings.
  }
}

function saveSettings() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsValues))
  } catch {
    // Keep the current session interactive even if storage is unavailable.
  }
}

function clearSettings() {
  for (const key of Object.keys(settingsValues)) {
    delete settingsValues[key]
  }

  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(SETTINGS_STORAGE_KEY)
  } catch {
    // Resetting settings should leave the current session usable even if storage fails.
  }
}

export function useSettingsState() {
  loadSettings()

  function getValue<T extends SettingsValue>(key: string, defaultValue: T): T {
    const value = settingsValues[key]
    return isSettingsValue(value) ? (value as T) : defaultValue
  }

  function setValue(key: string, value: SettingsValue) {
    settingsValues[key] = value
    saveSettings()
  }

  return {
    values: readonly(settingsValues),
    getValue,
    setValue,
    clearSettings,
  }
}
