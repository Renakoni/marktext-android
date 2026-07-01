import { describe, expect, it } from 'vitest'
import { createMuyaMobileEditorCommandTarget } from './muyaMobileAdapter'

describe('muyaMobileAdapter', () => {
  it('uses upstream Muya public command methods', () => {
    const calls: string[] = []
    const editor = {
      undo: () => {
        calls.push('undo')
      },
      redo: () => {
        calls.push('redo')
      },
      format: (type: string) => {
        calls.push(`format:${type}`)
      },
      updateParagraph: (type: string) => {
        calls.push(`paragraph:${type}`)
      },
    }
    const target = createMuyaMobileEditorCommandTarget(editor)

    target.undo()
    target.redo()
    target.format('strong')
    target.updateParagraph('heading 1')

    expect(calls).toEqual(['undo', 'redo', 'format:strong', 'paragraph:heading 1'])
  })

  it('preserves the upstream Muya instance as command context', () => {
    const editor = {
      format(this: { marker: string }, type: string) {
        return `${this.marker}:${type}`
      },
      marker: 'muya',
    }
    const target = createMuyaMobileEditorCommandTarget(editor)

    expect(target.format('strong')).toBe('muya:strong')
  })

  it('reports missing upstream command methods as unsupported', () => {
    const target = createMuyaMobileEditorCommandTarget({})

    expect(target.format('em')).toBe(false)
    expect(target.updateParagraph('heading 2')).toBe(false)
  })
})
