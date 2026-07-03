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

interface CreateMuyaEditorOptions {
  element: HTMLElement
  markdown: string
  onContentChange: (...args: unknown[]) => void
  onJsonChange: (...args: unknown[]) => void
  onFocus: (...args: unknown[]) => void
  onBlur: (...args: unknown[]) => void
  appLocale?: string
  appearanceTextSettings?: AppearanceTextSettings
  editingSettings?: EditingSettings
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
  const editorPlugins = [
    core.InlineFormatToolbar,
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

function resolveMuyaLocale(core: MuyaCoreModule, appLocale = 'en') {
  return appLocale === 'zh-CN' ? core.zhCN : core.en
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
  const editor = new Muya(element, {
    markdown,
    ...getMuyaAppearanceOptions(appearanceTextSettings),
    ...(editingSettings ? getMuyaEditingOptions(editingSettings) : {}),
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
}

export function destroyMuyaEditor(editor: MuyaEditor | null) {
  editor?.destroy()
}
