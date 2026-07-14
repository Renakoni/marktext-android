import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const modalComponents = [
  '../features/editor/components/AndroidExitPrompt.vue',
  '../features/editor/components/EditorActionSheet.vue',
  '../features/editor/components/IncomingOpenPrompt.vue',
  '../features/editor/components/LinkInsertSheet.vue',
  '../features/editor/components/LocalDraftExitPrompt.vue',
  '../features/editor/components/OutlineSheet.vue',
  '../features/editor/components/TableInsertSheet.vue',
  '../features/home/components/DocumentDeleteConfirmSheet.vue',
  '../features/home/components/DocumentRenameSheet.vue',
  '../features/settings/components/SettingsDetailPage.vue',
] as const

describe('modal focus contract', () => {
  it.each(modalComponents)('%s uses the shared modal focus lifecycle', relativePath => {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')

    expect(source).toContain('role="dialog"')
    expect(source).toContain('tabindex="-1"')
    expect(source).toContain('useModalFocus({')
    expect(source).toContain('@keydown="onModalKeydown"')
  })

  it('keeps link insertion as the sole non-inert modal because it restores the editor selection', () => {
    const source = readFileSync(
      new URL('../features/editor/components/LinkInsertSheet.vue', import.meta.url),
      'utf8',
    )

    expect(source).toContain('isolateBackground: false')
  })
})
