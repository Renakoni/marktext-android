import {
  resolveEditorFontFamily,
  type AppearanceTextSettings,
} from '../settings/appearanceSettings'
import {
  getMuyaEditingOptions,
  getMuyaEditingRuntimeUpdates,
  type EditingSettings,
  type SpellcheckerLanguage,
} from '../settings/editingSettings'

type MuyaCoreModule = typeof import('@muyajs/core')

export type MuyaEditor = InstanceType<MuyaCoreModule['Muya']>

interface EditorRuntimeLogger {
  debug(message: string, context?: Record<string, unknown>): void
  info?(message: string, context?: Record<string, unknown>): void
}

export interface CreateMuyaEditorOptions {
  element: HTMLElement
  markdown: string
  onContentChange: (...args: unknown[]) => void
  onJsonChange: (...args: unknown[]) => void
  onFocus: (...args: unknown[]) => void
  onBlur: (...args: unknown[]) => void
  appLocale?: string
  appearanceTextSettings?: AppearanceTextSettings
  editingSettings?: EditingSettings
  clipboardText?: () => Promise<string>
  isStale?: () => boolean
  logger?: EditorRuntimeLogger
}

let muyaCore: MuyaCoreModule | null = null

async function loadMuyaCore() {
  if (!muyaCore) {
    muyaCore = await import('@muyajs/core')
  }

  return muyaCore
}

async function registerMuyaPlugins(logger?: EditorRuntimeLogger) {
  const core = await loadMuyaCore()
  // InlineFormatToolbar is intentionally not registered: it is a desktop
  // mouse-selection format popup and competes with the MarkText mobile
  // selection toolbar for the same selection surface.
  const editorPlugins = [
    core.PreviewToolBar,
    core.CodeBlockLanguageSelector,
    core.EmojiSelector,
  ] as const

  logger?.debug('register Muya plugins start', { count: editorPlugins.length })
  for (const plugin of editorPlugins) {
    if (!core.Muya.plugins.some(entry => entry.plugin === plugin)) {
      core.Muya.use(plugin)
    }
  }
  logger?.debug('register Muya plugins complete', { registered: core.Muya.plugins.length })

  return core
}

// The stock Muya empty-paragraph hint advertises the "/" quick-insert menu,
// whose plugin is deliberately not registered on Android: the toolbar is the
// insert surface, and "/" sits behind the symbols layer on touch keyboards.
// Never promise an interaction that does not exist — swap the hint at the
// locale boundary so vendored Muya stays untouched. Revisit only if a
// curated, touch-adapted quick-insert menu ships (see todolist).
const EMPTY_PARAGRAPH_HINTS: Record<string, string> = {
  'en': 'Start writing...',
  'zh-CN': '开始书写…',
}

export function resolveMuyaLocale(core: MuyaCoreModule, appLocale = 'en') {
  const base = appLocale === 'zh-CN' ? core.zhCN : core.en
  const resource: Record<string, string> = {
    ...base.resource,
    'Type / to insert...': EMPTY_PARAGRAPH_HINTS[appLocale] ?? EMPTY_PARAGRAPH_HINTS['en'],
  }

  return { ...base, resource }
}

function getMuyaAppearanceOptions(settings?: AppearanceTextSettings) {
  if (!settings) {
    return {}
  }

  return {
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    editorFontFamily: resolveEditorFontFamily(settings.editorFontFamily),
  }
}

export function applyMuyaAppearanceSettings(
  editor: MuyaEditor | null,
  settings: AppearanceTextSettings,
) {
  editor?.setOptions(getMuyaAppearanceOptions(settings))
}

function applyMuyaSpellcheckLanguage(editor: MuyaEditor, language: SpellcheckerLanguage) {
  editor.domNode.setAttribute('lang', language)
}

export function applyMuyaEditingSettings(
  editor: MuyaEditor | null,
  settings: EditingSettings,
  previousSettings?: EditingSettings,
) {
  if (!editor) {
    return
  }

  for (const update of getMuyaEditingRuntimeUpdates(settings, previousSettings)) {
    if (update.kind === 'setOptions') {
      editor.setOptions(update.options, update.forceRender)
    } else if (update.kind === 'setListIndentation') {
      editor.setListIndentation(update.listIndentation)
    } else {
      applyMuyaSpellcheckLanguage(editor, update.language)
    }
  }
}

export async function applyMuyaEditorLocale(
  editor: MuyaEditor | null,
  appLocale: string,
  logger?: EditorRuntimeLogger,
) {
  if (!editor) {
    return
  }

  const core = await loadMuyaCore()
  editor.locale(resolveMuyaLocale(core, appLocale))
  logger?.debug('Muya locale applied', { appLocale })
}

export async function createMuyaEditor({
  element,
  markdown,
  onContentChange,
  onJsonChange,
  onFocus,
  onBlur,
  appLocale,
  appearanceTextSettings,
  editingSettings,
  clipboardText,
  isStale,
  logger,
}: CreateMuyaEditorOptions) {
  const core = await registerMuyaPlugins(logger)
  const { Muya } = core
  if (isStale?.()) {
    return null
  }

  logger?.info?.('Muya init start', {
    initialCharacters: markdown.length,
  })
  let editor: MuyaEditor | null = null
  try {
    editor = new Muya(element, {
      markdown,
      ...getMuyaAppearanceOptions(appearanceTextSettings),
      ...(editingSettings ? getMuyaEditingOptions(editingSettings) : {}),
      ...(clipboardText ? { clipboardText } : {}),
      frontMatter: true,
      math: true,
      locale: resolveMuyaLocale(core, appLocale),
    })

    editor.init()
    if (editingSettings) {
      applyMuyaSpellcheckLanguage(editor, editingSettings.spellcheckerLanguage)
    }
    editor.on('content-change', onContentChange)
    editor.on('json-change', onJsonChange)
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)

    return editor
  } catch (error) {
    // A Muya instance that constructed but then failed to finish initializing
    // (init(), spellcheck, event wiring) has already registered document-level
    // listeners (clipboard, selection) and may have appended plugin nodes to
    // document.body. Dispose it so a persistent failure or repeated Retry does
    // not accumulate stale global handlers and orphaned DOM. (A throw from
    // inside the Muya constructor itself still leaks its own partial side
    // effects — that needs a rollback-safe boundary in vendored Muya and is out
    // of scope here.)
    editor?.destroy()
    throw error
  }
}

export function destroyMuyaEditor(editor: MuyaEditor | null) {
  editor?.destroy()
}
