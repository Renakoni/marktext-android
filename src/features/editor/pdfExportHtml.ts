import {
  ensureAndroidImageResolver,
  getDocumentLocalImageExportSource,
  getMarkTextImageExportFileSource,
  getImportedAndroidImageDirectory,
  isLocalRelativeImageSource,
} from '../../lib/androidImages'
import type { MuyaEditor } from './editorRuntime'

// Print CSS appended to Muya's export document. Page geometry lives in
// @page (the native print pipeline is told to use no printer margins), the
// export body padding is dropped so @page is the single margin source, and
// backgrounds are forced on so code blocks keep their fill — the WebView
// print pipeline otherwise strips backgrounds like desktop Chromium does
// without printBackground.
export const PDF_EXPORT_PRINT_CSS = `
/* The renderer parses front matter into pre.front-matter; like the desktop
   export, it is document metadata and never part of the printed page. */
pre.front-matter {
  display: none !important;
}

@media print {
  @page {
    margin: 18mm;
  }

  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .markdown-body {
    max-width: none;
    padding: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    break-after: avoid;
    break-inside: avoid;
  }

  pre, blockquote, table, img {
    break-inside: avoid;
  }
}
`

const MARKTEXT_IMAGE_SOURCE_REGEXP = /marktext-image:\/\/(?:local|android)\/[^\s)'"<>]+/gi

// Rewrites MarkText image sources in the markdown itself, before rendering:
// the export sanitizer only lets standard protocols through, so an
// unrecognized marktext-image:// src would be stripped from the output with
// no way to recover the file it pointed at. Sources the resolver cannot map
// are left untouched.
export function rewriteMarkdownImageSourcesForExport(
  markdown: string,
  resolveImageSource: (source: string) => string | null,
) {
  return markdown.replace(MARKTEXT_IMAGE_SOURCE_REGEXP, source => {
    try {
      return resolveImageSource(source) ?? source
    } catch {
      return source
    }
  })
}

// An inline image destination and a reference definition, each split so only
// the destination is replaced. Kept in step with the editor's own local-source
// test (`isLocalRelativeImageSource`).
const MARKDOWN_INLINE_IMAGE_DESTINATION_REGEXP = /(!\[[^\]]*\]\(\s*)(<[^>\n]*>|[^\s)]+)/g
const MARKDOWN_REFERENCE_IMAGE_DESTINATION_REGEXP = /^([ \t]{0,3}\[[^\]\n]+\]:[ \t]*)(<[^>\n]*>|\S+)/gm

// Rewrites relative sibling image destinations to content URIs the native
// print WebView can open directly. That WebView has no Capacitor local server,
// so the `http://localhost/...` form the live editor resolves them to would
// simply not load in the exported PDF.
export function rewriteLocalMarkdownImageSourcesForExport(
  markdown: string,
  resolveLocalSource: (source: string) => string | null,
) {
  const rewrite = (prefix: string, destination: string) => {
    const wrapped = destination.startsWith('<') && destination.endsWith('>')
    const source = wrapped ? destination.slice(1, -1).trim() : destination
    if (!isLocalRelativeImageSource(source)) {
      return `${prefix}${destination}`
    }

    let resolved: string | null
    try {
      resolved = resolveLocalSource(source)
    } catch {
      resolved = null
    }
    return resolved ? `${prefix}${resolved}` : `${prefix}${destination}`
  }

  return markdown
    .replace(
      MARKDOWN_INLINE_IMAGE_DESTINATION_REGEXP,
      (_match: string, prefix: string, destination: string) => rewrite(prefix, destination),
    )
    .replace(
      MARKDOWN_REFERENCE_IMAGE_DESTINATION_REGEXP,
      (_match: string, prefix: string, destination: string) => rewrite(prefix, destination),
    )
}

export interface RenderPdfExportHtmlOptions {
  markdown: string
  title: string
  textDirection: 'ltr' | 'rtl'
  // The live editor instance. The export renderer reads its options so the
  // PDF renders with the same feature set as the editor (footnotes,
  // super/subscript, GitLab compatibility, diagram themes, PlantUML server);
  // without it the renderer falls back to defaults that differ from this
  // app's settings.
  muya?: MuyaEditor | null
}

// Builds the self-contained export document the native PDF printer renders:
// Muya's desktop export pipeline (inlined GitHub styles, KaTeX with embedded
// fonts, Prism highlighting, diagrams pre-rendered to SVG in this WebView)
// plus the print CSS above. Image sources are resolved to file URIs the
// offscreen native WebView can load directly.
export async function renderMarkdownToPdfExportHtml({
  markdown,
  title,
  textDirection,
  muya,
}: RenderPdfExportHtmlOptions) {
  await ensureAndroidImageResolver()
  const imageDirectory = getImportedAndroidImageDirectory()
  const exportMarkdown = rewriteLocalMarkdownImageSourcesForExport(
    rewriteMarkdownImageSourcesForExport(
      markdown,
      source => getMarkTextImageExportFileSource(source, imageDirectory),
    ),
    source => getDocumentLocalImageExportSource(source),
  )

  const { MarkdownToHtml } = await import('@muyajs/core')
  return new MarkdownToHtml(exportMarkdown, muya ?? undefined).generate({
    title,
    extraCSS: PDF_EXPORT_PRINT_CSS,
    dir: textDirection === 'rtl' ? 'rtl' : undefined,
  })
}
