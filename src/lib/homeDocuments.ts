import type { RecentDocumentListItem } from './recentDocuments'

export interface HomeDocumentItem {
  id: string
  title: string
  details: string
}

export function formatHomeDocumentSavedTime(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function toHomeDocumentItem(item: RecentDocumentListItem): HomeDocumentItem {
  const savedAt = formatHomeDocumentSavedTime(item.lastSavedAt ?? item.updatedAt)
  const count = item.stats ? `${item.stats.words} ${item.stats.words === 1 ? 'word' : 'words'}` : ''
  const source = item.providerName ?? 'Markdown document'

  return {
    id: item.id,
    title: item.title,
    details: [source, savedAt, count].filter(Boolean).join(' - '),
  }
}
