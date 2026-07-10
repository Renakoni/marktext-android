// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import {
  PDF_EXPORT_PRINT_CSS,
  renderMarkdownToPdfExportHtml,
  rewriteMarkdownImageSourcesForExport,
} from './pdfExportHtml'
import type { MuyaEditor } from './editorRuntime'

// The export renderer only reads the editor's options, so rendering parity
// can be verified without booting a full Muya editor.
function fakeMuya(options: Record<string, unknown>) {
  return { options } as unknown as MuyaEditor
}

describe('pdfExportHtml', () => {
  it('rewrites MarkText image sources through the export resolver', () => {
    const markdown = 'before ![alt](marktext-image://local/photo%201.png) after'
    const rewritten = rewriteMarkdownImageSourcesForExport(markdown, source =>
      source.includes('local') ? 'file:///data/cache/images/photo%201.png' : null,
    )

    expect(rewritten).toBe('before ![alt](file:///data/cache/images/photo%201.png) after')
  })

  it('leaves sources alone when the resolver cannot map them or throws', () => {
    const markdown = '![a](marktext-image://android/content%3A%2F%2Fx) ![b](marktext-image://local/pic.png)'

    expect(rewriteMarkdownImageSourcesForExport(markdown, () => null)).toBe(markdown)
    expect(
      rewriteMarkdownImageSourcesForExport(markdown, () => {
        throw new Error('bad source')
      }),
    ).toBe(markdown)
  })

  it('does not touch regular image URLs', () => {
    const markdown = '![web](https://example.com/pic.png) ![rel](./pic.png)'
    expect(rewriteMarkdownImageSourcesForExport(markdown, () => 'file:///nope')).toBe(markdown)
  })

  it('keeps page geometry, background printing, and front-matter hiding in the print stylesheet', () => {
    expect(PDF_EXPORT_PRINT_CSS).toContain('@page')
    expect(PDF_EXPORT_PRINT_CSS).toContain('print-color-adjust: exact')
    expect(PDF_EXPORT_PRINT_CSS).toContain('break-after: avoid')
    expect(PDF_EXPORT_PRINT_CSS).toMatch(/pre\.front-matter\s*\{\s*display:\s*none !important;/)
  })

  // The renderer import embeds KaTeX fonts on first use; give the real
  // pipeline room when the suite runs with parallel workers.
  it('renders with the live editor options instead of export defaults', { timeout: 30_000 }, async () => {
    const markdown = 'A claim[^1] and H~2~O.\n\n[^1]: The footnote body.'

    // The editor has footnotes on and super/subscript off — the exported
    // document must match it, not the standalone renderer's defaults
    // (footnotes off, super/subscript on).
    const withEditorOptions = await renderMarkdownToPdfExportHtml({
      markdown,
      title: 'Parity',
      textDirection: 'ltr',
      muya: fakeMuya({
        footnote: true,
        superSubScript: false,
        isGitlabCompatibilityEnabled: false,
        math: true,
      }),
    })
    expect(withEditorOptions).toContain('<section class="footnotes">')
    expect(withEditorOptions).toContain('The footnote body.')
    expect(withEditorOptions).not.toContain('<sub>')

    const withDefaults = await renderMarkdownToPdfExportHtml({
      markdown,
      title: 'Parity',
      textDirection: 'ltr',
    })
    expect(withDefaults).not.toContain('<section class="footnotes">')
    expect(withDefaults).toContain('<sub>')
  })

  it('parses front matter as metadata instead of document content', { timeout: 30_000 }, async () => {
    const html = await renderMarkdownToPdfExportHtml({
      markdown: '---\ntitle: meta\n---\n\n# Real heading',
      title: 'Front matter',
      textDirection: 'ltr',
      muya: fakeMuya({ footnote: false, math: true }),
    })

    // In a real WebView the metadata sits inside <pre class="front-matter">,
    // which the print CSS hides (happy-dom's DOMPurify pass drops <pre>
    // wrappers, so the wrapper itself cannot be asserted here). What must
    // never happen is the old failure mode: the --- delimiters rendering as
    // thematic breaks or setext headings around visible paragraph text.
    expect(html).toContain('Real heading')
    expect(html).not.toContain('<hr')
    expect(html).not.toContain('<p>title: meta</p>')
    expect(html).not.toContain('title: meta</h2>')
  })

  // The native print WebView enables JavaScript for its readiness probe on
  // the explicit premise that the export document can never carry active
  // content (see the boundary note in PdfExporter.java). These lock that
  // premise in: a Muya renderer refactor that let scripts through would fail
  // here before the trust boundary silently widened.
  it('neutralizes script tags in the exported document', { timeout: 30_000 }, async () => {
    const html = await renderMarkdownToPdfExportHtml({
      markdown: 'Safe paragraph.\n\n<script>window.pwned = true</script>',
      title: 'Sanitizer boundary',
      textDirection: 'ltr',
      muya: fakeMuya({ math: true }),
    })

    const body = html.slice(html.indexOf('<body>'))
    expect(body).toContain('Safe paragraph.')
    // escapeInBlockHtml neutralizes <script> deterministically before
    // DOMPurify runs, so the tag can never be live in the export — the
    // highest-risk vector for a print WebView, which auto-runs scripts but
    // never receives the clicks or navigations that onclick/javascript:
    // would need.
    expect(body).not.toContain('<script')
    expect(body).toContain('&lt;script&gt;')
  })

  it('strips event handlers and dangerous URL schemes at the export sanitizer', async () => {
    // Event-handler and URL-scheme stripping is DOMPurify's job, and
    // DOMPurify binds a window singleton at import: under happy-dom the full
    // render round-trip does not reproduce that stripping deterministically,
    // so it is asserted here on muya's sanitize primitive — the exact
    // function MarkdownToHtml.renderHtml composes with. The export path's
    // EXPORT_DOMPURIFY_CONFIG only broadens allowed URI schemes to include
    // file:; it never re-permits scripts, handlers, or javascript:. The real
    // WebView and muya's own sanitizer suite cover the integrated path.
    const { sanitize } = await import('@muyajs/core')
    const config = { USE_PROFILES: { html: true, svg: true } }

    expect(sanitize('<p onclick="alert(1)">click</p>', config, false)).not.toContain('onclick')
    expect(sanitize('<a href="javascript:alert(1)">bad</a>', config, false)).not.toContain('javascript:')
    expect(sanitize('<img src="javascript:alert(2)" alt="x">', config, false)).not.toContain('javascript:')
    expect(sanitize('<script>window.pwned = true</script>ok', config, false)).not.toContain('<script')
  })

  it('marks RTL exports on the document root', { timeout: 30_000 }, async () => {
    const html = await renderMarkdownToPdfExportHtml({
      markdown: 'שלום',
      title: 'RTL',
      textDirection: 'rtl',
      muya: fakeMuya({ math: true }),
    })

    expect(html).toContain('dir="rtl"')
  })
})
