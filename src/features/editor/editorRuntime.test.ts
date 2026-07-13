// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_EDITING_SETTINGS, type EditingSettings } from '../settings/editingSettings'
import {
  applyMuyaEditingSettings,
  createMuyaEditor,
  resolveMuyaLocale,
  type MuyaEditor,
} from './editorRuntime'

// A fake Muya that registers a document-level listener during construction (the
// clipboard/selection globals the real Muya installs) and throws from init(),
// to prove createMuyaEditor disposes a partially-initialized instance instead
// of leaking global handlers on a failed init.
const { FakeMuya, muyaInstances, muyaGlobalListenerCount } = vi.hoisted(() => {
  const muyaInstances: { destroyed: boolean }[] = []
  const state = { listeners: 0 }
  const globalHandler = () => {}

  class FakeMuya {
    static plugins: { plugin: unknown }[] = []
    static use(plugin: unknown) {
      FakeMuya.plugins.push({ plugin })
    }

    destroyed = false

    constructor() {
      muyaInstances.push(this)
      document.addEventListener('copy', globalHandler)
      state.listeners += 1
    }

    init() {
      throw new Error('Muya init failed after registering global listeners')
    }

    on() {}

    destroy() {
      this.destroyed = true
      document.removeEventListener('copy', globalHandler)
      state.listeners -= 1
    }
  }

  return { FakeMuya, muyaInstances, muyaGlobalListenerCount: () => state.listeners }
})

vi.mock('@muyajs/core', () => ({
  Muya: FakeMuya,
  PreviewToolBar: { name: 'PreviewToolBar' },
  CodeBlockLanguageSelector: { name: 'CodeBlockLanguageSelector' },
  EmojiSelector: { name: 'EmojiSelector' },
  en: { resource: {} },
  zhCN: { resource: {} },
}))

const fakeCore = {
  en: {
    name: 'en',
    resource: { 'Type / to insert...': 'Type / to insert...', 'Untouched': 'Untouched' },
  },
  zhCN: {
    name: 'zh-CN',
    resource: { 'Type / to insert...': '输入 / 插入段落', 'Untouched': '未动' },
  },
} as unknown as Parameters<typeof resolveMuyaLocale>[0]

describe('editorRuntime locale', () => {
  it('replaces the hint that advertises the unregistered quick-insert menu', () => {
    const en = resolveMuyaLocale(fakeCore, 'en')
    expect(en.resource['Type / to insert...']).toBe('Start writing...')
    expect(en.resource['Untouched']).toBe('Untouched')

    const zh = resolveMuyaLocale(fakeCore, 'zh-CN')
    expect(zh.resource['Type / to insert...']).toBe('开始书写…')
    expect(zh.resource['Type / to insert...']).not.toContain('/')

    // Unknown app locales fall back to the English base and English hint.
    const fallback = resolveMuyaLocale(fakeCore, 'fr')
    expect(fallback.name).toBe('en')
    expect(fallback.resource['Type / to insert...']).toBe('Start writing...')
  })

  it('never mutates the shared vendored locale objects', () => {
    resolveMuyaLocale(fakeCore, 'en')
    resolveMuyaLocale(fakeCore, 'zh-CN')

    expect(fakeCore.en.resource['Type / to insert...']).toBe('Type / to insert...')
    expect(fakeCore.zhCN.resource['Type / to insert...']).toBe('输入 / 插入段落')
  })
})

describe('editorRuntime editing settings', () => {
  it('applies Editing updates through Muya options without reading or saving markdown', () => {
    const attributes = new Map<string, string>()
    const editor = {
      domNode: {
        getAttribute: (name: string) => attributes.get(name) ?? null,
        setAttribute: (name: string, value: string) => {
          attributes.set(name, value)
        },
      },
      getMarkdown: vi.fn(),
      setOptions: vi.fn(),
      setListIndentation: vi.fn(),
    } as unknown as MuyaEditor
    const next: EditingSettings = {
      ...DEFAULT_EDITING_SETTINGS,
      autoPairQuote: false,
      isHtmlEnabled: false,
      listIndentation: 2,
      spellcheckerLanguage: 'de-DE',
    }

    applyMuyaEditingSettings(editor, next, DEFAULT_EDITING_SETTINGS)

    expect(editor.setOptions).toHaveBeenNthCalledWith(
      1,
      { autoPairQuote: false },
      false,
    )
    expect(editor.setListIndentation).toHaveBeenCalledWith(2)
    expect(editor.setOptions).toHaveBeenNthCalledWith(
      2,
      { disableHtml: true },
      true,
    )
    expect(editor.domNode.getAttribute('lang')).toBe('de-DE')
    expect(editor.getMarkdown).not.toHaveBeenCalled()
  })
})

describe('createMuyaEditor', () => {
  it('disposes a Muya instance that fails to finish initializing so its globals do not leak', async () => {
    await expect(
      createMuyaEditor({
        element: document.createElement('div'),
        markdown: '# hi',
        onContentChange: vi.fn(),
        onJsonChange: vi.fn(),
        onFocus: vi.fn(),
        onBlur: vi.fn(),
        appLocale: 'en',
      }),
    ).rejects.toThrow('Muya init failed')

    // The provisional instance was constructed (registering a global listener),
    // then disposed, releasing it — so a persistent failure or repeated Retry
    // cannot accumulate stale editors or document-level handlers.
    expect(muyaInstances).toHaveLength(1)
    expect(muyaInstances[0].destroyed).toBe(true)
    expect(muyaGlobalListenerCount()).toBe(0)
  })
})
