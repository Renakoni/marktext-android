// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSelectionTextForStats, type SelectionLike } from './selectionStats'

afterEach(() => {
  vi.restoreAllMocks()
})

function buildHost(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

interface FakeRangeOptions {
  commonAncestorContainer: Node
  intersects?: (node: Node) => boolean
  cloneContents?: () => DocumentFragment
}

function fakeSelection(
  text: string,
  anchorNode: Node,
  focusNode: Node,
  ranges: FakeRangeOptions[],
): SelectionLike {
  return {
    isCollapsed: false,
    rangeCount: ranges.length,
    anchorNode,
    focusNode,
    getRangeAt: index => {
      const options = ranges[index]
      return {
        commonAncestorContainer: options.commonAncestorContainer,
        intersectsNode: node => options.intersects?.(node) ?? false,
        cloneContents: () => {
          if (!options.cloneContents) {
            throw new Error('cloneContents must not run on the fast path')
          }
          return options.cloneContents()
        },
      }
    },
    toString: () => text,
  }
}

describe('getSelectionTextForStats', () => {
  it('keeps plain selections on the toString fast path without cloning', () => {
    const host = buildHost('<p>alpha beta gamma</p>')
    const textNode = host.querySelector('p')!.firstChild!

    const selection = fakeSelection('alpha beta', textNode, textNode, [
      { commonAncestorContainer: textNode },
    ])

    // The fake range throws on cloneContents, so this passing IS the
    // proof that plain selections never pay for a fragment copy.
    expect(getSelectionTextForStats(selection, host)).toBe('alpha beta')
  })

  it('never materializes a NodeList on the no-preview path', () => {
    const host = buildHost('<p>alpha beta gamma</p>')
    const textNode = host.querySelector('p')!.firstChild!
    const queryAllSpy = vi.spyOn(Element.prototype, 'querySelectorAll')

    const selection = fakeSelection('alpha beta', textNode, textNode, [
      { commonAncestorContainer: host.querySelector('p')! },
    ])

    expect(getSelectionTextForStats(selection, host)).toBe('alpha beta')
    // The probe may run querySelector (early-exit, no list); the full
    // querySelectorAll walk is reserved for documents that actually
    // contain previews under the range's ancestor.
    expect(queryAllSpy).not.toHaveBeenCalled()
  })

  it('stays on the fast path when previews exist elsewhere in the block', () => {
    const host = buildHost(
      '<p><span class="plain">alpha</span><span class="mu-math-render">x^2</span></p>',
    )
    const plainText = host.querySelector('.plain')!.firstChild!

    const selection = fakeSelection('alpha', plainText, plainText, [
      // Common ancestor is the paragraph, which contains a preview — but
      // the range does not intersect it.
      { commonAncestorContainer: host.querySelector('p')!, intersects: () => false },
    ])

    expect(getSelectionTextForStats(selection, host)).toBe('alpha')
  })

  it('clones and strips previews when the range crosses one', () => {
    const host = buildHost(
      '<p>sum <span class="mu-math-render">KATEX OUTPUT</span><span class="mu-math">$x^2$</span> tail</p>',
    )
    const paragraph = host.querySelector('p')!

    const selection = fakeSelection('UNUSED', paragraph.firstChild!, paragraph.lastChild!, [
      {
        commonAncestorContainer: paragraph,
        intersects: node => (node as Element).classList?.contains('mu-math-render') ?? false,
        cloneContents: () => {
          const fragment = document.createDocumentFragment()
          const clone = paragraph.cloneNode(true) as Element
          fragment.append(...Array.from(clone.childNodes))
          return fragment
        },
      },
    ])

    expect(getSelectionTextForStats(selection, host)).toBe('sum $x^2$ tail')
  })

  it('counts nothing when the whole range sits inside a preview', () => {
    const host = buildHost(
      '<p><span class="mu-math-render"><span class="katex">x</span></span></p>',
    )
    const katex = host.querySelector('.katex')!

    const selection = fakeSelection('UNUSED', katex, katex, [
      // No cloneContents provided: render output is not document text,
      // so the inside-preview verdict must not clone anything either.
      { commonAncestorContainer: katex },
    ])

    expect(getSelectionTextForStats(selection, host)).toBe('')
  })

  it('ignores selections outside the editor host and collapsed selections', () => {
    const host = buildHost('<p>alpha</p>')
    const outside = document.createElement('p')
    outside.textContent = 'outside'
    document.body.appendChild(outside)

    const outsideSelection = fakeSelection('outside', outside.firstChild!, outside.firstChild!, [
      { commonAncestorContainer: outside },
    ])
    expect(getSelectionTextForStats(outsideSelection, host)).toBe('')

    const collapsed: SelectionLike = {
      isCollapsed: true,
      rangeCount: 1,
      anchorNode: host,
      focusNode: host,
      getRangeAt: () => {
        throw new Error('collapsed selections are never inspected')
      },
      toString: () => '',
    }
    expect(getSelectionTextForStats(collapsed, host)).toBe('')
  })
})
