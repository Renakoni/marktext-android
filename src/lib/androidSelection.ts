import { Capacitor, registerPlugin } from '@capacitor/core'

interface AndroidSelectionState {
  suppressed: boolean
  hookInstalled: boolean
  suppressedCreateCount: number
  suppressedStartCount: number
  allowedCreateCount: number
  allowedStartCount: number
  finishCount: number
  activeModeClass?: string
  activeModeType?: number
  activeModeMenuSize?: number
  nativeEvents: string
}

interface AndroidSelectionPlugin {
  setEditorSelectionActionModeSuppressed(options: {
    suppressed: boolean
    reason?: string
  }): Promise<AndroidSelectionState>
  getEditorSelectionActionModeState(): Promise<AndroidSelectionState>
  finishEditorSelectionActionMode(options: { reason?: string }): Promise<{ finished?: boolean }>
  performNativeSelectAll(options: { reason?: string }): Promise<{ performed?: boolean }>
  readClipboardText(): Promise<{ text?: string; available?: boolean }>
  writeClipboardText(options: { text: string; label?: string }): Promise<{ written?: boolean }>
  addListener(
    eventName: 'selectionTap',
    listener: (event: AndroidSelectionTapEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>
  addListener(
    eventName: 'selectionContextRequest',
    listener: () => void,
  ): Promise<{ remove: () => Promise<void> }>
}

export interface AndroidSelectionTapEvent {
  x: number
  y: number
}

export interface AndroidSelectionControlResult extends AndroidSelectionState {
  native: boolean
}

export const AndroidSelection = registerPlugin<AndroidSelectionPlugin>('AndroidSelection')

export function shouldUseAndroidSelectionControl(platform: string, isNativePlatform: boolean) {
  return platform === 'android' && isNativePlatform
}

export function isAndroidSelectionControlAvailable() {
  return shouldUseAndroidSelectionControl(Capacitor.getPlatform(), Capacitor.isNativePlatform())
}

export async function setAndroidEditorSelectionMenuSuppressed(
  suppressed: boolean,
  reason = 'unspecified',
): Promise<AndroidSelectionControlResult> {
  if (!isAndroidSelectionControlAvailable()) {
    return createUnavailableState()
  }

  return {
    ...(await AndroidSelection.setEditorSelectionActionModeSuppressed({ suppressed, reason })),
    native: true,
  }
}

export async function getAndroidEditorSelectionMenuState(): Promise<AndroidSelectionControlResult> {
  if (!isAndroidSelectionControlAvailable()) {
    return createUnavailableState()
  }

  return {
    ...(await AndroidSelection.getEditorSelectionActionModeState()),
    native: true,
  }
}

export async function finishAndroidEditorSelectionActionMode(
  reason = 'unspecified',
): Promise<boolean> {
  if (!isAndroidSelectionControlAvailable()) {
    return false
  }

  try {
    const result = await AndroidSelection.finishEditorSelectionActionMode({ reason })
    return Boolean(result.finished)
  } catch {
    return false
  }
}

// Native select-all keeps Chromium's touch-selection session alive, so the
// system drag handles show up; a JS range replacement never produces them.
export async function performAndroidNativeSelectAll(reason = 'unspecified'): Promise<boolean> {
  if (!isAndroidSelectionControlAvailable()) {
    return false
  }

  try {
    const result = await AndroidSelection.performNativeSelectAll({ reason })
    return Boolean(result.performed)
  } catch {
    return false
  }
}

export async function readAndroidClipboardText(): Promise<string> {
  if (!isAndroidSelectionControlAvailable()) {
    return ''
  }

  try {
    const result = await AndroidSelection.readClipboardText()
    return result.text ?? ''
  } catch {
    return ''
  }
}

export async function writeAndroidClipboardText(text: string): Promise<boolean> {
  if (!isAndroidSelectionControlAvailable()) {
    return false
  }

  try {
    const result = await AndroidSelection.writeClipboardText({ text })
    return Boolean(result.written)
  } catch {
    return false
  }
}

function createUnavailableState(): AndroidSelectionControlResult {
  return {
    native: false,
    suppressed: false,
    hookInstalled: false,
    suppressedCreateCount: 0,
    suppressedStartCount: 0,
    allowedCreateCount: 0,
    allowedStartCount: 0,
    finishCount: 0,
    activeModeClass: undefined,
    activeModeType: undefined,
    activeModeMenuSize: undefined,
    nativeEvents: '',
  }
}

// MIUI can consume taps that land inside an active native selection before
// the page sees any touch event, so the WebView reports qualifying taps from
// onTouchEvent through this native listener instead.
export async function addAndroidSelectionTapListener(
  listener: (event: AndroidSelectionTapEvent) => void,
): Promise<(() => Promise<void>) | null> {
  if (!isAndroidSelectionControlAvailable()) {
    return null
  }

  try {
    const handle = await AndroidSelection.addListener('selectionTap', listener)
    return () => handle.remove()
  } catch {
    return null
  }
}

// Fired when the suppressed floating ActionMode starts — the exact moment
// Android would have shown its own clipboard menu (long-press selection,
// double-tap word select, insertion-caret menu).
export async function addAndroidSelectionContextListener(
  listener: () => void,
): Promise<(() => Promise<void>) | null> {
  if (!isAndroidSelectionControlAvailable()) {
    return null
  }

  try {
    const handle = await AndroidSelection.addListener('selectionContextRequest', listener)
    return () => handle.remove()
  } catch {
    return null
  }
}
