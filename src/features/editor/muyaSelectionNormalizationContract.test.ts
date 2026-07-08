import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readTextSelectionSource() {
  return readFileSync(
    resolve('third_party/muya/src/selection/TextSelection.ts'),
    'utf8',
  )
}

describe('Muya mobile caret normalization contract', () => {
  it('listens for document selectionchange and normalizes foreign carets', () => {
    const source = readTextSelectionSource()

    expect(source).toContain("attachDOMEvent(this._doc, 'selectionchange'")
    expect(source).toContain('_normalizeForeignCaret()')
  })

  it('only rewrites collapsed carets that sit outside a content span', () => {
    const source = readTextSelectionSource()
    const methodStart = source.indexOf('private _normalizeForeignCaret()')
    expect(methodStart).toBeGreaterThanOrEqual(0)
    const methodEnd = source.indexOf('private _findNearestContentTarget', methodStart)
    const body = source.slice(methodStart, methodEnd)

    expect(body).toContain('!selection.isCollapsed')
    expect(body).toContain('this._muya.domNode.contains(anchorNode)')
    expect(body).toContain('findContentDOM(anchorNode)')
    expect(body).toContain('block.setCursor(offset, offset)')
  })
})
