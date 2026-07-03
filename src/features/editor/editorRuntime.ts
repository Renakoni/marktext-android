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

export async function createMuyaEditor({
  element,
  markdown,
  onContentChange,
  onJsonChange,
  onFocus,
  onBlur,
  isStale,
  logger,
}: CreateMuyaEditorOptions) {
  const { Muya, en } = await registerMuyaPlugins(logger)
  if (isStale?.()) {
    return null
  }

  logger?.info?.('Muya init start', {
    initialCharacters: markdown.length,
  })
  const editor = new Muya(element, {
    markdown,
    fontSize: 16,
    lineHeight: 1.6,
    codeBlockLineNumbers: true,
    frontMatter: true,
    footnote: true,
    math: true,
    spellcheckEnabled: true,
    locale: en,
  })

  editor.init()
  editor.on('content-change', onContentChange)
  editor.on('json-change', onJsonChange)
  editor.on('focus', onFocus)
  editor.on('blur', onBlur)

  return editor
}

export function destroyMuyaEditor(editor: MuyaEditor | null) {
  editor?.destroy()
}
