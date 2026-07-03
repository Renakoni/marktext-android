interface EditorDomHost {
  domNode?: HTMLElement
}

export function resolveEditorDomNode(
  editor: unknown,
  fallback: HTMLElement | null,
) {
  return (editor as EditorDomHost | null)?.domNode ?? fallback
}

export function captureSelectionWithin(root: HTMLElement | null) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0).cloneRange()
  if (root && !root.contains(range.commonAncestorContainer)) {
    return null
  }

  return range
}

export function insertTextAtRestoredSelection(text: string, range: Range | null) {
  const selection = window.getSelection()
  if (selection && range) {
    selection.removeAllRanges()
    selection.addRange(range)
  }

  return document.execCommand('insertText', false, text)
}
