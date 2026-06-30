import { describe, expect, it } from 'vitest'
import { createMuyaMobileEditorCommandTarget } from './muyaMobileAdapter'

describe('muyaMobileAdapter', () => {
  it('uses upstream Muya command methods when they are available', () => {
    const calls: string[] = []
    const target = createMuyaMobileEditorCommandTarget({
      format: (type: string) => {
        calls.push(`format:${type}`)
      },
      updateParagraph: (type: string) => {
        calls.push(`paragraph:${type}`)
      },
    })

    target.format('strong')
    target.updateParagraph('heading 1')

    expect(calls).toEqual(['format:strong', 'paragraph:heading 1'])
  })

  it('falls back to legacy active content block formatting', () => {
    const calls: string[] = []
    const target = createMuyaMobileEditorCommandTarget({
      editor: {
        activeContentBlock: {
          format: (type: string) => {
            calls.push(`format:${type}`)
          },
        },
      },
    })

    expect(target.format('em')).toBe(true)
    expect(calls).toEqual(['format:em'])
  })

  it('keeps the cursor inside a legacy block before converting it', () => {
    const calls: string[] = []
    const block = {
      text: 'Mobile heading',
      getCursor: () => null,
      setCursor: (begin: number, end: number, needUpdate?: boolean) => {
        calls.push(`cursor:${begin}:${end}:${String(needUpdate)}`)
      },
      _convertToAtxHeading: (marker: string) => {
        calls.push(`heading:${marker}:${block.text}`)
      },
    }
    const target = createMuyaMobileEditorCommandTarget({
      editor: {
        activeContentBlock: block,
      },
    })

    expect(target.updateParagraph('heading 2')).toBe(true)
    expect(calls).toEqual([
      'cursor:14:14:true',
      'heading:##:## Mobile heading',
    ])
  })
})
