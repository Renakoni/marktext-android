declare module '@muyajs/core' {
  export interface ILocale {
    name: string
    resource: Record<string, string>
  }

  export const de: ILocale
  export const en: ILocale
  export const es: ILocale
  export const fr: ILocale
  export const ja: ILocale
  export const ko: ILocale
  export const pt: ILocale
  export const tr: ILocale
  export const zhCN: ILocale
  export const zhTW: ILocale

  export interface ITocItem {
    content: string
    lvl: number
    slug: string
    githubSlug: string
  }

  export interface IMuyaClipboard {
    getClipboardData(): { html: string; text: string }
    cutSelectionToClipboardData(): { html: string; text: string }
    pasteAsPlainText(): Promise<void>
    copyAsMarkdown(): void
    copyAsHtml(): void
    cutHandler(): void
  }

  export interface IMuyaSelectionEndpoint {
    offset: number
    block: unknown
    path: (string | number)[]
  }

  export interface IMuyaSelectionSnapshot {
    anchor: IMuyaSelectionEndpoint
    focus: IMuyaSelectionEndpoint
    isCollapsed: boolean
    isSelectionInSameBlock: boolean
  }

  export interface IMuyaSelection {
    clear(): void
    getSelection(): IMuyaSelectionSnapshot | null
    setSelection(anchor: IMuyaSelectionEndpoint, focus: IMuyaSelectionEndpoint): void
  }

  export interface IMuyaSearchOptions {
    isCaseSensitive?: boolean
    isWholeWord?: boolean
    isRegexp?: boolean
    selectHighlight?: boolean
    highlightIndex?: number
  }

  export interface IMuyaSearchState {
    matches: unknown[]
    index: number
  }

  export class Muya {
    static plugins: { plugin: unknown; options?: Record<string, unknown> }[]
    static use(plugin: unknown, options?: Record<string, unknown>): void
    domNode: HTMLElement
    editor: {
      activeContentBlock: unknown
      clipboard: IMuyaClipboard
      selection: IMuyaSelection
    }
    constructor(element: HTMLElement, options?: Record<string, unknown>)
    init(): void
    on(event: string, listener: (...args: unknown[]) => void): void
    off(event: string, listener: (...args: unknown[]) => void): void
    getMarkdown(): string
    flush(): void
    getTOC(): ITocItem[]
    getHistory(): unknown
    setHistory(history: unknown): void
    clearHistory(): void
    setOptions(options: Record<string, unknown>, forceRender?: boolean): void
    setListIndentation(listIndentation: number | string): void
    locale(locale: ILocale): void
    undo(): void
    redo(): void
    setContent(content: unknown[] | string, autoFocus?: boolean): void
    replaceContent(content: unknown[] | string, recordSelection?: unknown): boolean
    format(type: string): void
    updateParagraph(type: string): void
    createTable(
      dimensions: { rows: number; columns: number },
      options?: { replace?: boolean },
    ): void
    focus(): void
    selectAll(): void
    search(value: string, opts?: IMuyaSearchOptions): IMuyaSearchState
    find(action: 'previous' | 'next'): IMuyaSearchState
    destroy(): void
  }

  export const CodeBlockLanguageSelector: unknown
  export const EmojiSelector: unknown
  export const FootnoteTool: unknown
  export const ImageEditTool: unknown
  export const ImagePathPicker: unknown
  export const ImageResizeBar: unknown
  export const ImageToolBar: unknown
  export const InlineFormatToolbar: unknown
  export const LinkTools: unknown
  export const ParagraphFrontButton: unknown
  export const ParagraphFrontMenu: unknown
  export const ParagraphQuickInsertMenu: unknown
  export const PreviewToolBar: unknown
  export const TableChessboard: unknown
  export const TableColumnToolbar: unknown
  export const TableDragBar: unknown
  export const TableRowColumMenu: unknown

  export class MarkdownToHtml {
    markdown: string
    constructor(markdown: string, muya?: unknown)
    renderHtml(): Promise<string>
    generate(options?: {
      title?: string
      extraCSS?: string
      inlineStyles?: boolean
      dir?: string
    }): Promise<string>
  }

  export function renderToStaticHTML(...args: unknown[]): unknown
  export function escapeHTML(str: string): string
  export function unescapeHTML(str: string): string
  export function sanitize(html: string, config?: unknown, isInline?: boolean): string
  export function generateGithubSlug(text: string): string
  export function getImageInfo(src: string): { isUnknownType: boolean; src: string; [key: string]: unknown }
  export function wordCount(markdown: string): {
    word: number
    paragraph: number
    character: number
    all: number
  }
}
