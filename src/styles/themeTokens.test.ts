/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const themesRoot = join(sourceRoot, 'styles', 'themes')
const structuralTokensPath = join(sourceRoot, 'styles', 'theme-tokens.css')
const lightThemePath = join(themesRoot, 'graphite-light.css')
const darkThemePath = join(themesRoot, 'cadmium-dark.css')

// Tokens set from JS at runtime (inline style vars) rather than in a stylesheet.
const RUNTIME_DEFINED_TOKENS = new Set(['--editor-area-width'])

// The semantic contract every theme must satisfy (documented in theme-tokens.css).
const REQUIRED_SEMANTIC_TOKENS = [
  '--app-bg',
  '--surface',
  '--surface-muted',
  '--surface-sunken',
  '--surface-raised',
  '--text',
  '--text-muted',
  '--text-faint',
  '--on-accent',
  '--border',
  '--border-strong',
  '--separator',
  '--accent',
  '--accent-strong',
  '--accent-hover',
  '--accent-soft',
  '--danger',
  '--focus-ring',
  '--press',
  '--scrim',
  '--shadow-sm',
  '--shadow-float',
  '--shadow-thumb',
  '--shadow-accent',
  '--editor-bg-color',
  '--editor-color',
  '--theme-color',
  '--selection-color',
  '--link-color',
]

function collectStyleFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectStyleFiles(path)
    }

    return entry.name.endsWith('.css') || entry.name.endsWith('.vue') ? [path] : []
  })
}

function collectDefinedTokens(css: string): Set<string> {
  return new Set(Array.from(css.matchAll(/(--[\w-]+)\s*:/g), match => match[1]))
}

function collectReferencedTokens(css: string): Set<string> {
  return new Set(Array.from(css.matchAll(/var\(\s*(--[\w-]+)/g), match => match[1]))
}

describe('theme token architecture', () => {
  it('keeps modern color functions out of shipped styles for old WebViews', () => {
    const modernColorFunctionPattern = /\b(?:oklch|color-mix)\(/
    const offenders = collectStyleFiles(sourceRoot)
      .filter(path => path.endsWith('.css') || path.endsWith('.vue'))
      .filter(path => modernColorFunctionPattern.test(readFileSync(path, 'utf8')))
      .map(path => relative(process.cwd(), path))

    expect(offenders).toEqual([])
  })

  it('defines the same token set in the light and dark themes', () => {
    const lightTokens = collectDefinedTokens(readFileSync(lightThemePath, 'utf8'))
    const darkTokens = collectDefinedTokens(readFileSync(darkThemePath, 'utf8'))

    const missingInDark = [...lightTokens].filter(token => !darkTokens.has(token)).sort()
    const missingInLight = [...darkTokens].filter(token => !lightTokens.has(token)).sort()

    expect(missingInDark).toEqual([])
    expect(missingInLight).toEqual([])
  })

  it('covers the documented semantic contract in both themes', () => {
    for (const path of [lightThemePath, darkThemePath]) {
      const tokens = collectDefinedTokens(readFileSync(path, 'utf8'))
      const missing = REQUIRED_SEMANTIC_TOKENS.filter(token => !tokens.has(token))
      expect(missing, `missing in ${relative(process.cwd(), path)}`).toEqual([])
    }
  })

  it('never references an undefined token from app styles', () => {
    const definedTokens = new Set<string>(RUNTIME_DEFINED_TOKENS)
    for (const path of [structuralTokensPath, lightThemePath, darkThemePath]) {
      for (const token of collectDefinedTokens(readFileSync(path, 'utf8'))) {
        definedTokens.add(token)
      }
    }

    const styleFiles = collectStyleFiles(sourceRoot)
    for (const path of styleFiles) {
      const css = readFileSync(path, 'utf8')
      for (const token of collectDefinedTokens(css)) {
        definedTokens.add(token)
      }
    }

    const offenders = styleFiles.flatMap(path => {
      const referenced = collectReferencedTokens(readFileSync(path, 'utf8'))
      return [...referenced]
        .filter(token => !definedTokens.has(token))
        .map(token => `${relative(process.cwd(), path)}: ${token}`)
    })

    expect(offenders.sort()).toEqual([])
  })
})
