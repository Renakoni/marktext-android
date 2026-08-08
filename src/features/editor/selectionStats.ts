const RENDERED_PREVIEW_SELECTOR = '.mu-math-render, .mu-ruby-render'

interface RangeLike {
  commonAncestorContainer: Node
  intersectsNode(node: Node): boolean
  cloneContents(): DocumentFragment
}

export interface SelectionLike {
  isCollapsed: boolean
  rangeCount: number
  anchorNode: Node | null
  focusNode: Node | null
  getRangeAt(index: number): RangeLike
  toString(): string
}

/**
 * The selected text as the stats counter should see it (#199).
 *
 * Rendered math/ruby previews duplicate their source text in the DOM, so
 * a selection crossing one must be re-read from cloned fragments with
 * the previews removed. Cloning is proportional to the selection, so the
 * probe below decides WITHOUT cloning, keeping plain selections (every
 * frame of a handle drag) on the toString() fast path.
 *
 * Honest cost model (#204 review round 2): the probe is not free — it is
 * an engine-level selector test over the range's common-ancestor
 * subtree. On the no-preview path that is one querySelector() scan,
 * which early-exits on a match and materializes no NodeList; fragment
 * clones and NodeList allocations only happen once a preview is actually
 * present under the ancestor.
 */
export function getSelectionTextForStats(selection: SelectionLike, host: HTMLElement): string {
  if (selection.isCollapsed || selection.rangeCount === 0) {
    return ''
  }

  const { anchorNode, focusNode } = selection
  if (!anchorNode || !focusNode || !host.contains(anchorNode) || !host.contains(focusNode)) {
    return ''
  }

  const probe = probeRenderedPreviews(selection)
  if (probe === 'none') {
    return selection.toString()
  }
  if (probe === 'inside') {
    // The whole selection sits inside one preview: render output is not
    // document text, and its clone would lack the preview wrapper that
    // the strip below keys on. Count nothing.
    return ''
  }

  let text = ''
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const fragment = selection.getRangeAt(index).cloneContents()
    fragment.querySelectorAll(RENDERED_PREVIEW_SELECTOR).forEach(node => node.remove())
    text += fragment.textContent ?? ''
  }
  return text
}

function probeRenderedPreviews(selection: SelectionLike): 'none' | 'inside' | 'crosses' {
  let crosses = false

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    const container = range.commonAncestorContainer
    const scope = container instanceof Element ? container : container.parentElement
    if (!scope) {
      continue
    }

    // The whole range may sit inside one preview…
    if (scope.closest(RENDERED_PREVIEW_SELECTOR)) {
      return 'inside'
    }

    // …or span across previews below its common ancestor. Existence
    // first: querySelector early-exits on the first match and allocates
    // no NodeList, so the common no-preview case pays exactly one native
    // scan. Only when a preview exists does the full list materialize
    // for the intersection walk (preview counts are small in practice).
    const firstPreview = scope.querySelector(RENDERED_PREVIEW_SELECTOR)
    if (!firstPreview) {
      continue
    }
    if (range.intersectsNode(firstPreview)) {
      crosses = true
      continue
    }
    for (const preview of scope.querySelectorAll(RENDERED_PREVIEW_SELECTOR)) {
      if (range.intersectsNode(preview)) {
        crosses = true
        break
      }
    }
  }

  return crosses ? 'crosses' : 'none'
}
