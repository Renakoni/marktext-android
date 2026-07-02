export function normalizeLinkField(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function escapeMarkdownLinkText(value: string) {
  return normalizeLinkField(value).replace(/([\\[\]])/g, '\\$1')
}

function escapeMarkdownLinkUrl(value: string) {
  return value.trim().replace(/\)/g, '\\)')
}

export function buildMarkdownLink(text: string, url: string) {
  const normalizedUrl = escapeMarkdownLinkUrl(url)
  const normalizedText = escapeMarkdownLinkText(text || normalizedUrl)
  return `[${normalizedText}](${normalizedUrl})`
}

function escapeMarkdownImageAlt(value: string) {
  return value.replace(/[\r\n]+/g, ' ').replace(/]/g, '\\]').trim()
}

export function buildMarkdownImage(alt: string, source: string) {
  return `![${escapeMarkdownImageAlt(alt)}](${source})`
}
