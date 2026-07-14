import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const editorScreenSource = readFileSync(
  new URL('./EditorScreen.vue', import.meta.url),
  'utf8',
)

function openingTag(marker: string) {
  const start = editorScreenSource.indexOf(marker)
  if (start < 0) {
    throw new Error(`Missing editor surface: ${marker}`)
  }
  return editorScreenSource.slice(start, editorScreenSource.indexOf('>', start) + 1)
}

describe('editor modal accessibility contract', () => {
  it('hides every editor background surface while the link sheet is open', () => {
    const backgroundSurfaces = [
      '<header\n      v-if="searchOpen"',
      '<header\n      v-else',
      '<section\n      class="editor-pane"',
      '<MobileSelectionToolbar',
      '<LinkActionOverlay',
      '<MobileEditorToolbar',
    ]

    for (const surface of backgroundSurfaces) {
      expect(openingTag(surface)).toContain(':aria-hidden="linkSheetBackgroundAriaHidden"')
    }
  })
})
