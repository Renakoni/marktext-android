import { describe, expect, it } from 'vitest'
import { useDocumentSelection } from './useDocumentSelection'

describe('useDocumentSelection', () => {
  it('activates edit mode with the long-pressed document selected', () => {
    const selection = useDocumentSelection()

    expect(selection.isActive.value).toBe(false)

    selection.beginWith('draft-1')

    expect(selection.isActive.value).toBe(true)
    expect(selection.count.value).toBe(1)
    expect(selection.isSelected('draft-1')).toBe(true)
  })

  it('toggles documents and exits when the last one is deselected', () => {
    const selection = useDocumentSelection()
    selection.beginWith('draft-1')
    selection.toggle('draft-2')

    expect(selection.count.value).toBe(2)

    selection.toggle('draft-2')
    selection.toggle('draft-1')

    expect(selection.count.value).toBe(0)
    expect(selection.isActive.value).toBe(false)
  })

  it('clears the whole selection at once', () => {
    const selection = useDocumentSelection()
    selection.beginWith('draft-1')
    selection.toggle('draft-2')

    selection.clear()

    expect(selection.isActive.value).toBe(false)
  })

  it('drops selected ids that leave the document list', () => {
    const selection = useDocumentSelection()
    selection.beginWith('draft-1')
    selection.toggle('draft-2')

    selection.retain(['draft-2', 'draft-3'])

    expect(selection.isSelected('draft-1')).toBe(false)
    expect(selection.isSelected('draft-2')).toBe(true)
    expect(selection.count.value).toBe(1)
  })
})
