// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import {
  createDocumentOutline,
  MAX_OUTLINE_INDENT,
  projectOutlineItems,
  resolveOutlineHeadingElement,
  waitForViewportSettle,
  TOP_LEVEL_HEADING_SELECTOR,
} from './documentOutline'
import type { MuyaEditor } from './editorRuntime'

describe('projectOutlineItems', () => {
  it('returns [] for an empty TOC', () => {
    expect(projectOutlineItems([])).toEqual([])
  })

  it('normalizes indentation from the lowest heading level present', () => {
    const items = projectOutlineItems([
      { content: 'Alpha', lvl: 3, slug: 'a', index: 0 },
      { content: 'Beta', lvl: 4, slug: 'b', index: 1 },
      { content: 'Gamma', lvl: 3, slug: 'c', index: 2 },
    ])

    expect(items.map(item => item.indent)).toEqual([0, 1, 0])
    expect(items.map(item => item.level)).toEqual([3, 4, 3])
  })

  it('caps deep hierarchies at MAX_OUTLINE_INDENT steps', () => {
    const items = projectOutlineItems([
      { content: 'H1', lvl: 1, slug: 'a', index: 0 },
      { content: 'H5', lvl: 5, slug: 'b', index: 1 },
      { content: 'H6', lvl: 6, slug: 'c', index: 2 },
    ])

    expect(items[1].indent).toBe(MAX_OUTLINE_INDENT)
    expect(items[2].indent).toBe(MAX_OUTLINE_INDENT)
  })

  it('keeps repeated headings in document order with distinct slugs', () => {
    const items = projectOutlineItems([
      { content: 'Foo', lvl: 2, slug: 'first', index: 0 },
      { content: 'Foo', lvl: 2, slug: 'second', index: 1 },
    ])

    expect(items).toHaveLength(2)
    expect(items[0].slug).toBe('first')
    expect(items[1].slug).toBe('second')
    expect(items[0].text).toBe('Foo')
  })
})

describe('resolveOutlineHeadingElement', () => {
  function buildEditorDom() {
    const root = document.createElement('div')
    root.innerHTML = `
      <div class="mu-container">
        <h1>Alpha</h1>
        <p>text</p>
        <blockquote><h2>Quoted heading (not in TOC)</h2></blockquote>
        <h2>Beta</h2>
        <ul><li><h3>Listed heading (not in TOC)</h3></li></ul>
        <h2>Beta</h2>
      </div>
    `
    return root
  }

  const toc = [
    { slug: 'alpha' },
    { slug: 'beta-1' },
    { slug: 'beta-2' },
  ]

  it('maps the flat TOC index onto top-level container headings only', () => {
    const root = buildEditorDom()

    const alpha = resolveOutlineHeadingElement(root, toc, 'alpha')
    const beta2 = resolveOutlineHeadingElement(root, toc, 'beta-2')

    expect(alpha?.textContent).toBe('Alpha')
    // The third TOC entry is the SECOND top-level "Beta" — nested headings
    // inside the blockquote and list must not shift the index.
    expect(beta2?.textContent).toBe('Beta')
    expect(root.querySelectorAll(TOP_LEVEL_HEADING_SELECTOR)).toHaveLength(3)
    expect(beta2).toBe(root.querySelectorAll(TOP_LEVEL_HEADING_SELECTOR)[2])
  })

  it('returns null for an unknown slug', () => {
    expect(resolveOutlineHeadingElement(buildEditorDom(), toc, 'missing')).toBeNull()
  })

  it('returns null when the DOM has fewer headings than the TOC snapshot', () => {
    const root = buildEditorDom()
    root.querySelectorAll('h2').forEach(el => el.remove())

    expect(resolveOutlineHeadingElement(root, toc, 'beta-2')).toBeNull()
  })
})

describe('waitForViewportSettle', () => {
  function createFakeViewport() {
    const listeners = new Set<() => void>()
    return {
      addEventListener: (_: 'resize', listener: () => void) => listeners.add(listener),
      removeEventListener: (_: 'resize', listener: () => void) => listeners.delete(listener),
      fireResize: () => listeners.forEach(listener => listener()),
      listenerCount: () => listeners.size,
    }
  }

  it('resolves after one quiet window when no resize occurs', async () => {
    vi.useFakeTimers()
    const viewport = createFakeViewport()
    const settled = vi.fn()

    void waitForViewportSettle({ quietMs: 90, maxMs: 450, viewport }).then(settled)
    await vi.advanceTimersByTimeAsync(90)

    expect(settled).toHaveBeenCalledTimes(1)
    expect(viewport.listenerCount()).toBe(0)
    vi.useRealTimers()
  })

  it('extends the quiet window while resizes keep arriving', async () => {
    vi.useFakeTimers()
    const viewport = createFakeViewport()
    const settled = vi.fn()

    void waitForViewportSettle({ quietMs: 90, maxMs: 450, viewport }).then(settled)
    await vi.advanceTimersByTimeAsync(60)
    viewport.fireResize()
    await vi.advanceTimersByTimeAsync(60)
    expect(settled).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(40)
    expect(settled).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('resolves at the hard bound even if the viewport never goes quiet', async () => {
    vi.useFakeTimers()
    const viewport = createFakeViewport()
    const settled = vi.fn()

    void waitForViewportSettle({ quietMs: 90, maxMs: 300, viewport }).then(settled)
    for (let elapsed = 0; elapsed < 300; elapsed += 50) {
      viewport.fireResize()
      await vi.advanceTimersByTimeAsync(50)
    }

    expect(settled).toHaveBeenCalledTimes(1)
    expect(viewport.listenerCount()).toBe(0)
    vi.useRealTimers()
  })

  it('resolves immediately without a viewport object', async () => {
    await expect(waitForViewportSettle({ viewport: null })).resolves.toBeUndefined()
  })
})

interface FakeEditorOptions {
  toc?: { content: string; lvl: number; slug: string; githubSlug: string; index: number }[]
  headingsHtml?: string
}

function createFakeEditor({ toc = [], headingsHtml = '' }: FakeEditorOptions = {}) {
  const domNode = document.createElement('div')
  domNode.innerHTML = `<div class="mu-container">${headingsHtml}</div>`
  const getTOC = vi.fn(() => toc)
  const ensureMountedThrough = vi.fn()

  return { domNode, getTOC, ensureMountedThrough } as unknown as MuyaEditor & {
    domNode: HTMLElement
    getTOC: typeof getTOC
    ensureMountedThrough: typeof ensureMountedThrough
  }
}

function createOutlineHarness(options: FakeEditorOptions & { editorMissing?: boolean } = {}) {
  const editor = createFakeEditor(options)
  const calls: string[] = []
  const dismissKeyboard = vi.fn(() => calls.push('dismiss'))
  const settleViewport = vi.fn(async () => {
    calls.push('settle')
  })
  const scrollToHeading = vi.fn()
  const documentOutline = createDocumentOutline({
    getEditor: () => (options.editorMissing ? null : editor),
    dismissKeyboard,
    settleViewport,
    scrollToHeading,
  })

  return { editor, calls, dismissKeyboard, settleViewport, scrollToHeading, documentOutline }
}

const TOC_FIXTURE = [
  { content: 'Alpha', lvl: 1, slug: 'alpha', githubSlug: 'alpha', index: 0 },
  { content: 'Beta', lvl: 2, slug: 'beta', githubSlug: 'beta', index: 2 },
]

const HEADINGS_FIXTURE = '<h1>Alpha</h1><p>text</p><h2>Beta</h2>'

describe('createDocumentOutline', () => {
  it('dismisses the keyboard, waits for the viewport, then snapshots a fresh TOC', async () => {
    const { editor, calls, documentOutline } = createOutlineHarness({
      toc: TOC_FIXTURE,
      headingsHtml: HEADINGS_FIXTURE,
    })

    editor.getTOC.mockImplementation(() => {
      calls.push('getTOC')
      return TOC_FIXTURE
    })

    await documentOutline.openOutline()

    expect(calls).toEqual(['dismiss', 'settle', 'getTOC'])
    expect(documentOutline.outlineOpen.value).toBe(true)
    expect(documentOutline.outlineItems.value.map(item => item.text)).toEqual(['Alpha', 'Beta'])
  })

  it('opens with an empty outline when the document has no headings', async () => {
    const { documentOutline } = createOutlineHarness()

    await documentOutline.openOutline()

    expect(documentOutline.outlineOpen.value).toBe(true)
    expect(documentOutline.outlineItems.value).toEqual([])
  })

  it('selecting a heading scrolls to the mapped element and closes', async () => {
    const { scrollToHeading, documentOutline, editor } = createOutlineHarness({
      toc: TOC_FIXTURE,
      headingsHtml: HEADINGS_FIXTURE,
    })

    await documentOutline.openOutline()
    documentOutline.selectHeading('beta')

    expect(scrollToHeading).toHaveBeenCalledTimes(1)
    const heading = scrollToHeading.mock.calls[0][0] as Element
    expect(heading.tagName).toBe('H2')
    expect(heading).toBe(editor.domNode.querySelectorAll('h1, h2')[1])
    expect(documentOutline.outlineOpen.value).toBe(false)
    expect(documentOutline.outlineItems.value).toEqual([])
  })

  it('materializes the heading through a pending progressive mount before resolving', async () => {
    // Only the first block is mounted; the TOC (collected from the JSON
    // state) still lists the tail heading. selectHeading must mount through
    // the target's state index before querying the DOM.
    const { scrollToHeading, documentOutline, editor } = createOutlineHarness({
      toc: TOC_FIXTURE,
      headingsHtml: '<h1>Alpha</h1>',
    })
    editor.ensureMountedThrough.mockImplementation((index: number) => {
      if (index >= 2) {
        editor.domNode.querySelector('.mu-container')!.innerHTML = HEADINGS_FIXTURE
      }
    })

    await documentOutline.openOutline()
    documentOutline.selectHeading('beta')

    expect(editor.ensureMountedThrough).toHaveBeenCalledWith(2)
    expect(scrollToHeading).toHaveBeenCalledTimes(1)
    expect((scrollToHeading.mock.calls[0][0] as Element).tagName).toBe('H2')
  })

  it('fails safe when the target heading is stale: closes without scrolling', async () => {
    const { scrollToHeading, documentOutline, editor } = createOutlineHarness({
      toc: TOC_FIXTURE,
      headingsHtml: HEADINGS_FIXTURE,
    })

    await documentOutline.openOutline()
    // The document lost its headings after the snapshot.
    editor.domNode.querySelector('.mu-container')!.innerHTML = '<p>rewritten</p>'
    documentOutline.selectHeading('beta')

    expect(scrollToHeading).not.toHaveBeenCalled()
    expect(documentOutline.outlineOpen.value).toBe(false)
  })

  it('ignores selection while closed', () => {
    const { scrollToHeading, documentOutline } = createOutlineHarness({ toc: TOC_FIXTURE })

    documentOutline.selectHeading('alpha')

    expect(scrollToHeading).not.toHaveBeenCalled()
  })

  it('does not reopen while already open', async () => {
    const { dismissKeyboard, documentOutline } = createOutlineHarness({ toc: TOC_FIXTURE })

    await documentOutline.openOutline()
    await documentOutline.openOutline()

    expect(dismissKeyboard).toHaveBeenCalledTimes(1)
  })

  it('stays inert when no editor instance is available', async () => {
    const { dismissKeyboard, documentOutline } = createOutlineHarness({ editorMissing: true })

    await documentOutline.openOutline()

    expect(dismissKeyboard).not.toHaveBeenCalled()
    expect(documentOutline.outlineOpen.value).toBe(false)
  })

  it('never opens when the outline is reset while the viewport settles', async () => {
    const editor = createFakeEditor({ toc: TOC_FIXTURE, headingsHtml: HEADINGS_FIXTURE })
    let settle!: () => void
    const documentOutline = createDocumentOutline({
      getEditor: () => editor,
      dismissKeyboard: vi.fn(),
      settleViewport: () => new Promise<void>(resolve => (settle = resolve)),
      scrollToHeading: vi.fn(),
    })

    const opening = documentOutline.openOutline()
    documentOutline.resetForNewDocument()
    settle()
    await opening

    expect(documentOutline.outlineOpen.value).toBe(false)
    expect(editor.getTOC).not.toHaveBeenCalled()
  })

  it('never opens when closed while the viewport settles (competing surface)', async () => {
    const editor = createFakeEditor({ toc: TOC_FIXTURE, headingsHtml: HEADINGS_FIXTURE })
    let settle!: () => void
    const documentOutline = createDocumentOutline({
      getEditor: () => editor,
      dismissKeyboard: vi.fn(),
      settleViewport: () => new Promise<void>(resolve => (settle = resolve)),
      scrollToHeading: vi.fn(),
    })

    const opening = documentOutline.openOutline()
    // e.g. the Search bar opens and calls closeOutline() while pending.
    documentOutline.closeOutline()
    settle()
    await opening

    expect(documentOutline.outlineOpen.value).toBe(false)
    expect(editor.getTOC).not.toHaveBeenCalled()
  })

  it('rejects a duplicate open while the first is still pending', async () => {
    const editor = createFakeEditor({ toc: TOC_FIXTURE, headingsHtml: HEADINGS_FIXTURE })
    const dismissKeyboard = vi.fn()
    const settlers: Array<() => void> = []
    const documentOutline = createDocumentOutline({
      getEditor: () => editor,
      dismissKeyboard,
      settleViewport: () => new Promise<void>(resolve => settlers.push(resolve)),
      scrollToHeading: vi.fn(),
    })

    const first = documentOutline.openOutline()
    const second = documentOutline.openOutline()
    settlers.forEach(resolve => resolve())
    await Promise.all([first, second])

    expect(settlers).toHaveLength(1)
    expect(dismissKeyboard).toHaveBeenCalledTimes(1)
    expect(editor.getTOC).toHaveBeenCalledTimes(1)
    expect(documentOutline.outlineOpen.value).toBe(true)
  })

  it('aborts the open when the editor instance is replaced while the viewport settles', async () => {
    const editorA = createFakeEditor({ toc: TOC_FIXTURE })
    const editorB = createFakeEditor({ toc: TOC_FIXTURE })
    let current = editorA
    const documentOutline = createDocumentOutline({
      getEditor: () => current,
      dismissKeyboard: vi.fn(),
      settleViewport: async () => {
        current = editorB
      },
      scrollToHeading: vi.fn(),
    })

    await documentOutline.openOutline()

    expect(documentOutline.outlineOpen.value).toBe(false)
    expect(editorA.getTOC).not.toHaveBeenCalled()
    expect(editorB.getTOC).not.toHaveBeenCalled()
  })

  it('aborts the open when the editor is destroyed while the viewport settles', async () => {
    const editor = createFakeEditor({ toc: TOC_FIXTURE })
    let editorAlive = true
    const documentOutline = createDocumentOutline({
      getEditor: () => (editorAlive ? editor : null),
      dismissKeyboard: vi.fn(),
      settleViewport: async () => {
        editorAlive = false
      },
      scrollToHeading: vi.fn(),
    })

    await documentOutline.openOutline()

    expect(documentOutline.outlineOpen.value).toBe(false)
  })

  it('resets state for a new document without touching the editor', async () => {
    const { editor, documentOutline } = createOutlineHarness({
      toc: TOC_FIXTURE,
      headingsHtml: HEADINGS_FIXTURE,
    })

    await documentOutline.openOutline()
    editor.getTOC.mockClear()

    documentOutline.resetForNewDocument()

    expect(editor.getTOC).not.toHaveBeenCalled()
    expect(documentOutline.outlineOpen.value).toBe(false)
    expect(documentOutline.outlineItems.value).toEqual([])
  })
})
