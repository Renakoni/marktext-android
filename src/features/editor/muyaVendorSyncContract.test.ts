import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const VENDOR_ROOT = resolve('third_party/muya/src')
const INSTALLED_ROOT = resolve('node_modules/@muyajs/core/src')

function collectSourceFiles(root: string): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === '__tests__') {
        continue
      }

      const fullPath = join(dir, entry)
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath)
      } else if (/\.(ts|css)$/.test(entry)) {
        files.push(relative(root, fullPath))
      }
    }
  }
  walk(root)
  return files.sort()
}

// pnpm materializes the `file:third_party/muya` dependency as a hard-linked
// copy. Editing a vendored file with a replace-style write breaks the hard
// link, after which builds silently keep using the stale node_modules copy.
// This guard fails loudly whenever the two trees drift; fix by copying the
// changed files onto node_modules/@muyajs/core/src (or reinstalling).
describe('vendored Muya matches the installed copy', () => {
  it('has identical source files in third_party and node_modules', () => {
    const drifted: string[] = []
    for (const file of collectSourceFiles(VENDOR_ROOT)) {
      const vendorContent = readFileSync(join(VENDOR_ROOT, file), 'utf8')
      let installedContent: string | null
      try {
        installedContent = readFileSync(join(INSTALLED_ROOT, file), 'utf8')
      } catch {
        installedContent = null
      }

      if (installedContent !== vendorContent) {
        drifted.push(file)
      }
    }

    expect(drifted, `stale node_modules copies: ${drifted.join(', ')}`).toEqual([])
  })
})
