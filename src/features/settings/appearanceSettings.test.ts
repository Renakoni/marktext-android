import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APPEARANCE_TEXT_SETTINGS,
  getAppearanceTextSettings,
  getEditorStyleVars,
  normalizeEditorLineWidth,
  resolveEditorFontFamily,
  resolveEditorLineWidthStyleValue,
} from './appearanceSettings'

describe('appearanceSettings', () => {
  it('uses MarkText typography defaults for the mobile editor', () => {
    const settings = getAppearanceTextSettings((_, defaultValue) => defaultValue)

    expect(settings).toEqual(DEFAULT_APPEARANCE_TEXT_SETTINGS)
    expect(resolveEditorFontFamily(settings.editorFontFamily)).toContain('Open Sans')
  })

  it('normalizes text setting values before applying them to runtime behavior', () => {
    const values = new Map<string, boolean | number | string>([
      ['fontSize', 99],
      ['lineHeight', 1.26],
      ['editorLineWidth', ' 72ch '],
      ['editorFontFamily', 'monospace'],
      ['textDirection', 'rtl'],
    ])
    const settings = getAppearanceTextSettings((key, defaultValue) =>
      values.has(key) ? (values.get(key) as typeof defaultValue) : defaultValue,
    )

    expect(settings).toEqual({
      fontSize: 32,
      lineHeight: 1.3,
      editorLineWidth: '72ch',
      editorFontFamily: 'monospace',
      textDirection: 'rtl',
    })
  })

  it('ignores invalid line width values instead of passing them to CSS', () => {
    expect(normalizeEditorLineWidth('wide')).toBe('')
    expect(normalizeEditorLineWidth('72rem')).toBe('')
    expect(resolveEditorLineWidthStyleValue('72ch')).toBe('calc(100px + 72ch)')
    expect(getEditorStyleVars({ ...DEFAULT_APPEARANCE_TEXT_SETTINGS, editorLineWidth: '72ch' }))
      .toEqual({ '--editor-area-width': 'calc(100px + 72ch)' })
  })

  it('maps font choices to complete CSS stacks with desktop fallbacks', () => {
    expect(resolveEditorFontFamily('system')).toContain('system-ui')
    expect(resolveEditorFontFamily('serif')).toContain('Georgia')
    expect(resolveEditorFontFamily('monospace')).toContain('DejaVu Sans Mono')
  })
})
