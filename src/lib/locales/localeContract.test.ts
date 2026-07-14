import { describe, expect, it } from 'vitest'
import { en } from './en'
import { zhCN } from './zh-CN'
import { zhTW } from './zh-TW'
import { de } from './de'
import { es } from './es'
import { fr } from './fr'
import { ja } from './ja'
import { ko } from './ko'
import { pt } from './pt'
import { tr } from './tr'

// Every shipped locale beside the canonical English source. TypeScript already
// enforces the exact key set (`satisfies Record<I18nKey, string>`); these tests
// add the runtime guarantees it cannot express: non-empty values and identical
// `{placeholder}` sets per key, so a translation can never silently drop or
// rename a `{count}`/`{name}` token.
const LOCALES = { 'zh-CN': zhCN, 'zh-TW': zhTW, de, es, fr, ja, ko, pt, tr } as const

const enKeys = Object.keys(en) as (keyof typeof en)[]

function placeholders(value: string): Set<string> {
  return new Set(Array.from(value.matchAll(/\{(\w+)\}/g), match => match[1]))
}

describe('locale contract', () => {
  for (const [name, messages] of Object.entries(LOCALES)) {
    const map = messages as Record<string, string>

    describe(name, () => {
      it('defines exactly the English key set', () => {
        expect(Object.keys(map).sort()).toEqual([...enKeys].sort())
      })

      it('has a non-empty string for every key', () => {
        const empty = Object.entries(map)
          .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
          .map(([key]) => key)
        expect(empty).toEqual([])
      })

      it('preserves every English {placeholder} per key', () => {
        const mismatches: string[] = []
        for (const key of enKeys) {
          const expected = placeholders(en[key])
          const actual = placeholders(map[key])
          const same =
            expected.size === actual.size && [...expected].every(token => actual.has(token))
          if (!same) {
            mismatches.push(
              `${key}: expected {${[...expected].join(', ')}} got {${[...actual].join(', ')}}`,
            )
          }
        }
        expect(mismatches).toEqual([])
      })
    })
  }
})
