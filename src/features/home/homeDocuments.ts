import { getUntitledFallbackIndex } from '../../lib/documentState'
import type { RecentDocumentKind, RecentDocumentListItem } from '../../lib/recentDocuments'

export interface HomeDocumentItem {
  id: string
  kind: RecentDocumentKind
  title: string
  /** The document's own name (file name for device documents); titles can be heading-derived. */
  displayName: string
  details: string
}

export interface HomeDocumentSections<Item extends { id: string }> {
  continueItem: Item | null
  pinnedItems: Item[]
  earlierItems: Item[]
}

/**
 * Splits the sorted document list into the home sections. The Continue
 * masthead stays the top of the user-sorted list regardless of pins — it
 * means "your latest work", not "your favorite" — and pinned documents form
 * a block above Earlier while keeping their relative sort order.
 */
export function partitionHomeDocumentItems<Item extends { id: string }>(
  items: Item[],
  pinnedIds: ReadonlySet<string>,
): HomeDocumentSections<Item> {
  const continueItem = items.length > 0 ? items[0] : null
  const rest = items.slice(1)

  return {
    continueItem,
    pinnedItems: rest.filter(item => pinnedIds.has(item.id)),
    earlierItems: rest.filter(item => !pinnedIds.has(item.id)),
  }
}

export interface HomeDocumentText {
  localDraftSource: string
  markdownDocumentSource: string
  detailsSeparator: string
  formatWordCount: (count: number) => string
  formatUntitled: (index: number) => string
}

const DEFAULT_HOME_DOCUMENT_TEXT: HomeDocumentText = {
  localDraftSource: 'Local draft',
  markdownDocumentSource: 'Markdown document',
  detailsSeparator: ' - ',
  formatWordCount: count => `${count} ${count === 1 ? 'word' : 'words'}`,
  formatUntitled: index => `Untitled-${index}`,
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

  // A canonical Untitled-N is localized for display only when it is genuinely
  // the fallback for a titleless draft, never a content-derived title.
  const fallbackIndex = getUntitledFallbackIndex(item.title, item.markdownPreview ?? '')
  const title = fallbackIndex !== null ? text.formatUntitled(fallbackIndex) : item.title

  return {
    id: item.id,
    kind: item.kind,
    title,
    displayName: item.displayName,
    details: [source, savedAt, count].filter(Boolean).join(text.detailsSeparator),
  }
}
