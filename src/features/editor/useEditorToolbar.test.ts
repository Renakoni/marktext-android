import { describe, expect, it } from 'vitest'
import { useEditorToolbar } from './useEditorToolbar'

describe('useEditorToolbar', () => {
  it('keeps the editor menu and expanded toolbar mutually exclusive', () => {
    const toolbar = useEditorToolbar()

    expect(toolbar.editorToolbarPanel.value).toBe('format')

    toolbar.toggleEditorMenu()

    expect(toolbar.editorMenuOpen.value).toBe(true)
    expect(toolbar.editorToolbarExpanded.value).toBe(false)

    toolbar.toggleEditorToolbar()

    expect(toolbar.editorMenuOpen.value).toBe(false)
    expect(toolbar.editorToolbarExpanded.value).toBe(true)

    toolbar.setEditorToolbarPanel('insert')

    expect(toolbar.editorToolbarPanel.value).toBe('insert')
  })

  it('uses the configured default panel when the toolbar does not remember panels', () => {
    const toolbar = useEditorToolbar()

    toolbar.applyEditorToolbarSettings({ defaultPanel: 'paragraph', rememberPanel: false })
    expect(toolbar.editorToolbarPanel.value).toBe('paragraph')

    toolbar.toggleEditorToolbar()
    toolbar.setEditorToolbarPanel('insert')
    expect(toolbar.editorToolbarPanel.value).toBe('insert')

    toolbar.toggleEditorToolbar()
    toolbar.toggleEditorToolbar()

    expect(toolbar.editorToolbarPanel.value).toBe('paragraph')
  })

  it('keeps the selected panel when remember panels is enabled', () => {
    const toolbar = useEditorToolbar()

    toolbar.applyEditorToolbarSettings({ defaultPanel: 'paragraph', rememberPanel: true })
    toolbar.toggleEditorToolbar()
    toolbar.setEditorToolbarPanel('markdown')
    toolbar.toggleEditorToolbar()
    toolbar.toggleEditorToolbar()

    expect(toolbar.editorToolbarPanel.value).toBe('markdown')
  })

  it('opens and clears link sheet state without leaking stale values', () => {
    const toolbar = useEditorToolbar()

    toolbar.toggleEditorMenu()
    toolbar.openLinkSheet({ text: 'selected text' })

    expect(toolbar.editorMenuOpen.value).toBe(false)
    expect(toolbar.linkSheetOpen.value).toBe(true)
    expect(toolbar.linkText.value).toBe('selected text')
    expect(toolbar.linkUrl.value).toBe('')

    toolbar.linkUrl.value = 'https://example.com'
    toolbar.closeLinkSheet()

    expect(toolbar.linkSheetOpen.value).toBe(false)
    expect(toolbar.linkText.value).toBe('')
    expect(toolbar.linkUrl.value).toBe('')
  })
})
