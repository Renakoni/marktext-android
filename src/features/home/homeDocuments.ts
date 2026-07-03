import type { RecentDocumentListItem } from '../../lib/recentDocuments'

export interface HomeDocumentItem {
  id: string
  title: string
  details: string
}

export interface HomeDocumentText {
  localDraftSource: string
  markdownDocumentSource: string
  detailsSeparator: string
  formatWordCount: (count: number) => string
}

const DEFAULT_HOME_DOCUMENT_TEXT: HomeDocumentText = {
  localDraftSource: 'Local draft',
  markdownDocumentSource: 'Markdown document',
  detailsSeparator: ' - ',
  formatWordCount: count => `${count} ${count === 1 ? 'word' : 'words'}`,
}

export function formatHomeDocumentSavedTime(value: string | null, locale?: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getHomeDocumentSource(item: RecentDocumentListItem, text: HomeDocumentText) {
  if (item.providerName === DEFAULT_HOME_DOCUMENT_TEXT.localDraftSource) {
    return text.localDraftSource
  }

  return item.providerName ?? text.markdownDocumentSource
}

export function toHomeDocumentItem(
  item: RecentDocumentListItem,
  text: HomeDocumentText = DEFAULT_HOME_DOCUMENT_TEXT,
  locale?: string,
): HomeDocumentItem {
  const savedAt = formatHomeDocumentSavedTime(item.lastSavedAt ?? item.updatedAt, locale)
  const count = item.stats ? text.formatWordCount(item.stats.words) : ''
  const source = getHomeDocumentSource(item, text)

  return {
    id: item.id,
    title: item.title,
    details: [source, savedAt, count].filter(Boolean).join(text.detailsSeparator),
  }
}
