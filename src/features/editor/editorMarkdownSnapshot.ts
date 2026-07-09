export interface EditorMarkdownSnapshotSource {
  flush?: () => void
  getMarkdown: () => string
}

interface ReadEditorMarkdownSnapshotOptions {
  flushPending?: boolean
  normalizeMarkdown?: (markdown: string) => string
}

export function readEditorMarkdownSnapshot(
  editor: EditorMarkdownSnapshotSource,
  options: ReadEditorMarkdownSnapshotOptions = {},
) {
  if (options.flushPending) {
    editor.flush?.()
  }

  const markdown = editor.getMarkdown()
  return options.normalizeMarkdown ? options.normalizeMarkdown(markdown) : markdown
}
