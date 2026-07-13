// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { getOpenableLinkTarget, readLinkWrapperHref } from './linkTargets'

describe('getOpenableLinkTarget', () => {
  it('returns absolute web links in the openable-scheme allowlist', () => {
    expect(getOpenableLinkTarget('http://example.com')).toBe('http://example.com')
    expect(getOpenableLinkTarget('https://example.com/path?q=1#frag')).toBe(
      'https://example.com/path?q=1#frag',
    )
    expect(getOpenableLinkTarget('mailto:writer@example.com')).toBe('mailto:writer@example.com')
    expect(getOpenableLinkTarget('tel:+1-234-567')).toBe('tel:+1-234-567')
  })

  it('treats the scheme case-insensitively but preserves the original href', () => {
    expect(getOpenableLinkTarget('HTTPS://Example.com/Path')).toBe('HTTPS://Example.com/Path')
    expect(getOpenableLinkTarget('MailTo:a@b.com')).toBe('MailTo:a@b.com')
  })

  it('trims surrounding whitespace', () => {
    expect(getOpenableLinkTarget('  https://example.com  ')).toBe('https://example.com')
  })

  it('rejects in-document anchors and relative paths (no resolvable Android target)', () => {
    expect(getOpenableLinkTarget('#heading')).toBeNull()
    expect(getOpenableLinkTarget('./notes.md')).toBeNull()
    expect(getOpenableLinkTarget('../notes.md')).toBeNull()
    expect(getOpenableLinkTarget('notes.md')).toBeNull()
    expect(getOpenableLinkTarget('/absolute/path')).toBeNull()
  })

  it('rejects unsafe and non-allowlisted schemes', () => {
    expect(getOpenableLinkTarget('javascript:alert(1)')).toBeNull()
    expect(getOpenableLinkTarget('JavaScript:alert(1)')).toBeNull()
    expect(getOpenableLinkTarget('file:///etc/passwd')).toBeNull()
    expect(getOpenableLinkTarget('intent://scan/#Intent;scheme=zxing;end')).toBeNull()
    expect(getOpenableLinkTarget('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(getOpenableLinkTarget('ftp://server/file')).toBeNull()
  })

  it('does not treat a smuggled control character as a valid scheme', () => {
    // A leading-whitespace or embedded-control href must fail the anchored
    // scheme match rather than being coerced into `javascript:`.
    expect(getOpenableLinkTarget('java\nscript:alert(1)')).toBeNull()
    expect(getOpenableLinkTarget('java\tscript:alert(1)')).toBeNull()
  })

  it('rejects empty and missing hrefs', () => {
    expect(getOpenableLinkTarget('')).toBeNull()
    expect(getOpenableLinkTarget('   ')).toBeNull()
    expect(getOpenableLinkTarget(null)).toBeNull()
    expect(getOpenableLinkTarget(undefined)).toBeNull()
  })
})

describe('readLinkWrapperHref', () => {
  it('reads a real href attribute (reference / HTML anchors)', () => {
    const anchor = document.createElement('a')
    anchor.setAttribute('href', 'https://example.com')
    expect(readLinkWrapperHref(anchor)).toBe('https://example.com')
  })

  it('reads the snabbdom href DOM property when there is no attribute (markdown links)', () => {
    const span = document.createElement('span')
    ;(span as HTMLElement & { href?: unknown }).href = 'https://example.com/prop'
    expect(readLinkWrapperHref(span)).toBe('https://example.com/prop')
  })

  it('returns null when neither an attribute nor a property href is present', () => {
    expect(readLinkWrapperHref(document.createElement('span'))).toBeNull()
  })
})
