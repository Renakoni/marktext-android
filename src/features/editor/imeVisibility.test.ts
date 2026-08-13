import { describe, expect, it } from 'vitest'
import { createImeVisibilityEstimator, IME_MIN_HEIGHT_PX } from './imeVisibility'

describe('createImeVisibilityEstimator', () => {
  it('keeps the first sample unknown, then reads a keyboard-sized shrink as visible', () => {
    const estimator = createImeVisibilityEstimator()

    expect(estimator.update(1080, 2337)).toBe('unknown')
    // Keyboard opens: adjustResize shrinks the window well past the threshold.
    expect(estimator.update(1080, 1500)).toBe('visible')
    // Keyboard dismissed: the window grows back to the baseline.
    expect(estimator.update(1080, 2337)).toBe('hidden')
  })

  it('ignores shrinks smaller than a plausible keyboard', () => {
    const estimator = createImeVisibilityEstimator()

    estimator.update(1080, 2337)
    expect(estimator.update(1080, 2337 - IME_MIN_HEIGHT_PX + 1)).toBe('unknown')
  })

  it('resets the baseline on orientation flips', () => {
    const estimator = createImeVisibilityEstimator()

    estimator.update(1080, 2337)
    // Rotating to landscape drops the height drastically — that is a new
    // baseline, not a keyboard.
    expect(estimator.update(2337, 1080)).toBe('unknown')
    expect(estimator.update(2337, 600)).toBe('visible')
    // Back to portrait: fresh baseline again.
    expect(estimator.update(1080, 2337)).toBe('unknown')
  })

  it('grows the baseline when the window gets taller in place', () => {
    const estimator = createImeVisibilityEstimator()

    // First sample arrives with the keyboard already up (app started into
    // a focused field): the taller keyboard-less height later becomes the
    // baseline, and the same small height then reads as visible.
    expect(estimator.update(1080, 1500)).toBe('unknown')
    expect(estimator.update(1080, 2337)).toBe('hidden')
    expect(estimator.update(1080, 1500)).toBe('visible')
  })

  it('stays unknown when rotation begins with the keyboard already open', () => {
    const estimator = createImeVisibilityEstimator()

    estimator.update(1080, 2337)
    expect(estimator.update(1080, 1500)).toBe('visible')
    expect(estimator.update(2337, 600)).toBe('unknown')
  })

  it('does not call a no-resize floating keyboard hidden', () => {
    const estimator = createImeVisibilityEstimator()

    expect(estimator.update(1080, 2337)).toBe('unknown')
    expect(estimator.update(1080, 2337)).toBe('unknown')
  })
})
