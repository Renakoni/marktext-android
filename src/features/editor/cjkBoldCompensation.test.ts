import { describe, expect, it } from 'vitest'

import { applyCjkBoldCompensation, shouldCompensateCjkBold } from './cjkBoldCompensation'

describe('shouldCompensateCjkBold', () => {
  it('enables compensation for manufacturers with the CJK weight clamp', () => {
    expect(shouldCompensateCjkBold('Xiaomi')).toBe(true)
    expect(shouldCompensateCjkBold('xiaomi')).toBe(true)
    expect(shouldCompensateCjkBold('Redmi')).toBe(true)
    expect(shouldCompensateCjkBold('POCO')).toBe(true)
  })

  it('stays off for healthy manufacturers and missing values', () => {
    expect(shouldCompensateCjkBold('Google')).toBe(false)
    expect(shouldCompensateCjkBold('samsung')).toBe(false)
    expect(shouldCompensateCjkBold('HUAWEI')).toBe(false)
    expect(shouldCompensateCjkBold('')).toBe(false)
    expect(shouldCompensateCjkBold(undefined)).toBe(false)
  })
})

describe('applyCjkBoldCompensation', () => {
  it('stamps and clears the root dataset flag', () => {
    const root = { dataset: {} as DOMStringMap } as HTMLElement

    applyCjkBoldCompensation(true, root)
    expect(root.dataset.cjkBoldCompensation).toBe('true')

    applyCjkBoldCompensation(false, root)
    expect(root.dataset.cjkBoldCompensation).toBeUndefined()
  })

  it('degrades gracefully without a document', () => {
    expect(() => applyCjkBoldCompensation(true)).not.toThrow()
  })
})
