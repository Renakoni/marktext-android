import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLongPress } from './useLongPress'

function pointerEvent(overrides: Partial<PointerEvent> = {}) {
  return {
    pointerType: 'touch',
    pointerId: 1,
    button: 0,
    clientX: 10,
    clientY: 20,
    ...overrides,
  } as PointerEvent
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires after the press delay and suppresses the following click', () => {
    const onLongPress = vi.fn()
    const press = useLongPress({ onLongPress })

    press.onPointerDown(pointerEvent(), 'draft-1')
    vi.advanceTimersByTime(500)

    expect(onLongPress).toHaveBeenCalledWith('draft-1')
    expect(press.consumeLongPressClick()).toBe(true)
    // The suppression applies to a single click only.
    expect(press.consumeLongPressClick()).toBe(false)
  })

  it('cancels when the pointer moves like a scroll gesture', () => {
    const onLongPress = vi.fn()
    const press = useLongPress({ onLongPress })

    press.onPointerDown(pointerEvent(), 'draft-1')
    press.onPointerMove(pointerEvent({ clientY: 40 }))
    vi.advanceTimersByTime(1000)

    expect(onLongPress).not.toHaveBeenCalled()
  })

  it('does not suppress the click of a short tap', () => {
    const onLongPress = vi.fn()
    const press = useLongPress({ onLongPress })

    press.onPointerDown(pointerEvent(), 'draft-1')
    vi.advanceTimersByTime(200)
    press.onPointerEnd(pointerEvent())
    vi.advanceTimersByTime(1000)

    expect(onLongPress).not.toHaveBeenCalled()
    expect(press.consumeLongPressClick()).toBe(false)
  })

  it('ignores secondary mouse buttons and small jitters', () => {
    const onLongPress = vi.fn()
    const press = useLongPress({ onLongPress })

    press.onPointerDown(pointerEvent({ pointerType: 'mouse', button: 2 }), 'draft-1')
    vi.advanceTimersByTime(1000)
    expect(onLongPress).not.toHaveBeenCalled()

    press.onPointerDown(pointerEvent(), 'draft-1')
    press.onPointerMove(pointerEvent({ clientX: 14, clientY: 24 }))
    vi.advanceTimersByTime(500)
    expect(onLongPress).toHaveBeenCalledWith('draft-1')
  })
})
