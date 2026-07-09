/**
 * MIUI WebViews pin CJK glyphs to a single weight: measured on-device
 * (Xiaomi 23127PN0CC, WebView 149, single-frame screenshot ink analysis),
 * `font-weight: 400` and `700` rasterize to identical pixels at every font
 * size and family — real bold faces are unreachable and synthetic bold is
 * suppressed — while Latin text bolds normally. No font stack, rendering
 * property, named weight family, or variation axis escapes the clamp, so
 * bold Markdown needs stroke-based compensation on those devices.
 */

const CLAMPED_CJK_WEIGHT_MANUFACTURERS = ['xiaomi', 'redmi', 'poco', 'blackshark']

export function shouldCompensateCjkBold(manufacturer: string | undefined): boolean {
  if (!manufacturer) {
    return false
  }

  const normalized = manufacturer.trim().toLowerCase()
  return CLAMPED_CJK_WEIGHT_MANUFACTURERS.some(name => normalized.includes(name))
}

/** Stamp the compensation flag the stroke CSS in style.css keys off. */
export function applyCjkBoldCompensation(enabled: boolean, root?: HTMLElement) {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!target) {
    return
  }

  if (enabled) {
    target.dataset.cjkBoldCompensation = 'true'
  } else {
    delete target.dataset.cjkBoldCompensation
  }
}
