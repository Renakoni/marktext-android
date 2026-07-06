import Sortable, { type SortableEvent } from 'sortablejs'
import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { MobileCommandId } from '../../../lib/mobileCommands'

const ENTER_EDIT_MODE_DELAY_MS = 1200
const PICK_UP_DELAY_MS = 360
const MOVE_CANCEL_THRESHOLD_PX = 10
const EDGE_SCROLL_ZONE_PX = 64
const EDGE_SCROLL_MIN_PX = 5
const EDGE_SCROLL_MAX_PX = 18

interface UseQuickBarReorderOptions {
  commandIds: Ref<readonly MobileCommandId[]>
  scrollerRef: Ref<HTMLElement | null>
  setCommandIds: (commandIds: readonly MobileCommandId[]) => void
}

function sameCommandOrder(
  current: readonly MobileCommandId[],
  next: readonly MobileCommandId[],
) {
  return current.length === next.length && current.every((commandId, index) => commandId === next[index])
}

function vibrate(durationMs: number) {
  if (typeof navigator === 'undefined') {
    return
  }

  navigator.vibrate?.(durationMs)
}

function getQuickBarCommandOrder(scroller: HTMLElement) {
  return Array.from(scroller.querySelectorAll<HTMLElement>('[data-quickbar-draggable="true"]'))
    .map(element => element.dataset.commandId)
    .filter((commandId): commandId is MobileCommandId => Boolean(commandId))
}

export function useQuickBarReorder({
  commandIds,
  scrollerRef,
  setCommandIds,
}: UseQuickBarReorderOptions) {
  const editing = ref(false)
  const pressedCommandId = ref<MobileCommandId | null>(null)
  const draggingCommandId = ref<MobileCommandId | null>(null)

  let pressTimer: number | null = null
  let pointerId: number | null = null
  let pointerStartX = 0
  let pointerStartY = 0
  let dragClientX: number | null = null
  let edgeScrollFrame = 0
  let sortable: Sortable | null = null

  function clearPressTimer() {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer)
      pressTimer = null
    }

    pressedCommandId.value = null
  }

  function commitDomOrder() {
    const scroller = scrollerRef.value
    if (!scroller) {
      return
    }

    const nextCommandIds = getQuickBarCommandOrder(scroller)
    if (
      nextCommandIds.length === commandIds.value.length &&
      !sameCommandOrder(commandIds.value, nextCommandIds)
    ) {
      setCommandIds(nextCommandIds)
    }
  }

  function setSortableEnabled(enabled: boolean) {
    sortable?.option('disabled', !enabled)
  }

  function getEventClientX(event: Event) {
    if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent && event.touches.length > 0) {
      return event.touches[0]?.clientX ?? null
    }

    if (
      typeof TouchEvent !== 'undefined' &&
      event instanceof TouchEvent &&
      event.changedTouches.length > 0
    ) {
      return event.changedTouches[0]?.clientX ?? null
    }

    if (typeof MouseEvent !== 'undefined' && event instanceof MouseEvent) {
      return event.clientX
    }

    return null
  }

  function stopEdgeScroll() {
    if (edgeScrollFrame) {
      window.cancelAnimationFrame(edgeScrollFrame)
      edgeScrollFrame = 0
    }

    dragClientX = null
  }

  function runEdgeScroll() {
    const scroller = scrollerRef.value
    if (!scroller || dragClientX === null || draggingCommandId.value === null) {
      stopEdgeScroll()
      return
    }

    const rect = scroller.getBoundingClientRect()
    const leftDistance = dragClientX - rect.left
    const rightDistance = rect.right - dragClientX
    let velocity = 0

    if (leftDistance >= 0 && leftDistance < EDGE_SCROLL_ZONE_PX) {
      const intensity = (EDGE_SCROLL_ZONE_PX - leftDistance) / EDGE_SCROLL_ZONE_PX
      velocity = -(EDGE_SCROLL_MIN_PX + intensity * (EDGE_SCROLL_MAX_PX - EDGE_SCROLL_MIN_PX))
    } else if (rightDistance >= 0 && rightDistance < EDGE_SCROLL_ZONE_PX) {
      const intensity = (EDGE_SCROLL_ZONE_PX - rightDistance) / EDGE_SCROLL_ZONE_PX
      velocity = EDGE_SCROLL_MIN_PX + intensity * (EDGE_SCROLL_MAX_PX - EDGE_SCROLL_MIN_PX)
    }

    if (velocity !== 0) {
      scroller.scrollLeft += velocity
    }

    edgeScrollFrame = window.requestAnimationFrame(runEdgeScroll)
  }

  function updateDragClientX(event: Event) {
    const clientX = getEventClientX(event)
    if (clientX === null) {
      return
    }

    dragClientX = clientX
    if (!edgeScrollFrame) {
      edgeScrollFrame = window.requestAnimationFrame(runEdgeScroll)
    }
  }

  async function createSortable(scroller: HTMLElement | null) {
    sortable?.destroy()
    sortable = null

    if (!scroller) {
      return
    }

    await nextTick()

    sortable = Sortable.create(scroller, {
      animation: 190,
      bubbleScroll: false,
      chosenClass: 'quickbar-sortable-chosen',
      delay: PICK_UP_DELAY_MS,
      delayOnTouchOnly: true,
      direction: 'horizontal',
      disabled: !editing.value,
      dragClass: 'quickbar-sortable-drag',
      draggable: '[data-quickbar-draggable="true"]',
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fallbackClass: 'quickbar-sortable-fallback',
      fallbackOnBody: true,
      fallbackTolerance: 4,
      filter: '.quickbar-remove-button',
      forceFallback: true,
      ghostClass: 'quickbar-sortable-ghost',
      invertSwap: true,
      invertedSwapThreshold: 0.45,
      preventOnFilter: false,
      scroll: true,
      scrollSensitivity: 68,
      scrollSpeed: 14,
      swapThreshold: 0.65,
      touchStartThreshold: MOVE_CANCEL_THRESHOLD_PX,
      onChoose(event: SortableEvent) {
        const commandId = event.item.dataset.commandId
        draggingCommandId.value = commandId ? commandId as MobileCommandId : null
        vibrate(8)
      },
      onMove(_event, originalEvent) {
        updateDragClientX(originalEvent)
      },
      onEnd() {
        commitDomOrder()
        draggingCommandId.value = null
        stopEdgeScroll()
      },
      onUnchoose() {
        draggingCommandId.value = null
        stopEdgeScroll()
      },
    })
  }

  function enterEditMode() {
    clearPressTimer()
    editing.value = true
    setSortableEnabled(true)
    vibrate(10)
  }

  function exitEditMode() {
    editing.value = false
    draggingCommandId.value = null
    clearPressTimer()
    setSortableEnabled(false)
  }

  function finishPointerInteraction(pointerEventId: number) {
    if (pointerId !== pointerEventId) {
      return
    }

    clearPressTimer()
    pointerId = null
  }

  function onCommandPointerDown(
    event: PointerEvent,
    commandId: MobileCommandId,
    draggable: boolean,
  ) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    clearPressTimer()
    pointerId = event.pointerId
    pointerStartX = event.clientX
    pointerStartY = event.clientY
    pressedCommandId.value = commandId

    if (editing.value || !draggable) {
      return
    }

    pressTimer = window.setTimeout(enterEditMode, ENTER_EDIT_MODE_DELAY_MS)
  }

  function onPointerMove(event: PointerEvent) {
    if (pointerId !== event.pointerId || pressTimer === null) {
      return
    }

    const movedX = Math.abs(event.clientX - pointerStartX)
    const movedY = Math.abs(event.clientY - pointerStartY)
    if (movedX > MOVE_CANCEL_THRESHOLD_PX || movedY > MOVE_CANCEL_THRESHOLD_PX) {
      clearPressTimer()
    }
  }

  function onPointerUp(event: PointerEvent) {
    finishPointerInteraction(event.pointerId)
  }

  function onPointerCancel(event: PointerEvent) {
    finishPointerInteraction(event.pointerId)
  }

  watch(scrollerRef, createSortable, { flush: 'post', immediate: true })

  watch(editing, setSortableEnabled)

  onBeforeUnmount(() => {
    clearPressTimer()
    sortable?.destroy()
    sortable = null
    stopEdgeScroll()
  })

  return {
    editing,
    pressedCommandId,
    draggingCommandId,
    enterEditMode,
    exitEditMode,
    onCommandPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }
}
