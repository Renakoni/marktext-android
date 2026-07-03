/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const modernColorFunctionPattern = /\b(?:oklch|color-mix)\(/
const sourceRoot = join(process.cwd(), 'src')
const themeTokensPath = join(sourceRoot, 'styles', 'theme-tokens.css')

function collectStyleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectStyleFiles(path)
    }

    return entry.name.endsWith('.css') || entry.name.endsWith('.vue') ? [path] : []
  })
}

describe('theme webview fallbacks', () => {
  it('keeps modern color functions inside guarded theme tokens', () => {
    const offenders = collectStyleFiles(sourceRoot)
      .filter(path => path !== themeTokensPath)
      .filter(path => modernColorFunctionPattern.test(readFileSync(path, 'utf8')))
      .map(path => relative(process.cwd(), path))

    expect(offenders).toEqual([])
  })

  it('declares legacy-safe color tokens before progressive enhancements', () => {
    const css = readFileSync(themeTokensPath, 'utf8')
    const fallbackRoot = css.slice(css.indexOf(':root'), css.indexOf('@supports'))

    expect(fallbackRoot).toContain('--app-bg: #f2f4f6;')
    expect(fallbackRoot).toContain('--accent: #516b8b;')
    expect(fallbackRoot).not.toMatch(modernColorFunctionPattern)
    expect(css).toContain('@supports (color: oklch(0.52 0.06 255))')
    expect(css).toContain('@supports (background: color-mix(in srgb, red 50%, blue 50%))')
  })
})
