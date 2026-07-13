// Which link hrefs the mobile link-action overlay is allowed to OPEN, and how
// to read the href off a rendered Muya link wrapper.
//
// Opening is handed to the Android system (AppLauncher), so the scheme
// allowlist is a security boundary, not a convenience: `javascript:`, `file:`,
// `intent:`, `data:` and friends must never reach the launcher. Only absolute,
// web-openable schemes qualify; a relative file link (`./notes.md`) or an
// in-document anchor (`#heading`) has no resolvable target on Android, so it is
// deliberately NOT openable and — per the product decision — the overlay does
// not appear for it at all.

// Rendered link wrapper classes (Muya `CLASS_NAMES`, kebab-cased by
// `genUpper2LowerKeyHash`). Mirrored here as an app-layer constant so the
// overlay never imports vendored Muya internals; these class names are the
// stable rendered contract exercised by `linkMouseEvents.ts`.
//   markdown `[text](href)`        -> span.mu-link
//   reference `[label][ref]`       -> a.mu-reference-link (resolved href)
//   HTML `<a href=...>`            -> a.mu-raw-html
//   auto-link (bare URL)           -> a.mu-auto-link / a.mu-auto-link-extension
export const LINK_WRAPPER_SELECTOR = [
  'span.mu-link',
  'a.mu-reference-link',
  'a.mu-raw-html',
  'a.mu-auto-link',
  'a.mu-auto-link-extension',
].join(', ')

// Absolute, web-openable schemes we hand to the Android system. `mailto`/`tel`
// are included because AppLauncher routes them to the mail/dialer app; a
// web-only in-app browser could not. Everything else — including no scheme at
// all (relative / anchor) — is rejected.
const OPENABLE_LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel'])

// RFC 3986 scheme: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) then ":".
// Anchored, so any leading whitespace or a smuggled control character
// (`java\nscript:`) fails to match and the href is treated as non-openable.
const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/

/**
 * Return the href only when it is an absolute link in the openable-scheme
 * allowlist; otherwise null. Relative links, in-document anchors, and unsafe
 * schemes all return null (the overlay stays hidden for them).
 */
export function getOpenableLinkTarget(href: string | null | undefined): string | null {
  if (!href) {
    return null
  }

  const trimmed = href.trim()
  const match = SCHEME_PATTERN.exec(trimmed)
  if (!match) {
    // No scheme -> relative path or `#anchor`: nothing to open on Android.
    return null
  }

  const scheme = match[1].toLowerCase()
  if (!OPENABLE_LINK_SCHEMES.has(scheme)) {
    return null
  }

  return trimmed
}

/**
 * Read the href from a rendered Muya link wrapper. Markdown links carry the
 * href as a snabbdom DOM property (`elm.href`, no attribute); reference and
 * HTML `<a>` links carry a real `href` attribute. Read both so the caller does
 * not need to know which renderer produced the element (parity with Muya's own
 * `getLinkInfo`, without importing it).
 */
export function readLinkWrapperHref(element: HTMLElement): string | null {
  const attribute = element.getAttribute('href')
  if (attribute) {
    return attribute
  }

  const property = (element as HTMLElement & { href?: unknown }).href
  if (typeof property === 'string' && property) {
    return property
  }

  return null
}
