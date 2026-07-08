import {
  getAndroidEditorSelectionMenuState,
  type AndroidSelectionControlResult,
} from './androidSelection'

interface SelectionDiagnosticLogger {
  debug(message: string, context?: unknown): void
  warn(message: string, context?: unknown): void
}

interface InstallAndroidSelectionDiagnosticsOptions {
  root: HTMLElement
  getFallbackRoot: () => HTMLElement | null
  logger: SelectionDiagnosticLogger
}

interface Point {
  x: number
  y: number
}

let selectionDiagnosticSequence = 0

export function installAndroidSelectionDiagnostics({
  root,
  getFallbackRoot,
  logger,
}: InstallAndroidSelectionDiagnosticsOptions) {
  const log = (source: string, event?: Event) => {
    window.requestAnimationFrame(() => {
      const sequence = ++selectionDiagnosticSequence
      const eventSummary = describeEvent(event)
      const point = getEventPoint(eventSummary)
      const checkpoint = {
        version: 2,
        sequence,
        source,
        event: eventSummary,
        target: describeNodeToken(event?.target),
        activeElement: describeNodeToken(document.activeElement),
        root: describeElementSnapshot(root),
        fallbackRoot: describeElementSnapshot(getFallbackRoot()),
        viewport: describeViewport(),
        selection: describeSelection(root, point),
        hitTest: describeHitTest(point),
      }

      logger.debug('editor selection checkpoint', checkpoint)
      void logAndroidSelectionCheckpoint(logger, sequence, source)
    })
  }

  const onSelectionChange = (event: Event) => log('document.selectionchange', event)
  const onEditorEvent = (event: Event) => log(`editor.${event.type}`, event)
  const editorEvents = [
    'pointerdown',
    'pointerup',
    'pointercancel',
    'click',
    'contextmenu',
    'touchstart',
    'touchend',
    'touchcancel',
  ]

  document.addEventListener('selectionchange', onSelectionChange, true)
  for (const eventName of editorEvents) {
    root.addEventListener(eventName, onEditorEvent, true)
  }

  logger.debug('editor selection diagnostics installed', {
    version: 2,
    root: describeElementSnapshot(root),
  })

  return () => {
    document.removeEventListener('selectionchange', onSelectionChange, true)
    for (const eventName of editorEvents) {
      root.removeEventListener(eventName, onEditorEvent, true)
    }
    logger.debug('editor selection diagnostics removed', { version: 2 })
  }
}

async function logAndroidSelectionCheckpoint(
  logger: SelectionDiagnosticLogger,
  sequence: number,
  source: string,
) {
  try {
    const state = await getAndroidEditorSelectionMenuState()
    if (!state.native) {
      return
    }

    logger.debug('android selection checkpoint', {
      version: 2,
      sequence,
      source,
      native: describeNativeSelectionState(state),
    })
  } catch (error) {
    logger.warn('Android editor selection menu state read failed', { sequence, source, error })
  }
}

function describeNativeSelectionState(state: AndroidSelectionControlResult) {
  const recentEvents = state.nativeEvents
    .split('\n')
    .filter(Boolean)
    .slice(-10)

  return {
    suppressed: state.suppressed,
    hookInstalled: state.hookInstalled,
    suppressedCreateCount: state.suppressedCreateCount,
    suppressedStartCount: state.suppressedStartCount,
    allowedCreateCount: state.allowedCreateCount,
    allowedStartCount: state.allowedStartCount,
    finishCount: state.finishCount,
    activeModeClass: state.activeModeClass,
    activeModeType: state.activeModeType,
    activeModeMenuSize: state.activeModeMenuSize,
    openActionModeCount: state.allowedStartCount + state.suppressedStartCount - state.finishCount,
    recentEvents: recentEvents.slice(-6),
  }
}

function describeSelection(root: HTMLElement, point: Point | null) {
  const selection = document.getSelection()
  if (!selection) {
    return { available: false }
  }

  const anchorNode = selection.anchorNode
  const focusNode = selection.focusNode
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  const selectedText = selection.toString()
  const rangeRect = describeDomRect(range?.getBoundingClientRect())
  const clientRects = range
    ? Array.from(range.getClientRects()).slice(0, 3).map(rect => describeDomRect(rect))
    : []
  const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null
  const focusElement = focusNode instanceof Element ? focusNode : focusNode?.parentElement ?? null

  return {
    available: true,
    type: selection.type,
    collapsed: selection.isCollapsed,
    rangeCount: selection.rangeCount,
    length: selectedText.length,
    preview: selectedText.slice(0, 48),
    anchor: describeSelectionEndpoint(anchorNode, selection.anchorOffset, root),
    focus: describeSelectionEndpoint(focusNode, selection.focusOffset, root),
    rangeStart: describeSelectionEndpoint(range?.startContainer ?? null, range?.startOffset ?? 0, root),
    rangeEnd: describeSelectionEndpoint(range?.endContainer ?? null, range?.endOffset ?? 0, root),
    commonAncestor: describeNodeToken(range?.commonAncestorContainer),
    anchorBlock: describeElementSnapshot(findSelectionBlock(anchorElement)),
    focusBlock: describeElementSnapshot(findSelectionBlock(focusElement)),
    rangeRect,
    clientRects,
    handleHitTest: describeSelectionHandleHitTest(rangeRect, clientRects),
    caretAtEventPoint: describeCaretAtPoint(point, root),
  }
}

function describeSelectionEndpoint(node: Node | null, offset: number, root: HTMLElement) {
  const element = node instanceof Element ? node : node?.parentElement ?? null
  return {
    node: describeNodeToken(node),
    offset,
    inEditor: Boolean(node && root.contains(node)),
    path: describeElementPath(element, root),
  }
}

function findSelectionBlock(element: Element | null) {
  if (!element) {
    return null
  }

  return element.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, .mu-paragraph')
}

function describeSelectionHandleHitTest(
  rangeRect: ReturnType<typeof describeDomRect>,
  clientRects: Array<ReturnType<typeof describeDomRect>>,
) {
  const firstRect = clientRects.find(Boolean)
  if (!rangeRect || !firstRect) {
    return null
  }

  const y = firstRect.bottom
  return {
    start: describeHitTest({ x: firstRect.left, y }),
    end: describeHitTest({ x: firstRect.right, y }),
  }
}

function describeCaretAtPoint(point: Point | null, root: HTMLElement) {
  if (!point) {
    return null
  }

  const documentWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }

  const range = documentWithCaret.caretRangeFromPoint?.(point.x, point.y)
  if (range) {
    return describeSelectionEndpoint(range.startContainer, range.startOffset, root)
  }

  const position = documentWithCaret.caretPositionFromPoint?.(point.x, point.y)
  if (position) {
    return describeSelectionEndpoint(position.offsetNode, position.offset, root)
  }

  return null
}

function describeHitTest(point: Point | null) {
  if (!point) {
    return null
  }

  return {
    point: roundPoint(point),
    elements: document.elementsFromPoint(point.x, point.y).slice(0, 4).map(elementToken),
  }
}

function describeEvent(event: Event | undefined) {
  if (!event) {
    return null
  }

  const base = {
    type: event.type,
    cancelable: event.cancelable,
    defaultPrevented: event.defaultPrevented,
    eventPhase: event.eventPhase,
  }

  if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent) {
    return {
      ...base,
      pointerType: event.pointerType,
      pointerId: event.pointerId,
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      buttons: event.buttons,
      pressure: event.pressure,
    }
  }

  if (event instanceof MouseEvent) {
    return {
      ...base,
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      buttons: event.buttons,
    }
  }

  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    return {
      ...base,
      touches: Array.from(event.touches).slice(0, 2).map(describeTouch),
      changedTouches: Array.from(event.changedTouches).slice(0, 2).map(describeTouch),
    }
  }

  return base
}

function getEventPoint(event: ReturnType<typeof describeEvent>): Point | null {
  if (!event) {
    return null
  }

  if ('x' in event && typeof event.x === 'number' && typeof event.y === 'number') {
    return { x: event.x, y: event.y }
  }

  if ('changedTouches' in event && Array.isArray(event.changedTouches)) {
    const touch = event.changedTouches[0]
    if (touch) {
      return { x: touch.x, y: touch.y }
    }
  }

  return null
}

function describeTouch(touch: Touch) {
  return {
    id: touch.identifier,
    x: Math.round(touch.clientX),
    y: Math.round(touch.clientY),
    radiusX: Math.round(touch.radiusX),
    radiusY: Math.round(touch.radiusY),
    force: touch.force,
  }
}

function describeViewport() {
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollX: Math.round(window.scrollX),
    scrollY: Math.round(window.scrollY),
    visual: window.visualViewport
      ? {
          width: Math.round(window.visualViewport.width),
          height: Math.round(window.visualViewport.height),
          offsetLeft: Math.round(window.visualViewport.offsetLeft),
          offsetTop: Math.round(window.visualViewport.offsetTop),
          pageLeft: Math.round(window.visualViewport.pageLeft),
          pageTop: Math.round(window.visualViewport.pageTop),
          scale: window.visualViewport.scale,
        }
      : null,
  }
}

function describeElementSnapshot(element: Element | null) {
  if (!element) {
    return null
  }

  const style = window.getComputedStyle(element)
  return {
    token: elementToken(element),
    rect: describeDomRect(element.getBoundingClientRect()),
    scroll: {
      top: element.scrollTop,
      left: element.scrollLeft,
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
    },
    style: {
      display: style.display,
      position: style.position,
      overflow: style.overflow,
      userSelect: style.userSelect,
      webkitUserSelect: style.getPropertyValue('-webkit-user-select'),
      touchAction: style.touchAction,
      pointerEvents: style.pointerEvents,
      transform: style.transform,
    },
  }
}

function describeNodeToken(node: EventTarget | Node | null | undefined) {
  if (!node) {
    return null
  }

  if (node instanceof Text) {
    return `#text(${node.textContent?.length ?? 0})<${elementToken(node.parentElement)}>`
  }

  if (node instanceof Element) {
    return elementToken(node)
  }

  return node.constructor.name
}

function describeElementPath(element: Element | null, root: HTMLElement) {
  const path = []
  let current: Element | null = element

  while (current && path.length < 6) {
    path.push(elementToken(current))
    if (current === root) {
      break
    }
    current = current.parentElement
  }

  return path
}

function elementToken(element: Element | null) {
  if (!element) {
    return 'null'
  }

  const id = element.id ? `#${element.id}` : ''
  const className =
    typeof element.className === 'string'
      ? element.className
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 4)
          .map(name => `.${name}`)
          .join('')
      : ''
  return `${element.tagName.toLowerCase()}${id}${className}`
}

function describeDomRect(rect: DOMRect | DOMRectReadOnly | null | undefined) {
  if (!rect) {
    return null
  }

  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    left: Math.round(rect.left),
  }
}

function roundPoint(point: Point) {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  }
}
