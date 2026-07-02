import { describe, expect, it } from 'vitest'
import {
  buildMarkdownImage,
  buildMarkdownLink,
  normalizeLinkField,
} from './editorMarkdownInsert'

describe('editorMarkdownInsert', () => {
  it('normalizes selected link text for the mobile insert sheet', () => {
    expect(normalizeLinkField('  MarkText\n  for\tAndroid  ')).toBe('MarkText for Android')
  })

  it('escapes Markdown link text and URL delimiters', () => {
    expect(buildMarkdownLink('MarkText [Android]', 'https://example.com/a)b')).toBe(
      '[MarkText \\[Android\\]](https://example.com/a\\)b)',
    )
  })

  it('uses the URL as link text when the label is empty', () => {
    expect(buildMarkdownLink('', ' https://example.com/docs ')).toBe(
      '[https://example.com/docs](https://example.com/docs)',
    )
  })

  it('builds image Markdown with a single-line escaped alt label', () => {
    expect(buildMarkdownImage('Picked\nicon]', 'marktext-image://local/icon.png')).toBe(
      '![Picked icon\\]](marktext-image://local/icon.png)',
    )
  })
})
