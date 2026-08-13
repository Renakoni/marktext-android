/**
 * Soft-keyboard visibility fallback for a non-native adjustResize window: the IME
 * opening shrinks `window.innerHeight`, so a height notably below the
 * tallest seen for the current orientation reads as "IME visible". The
 * baseline resets on orientation flips and grows with the window. Android uses
 * WindowInsets as the authoritative signal; this fallback never equates an
 * uncalibrated viewport with a hidden keyboard.
 *
 * Failure modes lean conservative on purpose: the first sample and the first
 * sample after an orientation change are UNKNOWN. Callers only blur on the
 * explicit HIDDEN state, so floating keyboards and rotation cannot make the
 * fallback close a keyboard the user is typing on (#200).
 */
export const IME_MIN_HEIGHT_PX = 150

export type ImeVisibility = 'unknown' | 'hidden' | 'visible'

export interface ImeVisibilityEstimator {
  /** Feed the current window size; returns the conservative IME state. */
  update(width: number, height: number): ImeVisibility
}

export function createImeVisibilityEstimator(): ImeVisibilityEstimator {
  let orientation: 'portrait' | 'landscape' | null = null
  let tallestSeen = 0
  let baselineConfirmed = false
  let keyboardSizedShrinkSeen = false

  return {
    update(width: number, height: number) {
      const next = width > height ? 'landscape' : 'portrait'
      if (next !== orientation) {
        orientation = next
        tallestSeen = height
        baselineConfirmed = false
        keyboardSizedShrinkSeen = false
        return 'unknown'
      } else if (height > tallestSeen) {
        tallestSeen = height
        baselineConfirmed = true
      }

      if (height < tallestSeen - IME_MIN_HEIGHT_PX) {
        keyboardSizedShrinkSeen = true
        return 'visible'
      }

      return baselineConfirmed || keyboardSizedShrinkSeen ? 'hidden' : 'unknown'
    },
  }
}
