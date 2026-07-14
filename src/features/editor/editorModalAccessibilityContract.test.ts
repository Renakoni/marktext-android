import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const editorScreenSource = readFileSync(
  new URL('./EditorScreen.vue', import.meta.url),
  'utf8',
)

function openingTag(source: string, marker: string) {
  const start = source.indexOf(marker)
  if (start < 0) {
    throw new Error(`Missing editor surface: ${marker}`)
  }

  let quote: '"' | "'" | null = null
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === quote) {
        quote = null
      }
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
    } else if (character === '>') {
      return source.slice(start, index + 1)
    }
  }

  throw new Error(`Unterminated editor surface: ${marker}`)
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
      expect(openingTag(editorScreenSource, surface)).toContain(
        ':aria-hidden="linkSheetBackgroundAriaHidden"',
      )
    }
  })

  it('does not mistake an arrow handler for the end of an opening tag', () => {
    const source = '<button @click="value => save(value)" :aria-hidden="hidden">'

    expect(openingTag(source, '<button')).toContain(':aria-hidden="hidden"')
  })
})
