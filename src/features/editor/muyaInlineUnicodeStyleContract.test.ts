import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function inlineSyntaxCss() {
  return readFileSync(resolve('third_party/muya/src/assets/styles/inlineSyntax.css'), 'utf8')
}

describe('Muya inline unicode emphasis style contract', () => {
  it('allows synthesized strong and emphasis faces for scripts without native variants', () => {
    const css = inlineSyntaxCss()

    expect(css).toContain('strong.mu-inline-rule')
    expect(css).toContain('font-weight: 700')
    expect(css).toContain('em.mu-inline-rule')
    expect(css).toContain('font-style: italic')
    expect(css).toContain('font-style: oblique 12deg')
    expect(css).toContain('font-synthesis: weight style')
  })
})
