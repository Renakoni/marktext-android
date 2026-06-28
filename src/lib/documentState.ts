export type LineEnding = 'lf' | 'crlf'
export type AutosaveTarget = 'local-draft' | 'android-document'
export type AutosaveState = 'clean' | 'dirty' | 'saving' | 'save-failed'

export interface DocumentStats {
  words: number
  characters: number
  lines: number
}

export interface NormalizedMarkdown {
  markdown: string
  lineEnding: LineEnding
  isMixedLineEndings: boolean
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
}

export interface MarkdownDocumentState {
  id: string
  markdown: string
  displayName: string
  title: string
  sourceUri: string | null
  isDirty: boolean
  lineEnding: LineEnding
  isMixedLineEndings: boolean
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
  autosaveTarget: AutosaveTarget
  autosaveState: AutosaveState
  lastSavedAt: string | null
  lastSaveError: string | null
  updatedAt: string
  stats: DocumentStats
}

interface CreateDocumentOptions {
  markdown?: string
  displayName?: string
  sourceUri?: string | null
  autosaveTarget?: AutosaveTarget
  preferredLineEnding?: LineEnding
  now?: string
}

interface UpdateDocumentOptions {
  markDirty?: boolean
  now?: string
}

interface SaveDocumentOptions {
  autosaveTarget?: AutosaveTarget
  now?: string
}

const DEFAULT_UNTITLED_NAME = 'Untitled-1'
const MARKDOWN_EXTENSION_REGEXP = /\.(markdown|mdown|mkdn|mkd|md)$/i
const LINE_ENDING_REGEXP = /\r\n|\r|\n/g

function createDocumentId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `doc-${Date.now().toString(36)}-${random}`
}

function currentTimestamp() {
  return new Date().toISOString()
}

function countLineEndingKinds(markdown: string) {
  const crlf = markdown.match(/\r\n/g)?.length ?? 0
  const withoutCrlf = markdown.replace(/\r\n/g, '')
  const lf = withoutCrlf.match(/\n/g)?.length ?? 0
  const cr = withoutCrlf.match(/\r/g)?.length ?? 0

  return { crlf, lf, cr }
}

function detectTrailingNewline(markdown: string) {
  if (!markdown) {
    return 3
  }

  if (/\n\n$/.test(markdown)) {
    return 2
  }

  if (/\n$/.test(markdown)) {
    return 1
  }

  return 0
}

function trimTrailingNewlines(markdown: string) {
  return markdown.replace(/\n+$/, '')
}

function adjustTrailingNewlines(markdown: string, mode: number) {
  if (!markdown) {
    return ''
  }

  if (mode === 0) {
    return trimTrailingNewlines(markdown)
  }

  if (mode === 1) {
    const trimmed = trimTrailingNewlines(markdown)
    return trimmed ? `${trimmed}\n` : ''
  }

  return markdown
}

function stripMarkdownExtension(displayName: string) {
  return displayName.replace(MARKDOWN_EXTENSION_REGEXP, '')
}

export function normalizeMarkdownForEditor(
  rawMarkdown: string,
  preferredLineEnding: LineEnding = 'lf',
): NormalizedMarkdown {
  const { crlf, lf, cr } = countLineEndingKinds(rawMarkdown)
  const kinds = [crlf > 0, lf > 0, cr > 0].filter(Boolean).length
  let lineEnding = preferredLineEnding

  if (crlf > 0 && lf === 0 && cr === 0) {
    lineEnding = 'crlf'
  } else if (lf > 0 && crlf === 0 && cr === 0) {
    lineEnding = 'lf'
  }

  const markdown = rawMarkdown.replace(/\r\n|\r/g, '\n')

  return {
    markdown,
    lineEnding,
    isMixedLineEndings: kinds > 1,
    adjustLineEndingOnSave: lineEnding !== 'lf',
    trimTrailingNewline: detectTrailingNewline(markdown),
  }
}

export function prepareMarkdownForSave(
  markdown: string,
  options: Pick<MarkdownDocumentState, 'adjustLineEndingOnSave' | 'lineEnding' | 'trimTrailingNewline'>,
) {
  let nextMarkdown = adjustTrailingNewlines(markdown, options.trimTrailingNewline)

  if (options.adjustLineEndingOnSave && options.lineEnding === 'crlf') {
    nextMarkdown = nextMarkdown.replace(LINE_ENDING_REGEXP, '\r\n')
  }

  return nextMarkdown
}

export function countWords(markdown: string) {
  const latinWords = markdown.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0
  const cjkCharacters = markdown.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0
  return latinWords + cjkCharacters
}

export function getDocumentStats(markdown: string): DocumentStats {
  return {
    words: countWords(markdown),
    characters: markdown.length,
    lines: markdown ? markdown.split(/\r\n|\r|\n/).length : 0,
  }
}

export function getDocumentTitle(markdown: string, displayName = DEFAULT_UNTITLED_NAME) {
  const heading = markdown
    .split(/\r\n|\r|\n/)
    .map(line => line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim())
    .find(Boolean)

  return heading || stripMarkdownExtension(displayName) || 'Untitled'
}

export function createUntitledDocument(options: CreateDocumentOptions = {}): MarkdownDocumentState {
  const now = options.now ?? currentTimestamp()
  const normalized = normalizeMarkdownForEditor(
    options.markdown ?? '',
    options.preferredLineEnding ?? 'lf',
  )
  const displayName = options.displayName ?? DEFAULT_UNTITLED_NAME

  return {
    id: createDocumentId(),
    markdown: normalized.markdown,
    displayName,
    title: getDocumentTitle(normalized.markdown, displayName),
    sourceUri: options.sourceUri ?? null,
    isDirty: false,
    lineEnding: normalized.lineEnding,
    isMixedLineEndings: normalized.isMixedLineEndings,
    adjustLineEndingOnSave: normalized.adjustLineEndingOnSave,
    trimTrailingNewline: normalized.trimTrailingNewline,
    autosaveTarget: options.autosaveTarget ?? 'local-draft',
    autosaveState: 'clean',
    lastSavedAt: now,
    lastSaveError: null,
    updatedAt: now,
    stats: getDocumentStats(normalized.markdown),
  }
}

export function updateDocumentMarkdown(
  documentState: MarkdownDocumentState,
  markdown: string,
  options: UpdateDocumentOptions = {},
): MarkdownDocumentState {
  const now = options.now ?? currentTimestamp()
  const markDirty = options.markDirty ?? true
  const isDirty = markDirty ? true : documentState.isDirty
  const autosaveState: AutosaveState = markDirty ? 'dirty' : documentState.autosaveState

  return {
    ...documentState,
    markdown,
    title: getDocumentTitle(markdown, documentState.displayName),
    isDirty,
    trimTrailingNewline: detectTrailingNewline(markdown),
    autosaveState,
    lastSaveError: markDirty ? null : documentState.lastSaveError,
    updatedAt: now,
    stats: getDocumentStats(markdown),
  }
}

export function markDocumentSaving(documentState: MarkdownDocumentState): MarkdownDocumentState {
  return {
    ...documentState,
    autosaveState: 'saving',
    lastSaveError: null,
  }
}

export function markDocumentSaved(
  documentState: MarkdownDocumentState,
  options: SaveDocumentOptions = {},
): MarkdownDocumentState {
  return {
    ...documentState,
    isDirty: false,
    autosaveTarget: options.autosaveTarget ?? documentState.autosaveTarget,
    autosaveState: 'clean',
    lastSavedAt: options.now ?? currentTimestamp(),
    lastSaveError: null,
  }
}

export function markDocumentSaveFailed(
  documentState: MarkdownDocumentState,
  error: unknown,
): MarkdownDocumentState {
  return {
    ...documentState,
    isDirty: true,
    autosaveState: 'save-failed',
    lastSaveError: error instanceof Error ? error.message : String(error),
  }
}
