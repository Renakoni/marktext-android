import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_EDITING_SETTINGS, type EditingSettings } from '../settings/editingSettings'
import { applyMuyaEditingSettings, type MuyaEditor } from './editorRuntime'

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
