/**
 * Soft-keyboard visibility estimate for an adjustResize WebView: the IME
 * opening shrinks `window.innerHeight`, so a height notably below the
 * tallest seen for the current orientation reads as "IME visible". The
 * baseline resets on orientation flips and grows with the window.
 *
 * Failure modes lean conservative on purpose: entering split-screen (or
 * a floating keyboard's zero-height inset) can read as "visible", and
 * callers must treat "visible" as "do not interfere" — so a wrong
 * estimate degrades to today's behavior, never to closing a keyboard
 * the user is typing on (#200).
 */
export const IME_MIN_HEIGHT_PX = 150

export interface ImeVisibilityEstimator {
  /** Feed the current window size; returns whether the IME reads visible. */
  update(width: number, height: number): boolean
}

export function createImeVisibilityEstimator(): ImeVisibilityEstimator {
  let orientation: 'portrait' | 'landscape' | null = null
  let tallestSeen = 0

  return {
    update(width: number, height: number) {
      const next = width > height ? 'landscape' : 'portrait'
      if (next !== orientation) {
        orientation = next
        tallestSeen = height
      } else if (height > tallestSeen) {
        tallestSeen = height
      }
      return height < tallestSeen - IME_MIN_HEIGHT_PX
    },
  }
}
