export type LineEnding = 'lf' | 'crlf'
export type AutosaveTarget = 'local-draft' | 'android-document'
export type AutosaveState = 'clean' | 'dirty' | 'saving' | 'save-failed'
export type MarkdownDocumentEncoding = string

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
  encoding: MarkdownDocumentEncoding
  hasEncodingBom: boolean
  autosaveTarget: AutosaveTarget
  autosaveState: AutosaveState
  lastSavedAt: string | null
  lastSaveError: string | null
  createdAt: string
  updatedAt: string
  stats: DocumentStats
}

interface CreateDocumentOptions {
  markdown?: string
  displayName?: string
  sourceUri?: string | null
  autosaveTarget?: AutosaveTarget
  preferredLineEnding?: LineEnding
  encoding?: MarkdownDocumentEncoding
  hasEncodingBom?: boolean
  createdAt?: string
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

export interface MarkdownSaveOptions {
  lineEnding?: 'default' | LineEnding
  trimTrailingNewline?: number
}

const DEFAULT_UNTITLED_NAME = 'Untitled-1'
const MARKDOWN_EXTENSION_REGEXP = /\.(markdown|mdown|mkdn|mkd|md)$/i
const MARKDOWN_COPY_SUFFIX_REGEXP = /\s+copy(?:\s+(\d+))?$/
const INVALID_FILENAME_CHARS_REGEXP = /[\\/:*?"<>|\r\n]+/g
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

export function stripMarkdownExtension(displayName: string) {
  return displayName.replace(MARKDOWN_EXTENSION_REGEXP, '')
}

const UNTITLED_NAME_REGEXP = /^Untitled-\d+$/
const FRONTMATTER_DELIMITER_REGEXP = /^---\s*$/
const THEMATIC_BREAK_REGEXP = /^\s*([-*_])(\s*\1){2,}\s*$/
const CODE_FENCE_REGEXP = /^\s*(?:`{3,}|~{3,})/
const TITLE_MAX_LENGTH = 48

// Best-effort plain-text reduction of a Markdown line for use as a title:
// strips the common block prefixes and inline markers without a full parse.
// Lines that are pure syntax (fences, thematic breaks) reduce to nothing.
function extractTitleTextFromLine(line: string) {
  const trimmed = line.trim()
  if (!trimmed || THEMATIC_BREAK_REGEXP.test(trimmed) || CODE_FENCE_REGEXP.test(trimmed)) {
    return ''
  }

  return trimmed
    .replace(/^#{1,6}\s+/, '')
    .replace(/^(?:>\s*)+/, '')
    .replace(/^(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/^\[[ xX]\]\s+/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// The first line of the document that still reads as text once Markdown
// syntax is stripped, skipping a leading YAML front matter block.
function getLeadingTitleText(markdown: string) {
  const lines = markdown.split(/\r\n|\r|\n/)
  let index = 0

  if (lines[0] !== undefined && FRONTMATTER_DELIMITER_REGEXP.test(lines[0])) {
    const closing = lines.findIndex(
      (line, lineIndex) => lineIndex > 0 && FRONTMATTER_DELIMITER_REGEXP.test(line),
    )
    if (closing > 0) {
      index = closing + 1
    }
  }

  for (; index < lines.length; index += 1) {
    const text = extractTitleTextFromLine(lines[index])
    if (text) {
      return text.length > TITLE_MAX_LENGTH ? text.slice(0, TITLE_MAX_LENGTH).trim() : text
    }
  }

  return ''
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
  saveOptions: MarkdownSaveOptions = {},
) {
  const trailingNewlineMode = saveOptions.trimTrailingNewline ?? options.trimTrailingNewline
  const lineEndingMode = saveOptions.lineEnding ?? 'default'
  const lineEnding = lineEndingMode === 'default' ? options.lineEnding : lineEndingMode
  const adjustLineEndingOnSave = lineEndingMode === 'default'
    ? options.adjustLineEndingOnSave
    : lineEndingMode === 'crlf'
  let nextMarkdown = adjustTrailingNewlines(markdown, trailingNewlineMode)

  if (adjustLineEndingOnSave && lineEnding === 'crlf') {
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

/**
 * The user-facing name of a document when it has one: the Untitled-N
 * placeholder is not a real name and yields undefined.
 */
export function getCustomDisplayName(displayName: string): string | undefined {
  const trimmed = displayName.trim()
  return trimmed && !UNTITLED_NAME_REGEXP.test(trimmed) ? trimmed : undefined
}

export function getDocumentTitle(markdown: string, displayName = DEFAULT_UNTITLED_NAME) {
  const heading = markdown
    .split(/\r\n|\r|\n/)
    .map(line => line.match(/^#{1,6}\s+(.+)$/)?.[1]?.trim())
    .find(Boolean)

  if (heading) {
    return heading
  }

  // A real display name (an opened file's name) still wins over content, but
  // the generic Untitled-N placeholder yields to the document's own leading
  // text so drafts name themselves instead of all reading "Untitled-1".
  const name = stripMarkdownExtension(displayName)
  if (name && !UNTITLED_NAME_REGEXP.test(displayName)) {
    return name
  }

  return getLeadingTitleText(markdown) || name || 'Untitled'
}

export function getSuggestedMarkdownFileName(markdown: string, displayName = DEFAULT_UNTITLED_NAME) {
  const title = getDocumentTitle(markdown, displayName)
  const baseName = stripMarkdownExtension(title)
    .replace(INVALID_FILENAME_CHARS_REGEXP, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const safeName = baseName || 'Untitled'
  return MARKDOWN_EXTENSION_REGEXP.test(safeName) ? safeName : `${safeName}.md`
}

export function getSuggestedMarkdownCopyFileName(
  markdown: string,
  displayName = DEFAULT_UNTITLED_NAME,
  reservedNames: string[] = [],
) {
  const suggestedName = getSuggestedMarkdownFileName(markdown, displayName)
  const extension = suggestedName.match(MARKDOWN_EXTENSION_REGEXP)?.[0] ?? '.md'
  const baseName = suggestedName.slice(0, -extension.length) || 'Untitled'
  const copySuffix = baseName.match(MARKDOWN_COPY_SUFFIX_REGEXP)
  const copyBaseName = copySuffix
    ? baseName.slice(0, copySuffix.index).trim() || 'Untitled'
    : baseName
  const firstCopyIndex = copySuffix ? Number(copySuffix[1] ?? '1') + 1 : 1
  const normalizedReservedNames = new Set(reservedNames.map(name => name.toLocaleLowerCase()))

  for (let index = firstCopyIndex; index < firstCopyIndex + 100; index += 1) {
    const suffix = index === 1 ? 'copy' : `copy ${index}`
    const candidate = `${copyBaseName} ${suffix}${extension}`
    if (!normalizedReservedNames.has(candidate.toLocaleLowerCase())) {
      return candidate
    }
  }

  return `${copyBaseName} copy ${Date.now()}${extension}`
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
    encoding: options.encoding ?? 'utf8',
    hasEncodingBom: options.hasEncodingBom ?? false,
    autosaveTarget: options.autosaveTarget ?? 'local-draft',
    autosaveState: 'clean',
    lastSavedAt: now,
    lastSaveError: null,
    createdAt: options.createdAt ?? now,
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
