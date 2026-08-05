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

  it('switches to the table panel on caret entry and restores the previous panel on exit', () => {
    const toolbar = useEditorToolbar()

    toolbar.setEditorToolbarPanel('insert')
    toolbar.setCaretInTable(true)

    expect(toolbar.caretInTable.value).toBe(true)
    expect(toolbar.editorToolbarPanel.value).toBe('table')

    toolbar.setCaretInTable(false)

    expect(toolbar.caretInTable.value).toBe(false)
    expect(toolbar.editorToolbarPanel.value).toBe('insert')
  })

  it('keeps a manual panel choice made inside the table on exit', () => {
    const toolbar = useEditorToolbar()

    toolbar.setCaretInTable(true)
    toolbar.setEditorToolbarPanel('markdown')
    toolbar.setCaretInTable(false)

    expect(toolbar.editorToolbarPanel.value).toBe('markdown')
  })

  it('ignores repeated caret state reports without disturbing the snapshot', () => {
    const toolbar = useEditorToolbar()

    toolbar.setEditorToolbarPanel('paragraph')
    toolbar.setCaretInTable(true)
    toolbar.setCaretInTable(true)
    toolbar.setCaretInTable(false)
    toolbar.setCaretInTable(false)

    expect(toolbar.editorToolbarPanel.value).toBe('paragraph')
  })

  it('lets the table panel survive a forget-panels expand while the caret is in a table', () => {
    const toolbar = useEditorToolbar()

    toolbar.applyEditorToolbarSettings({ defaultPanel: 'format', rememberPanel: false })
    toolbar.setCaretInTable(true)
    toolbar.toggleEditorToolbar()

    expect(toolbar.editorToolbarPanel.value).toBe('table')
  })

  it('applies a settings change made mid-table underneath the table panel', () => {
    const toolbar = useEditorToolbar()

    toolbar.setCaretInTable(true)
    toolbar.applyEditorToolbarSettings({ defaultPanel: 'markdown', rememberPanel: false })

    expect(toolbar.editorToolbarPanel.value).toBe('table')

    toolbar.setCaretInTable(false)

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

  it('opens and clears table sheet state without leaking stale values', () => {
    const toolbar = useEditorToolbar()

    toolbar.toggleEditorMenu()
    toolbar.openTableSheet({ rows: 3, columns: 3 })

    expect(toolbar.editorMenuOpen.value).toBe(false)
    expect(toolbar.editorToolbarExpanded.value).toBe(false)
    expect(toolbar.tableSheetOpen.value).toBe(true)
    expect(toolbar.tableRows.value).toBe(3)
    expect(toolbar.tableColumns.value).toBe(3)

    toolbar.tableRows.value = 5
    toolbar.closeTableSheet()

    expect(toolbar.tableSheetOpen.value).toBe(false)
    expect(toolbar.tableRows.value).toBe(0)
    expect(toolbar.tableColumns.value).toBe(0)
  })
})
