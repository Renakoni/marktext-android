const LONG_PRESS_DELAY_MS = 500
const MOVE_CANCEL_THRESHOLD_PX = 10
const LONG_PRESS_VIBRATION_MS = 10

interface UseLongPressOptions {
  onLongPress: (id: string) => void
  delayMs?: number
}

function vibrate(durationMs: number) {
  if (typeof navigator === 'undefined') {
    return
  }

  navigator.vibrate?.(durationMs)
}

/**
 * Press-and-hold detection for list items. Movement past a small threshold
 * (a scroll gesture) or losing the pointer cancels the press. After a long
 * press fires, the click dispatched on finger lift must be swallowed by the
 * item's click handler via consumeLongPressClick(), otherwise it would
 * immediately toggle or open the item the press just selected.
 */
export function useLongPress({ onLongPress, delayMs = LONG_PRESS_DELAY_MS }: UseLongPressOptions) {
  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let pointerId: number | null = null
  let pointerStartX = 0
  let pointerStartY = 0
  let suppressNextClick = false

  function clearPressTimer() {
    if (pressTimer !== null) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  function onPointerDown(event: PointerEvent, id: string) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    clearPressTimer()
    pointerId = event.pointerId
    pointerStartX = event.clientX
    pointerStartY = event.clientY
    suppressNextClick = false
    pressTimer = setTimeout(() => {
      pressTimer = null
      suppressNextClick = true
      vibrate(LONG_PRESS_VIBRATION_MS)
      onLongPress(id)
    }, delayMs)
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

  function onPointerEnd(event: PointerEvent) {
    if (pointerId !== event.pointerId) {
      return
    }

    pointerId = null
    clearPressTimer()
  }

  /** Returns true when the click following a long press should be ignored. */
  function consumeLongPressClick() {
    const suppressed = suppressNextClick
    suppressNextClick = false
    return suppressed
  }

  function cancel() {
    pointerId = null
    clearPressTimer()
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    consumeLongPressClick,
    cancel,
  }
}
