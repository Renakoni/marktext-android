import { describe, expect, it } from 'vitest'
import { createImeVisibilityEstimator, IME_MIN_HEIGHT_PX } from './imeVisibility'

describe('createImeVisibilityEstimator', () => {
  it('reads hidden at the first full-height sample and visible on a keyboard-sized shrink', () => {
    const estimator = createImeVisibilityEstimator()

    expect(estimator.update(1080, 2337)).toBe(false)
    // Keyboard opens: adjustResize shrinks the window well past the threshold.
    expect(estimator.update(1080, 1500)).toBe(true)
    // Keyboard dismissed: the window grows back to the baseline.
    expect(estimator.update(1080, 2337)).toBe(false)
  })

  it('ignores shrinks smaller than a plausible keyboard', () => {
    const estimator = createImeVisibilityEstimator()

    estimator.update(1080, 2337)
    expect(estimator.update(1080, 2337 - IME_MIN_HEIGHT_PX + 1)).toBe(false)
  })

  it('resets the baseline on orientation flips', () => {
    const estimator = createImeVisibilityEstimator()

    estimator.update(1080, 2337)
    // Rotating to landscape drops the height drastically — that is a new
    // baseline, not a keyboard.
    expect(estimator.update(2337, 1080)).toBe(false)
    expect(estimator.update(2337, 600)).toBe(true)
    // Back to portrait: fresh baseline again.
    expect(estimator.update(1080, 2337)).toBe(false)
  })

  it('grows the baseline when the window gets taller in place', () => {
    const estimator = createImeVisibilityEstimator()

    // First sample arrives with the keyboard already up (app started into
    // a focused field): the taller keyboard-less height later becomes the
    // baseline, and the same small height then reads as visible.
    estimator.update(1080, 1500)
    expect(estimator.update(1080, 2337)).toBe(false)
    expect(estimator.update(1080, 1500)).toBe(true)
  })
})
