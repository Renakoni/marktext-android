<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  caretRangeAtPoint,
  computeSelectionToolbarPlacement,
  getDomSelectionSnapshot,
  getSelectionToolbarCommands,
  shouldShowSelectionToolbar,
  type SelectionToolbarCommandId,
} from '../selectionToolbar'
import { useI18n } from '../../../lib/i18n'

const props = defineProps<{
  editorReady: boolean
  suspended: boolean
  host: HTMLElement | null
  canPaste: boolean
}>()

const emit = defineEmits<{
  runCommand: [commandId: SelectionToolbarCommandId, restoreRange: Range | null]
  dismissSelection: [caretRange: Range | null]
}>()

const { t } = useI18n()
const visible = ref(false)
const left = ref(0)
const top = ref(0)
const placement = ref<'above' | 'below'>('above')
const toolbarElement = ref<HTMLElement | null>(null)
// touchstart's default is prevented on the container, so :active never
// applies on touch; this drives the pressed style instead.
const pressedCommandId = ref<SelectionToolbarCommandId | null>(null)

// Used for the first placement pass before the toolbar has rendered; the
// update loop re-measures the real element right after it becomes visible.
const FALLBACK_TOOLBAR_SIZE = { width: 194, height: 54 }
let frameId: number | null = null
// Last non-collapsed editor selection, kept so commands can restore it if the
// tap that pressed a toolbar button still managed to collapse the selection.
let lastEditorSelectionRange: Range | null = null

function scheduleUpdate() {
  if (frameId !== null) {
    return
  }

  frameId = window.requestAnimationFrame(() => {
    frameId = null
    updateFromSelection()
  })
}

function updateFromSelection() {
  const snapshot = getDomSelectionSnapshot(props.host)
  const nextVisible = shouldShowSelectionToolbar({
    editorReady: props.editorReady,
    suspended: props.suspended,
    snapshot,
  })

  if (!nextVisible || !snapshot?.rect) {
    visible.value = false
    return
  }

  const box = toolbarElement.value
    ? {
        width: toolbarElement.value.offsetWidth,
        height: toolbarElement.value.offsetHeight,
      }
    : FALLBACK_TOOLBAR_SIZE
  const placed = computeSelectionToolbarPlacement(snapshot.rect, box, {
    width: window.innerWidth,
    height: window.innerHeight,
  })

  left.value = placed.left
  top.value = placed.top
  placement.value = placed.placement

  const selection = document.getSelection()
  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    lastEditorSelectionRange = selection.getRangeAt(0).cloneRange()
  }

  if (!visible.value) {
    visible.value = true
    void nextTick(scheduleUpdate)
  }
}

function runCommand(commandId: SelectionToolbarCommandId) {
  if (!props.editorReady) {
    return
  }

  emit('runCommand', commandId, lastEditorSelectionRange)
}

// Touch path: the toolbar container prevents touchstart, because on Android
// WebView the tap gesture natively collapses the text selection before the
// synthetic mouse events (whose defaults we also prevent) are dispatched.
// With the gesture suppressed no click is synthesized either, so commands
// are dispatched from touchend, guarded to the touched button's bounds.
function runCommandFromTouch(commandId: SelectionToolbarCommandId, event: TouchEvent) {
  pressedCommandId.value = null
  const touch = event.changedTouches[0]
  const target = event.currentTarget
  if (!touch || !(target instanceof HTMLElement)) {
    return
  }

  const rect = target.getBoundingClientRect()
  const releasedInside =
    touch.clientX >= rect.left &&
    touch.clientX <= rect.right &&
    touch.clientY >= rect.top &&
    touch.clientY <= rect.bottom
  if (releasedInside) {
    runCommand(commandId)
  }
}

// Outside-tap dismissal: MIUI/Chromium keeps a selection when tapping inside
// it (it would normally re-show the native menu we suppress), so exiting a
// large selection - especially select-all - needs an explicit path. A plain
// tap in the editor outside the toolbar collapses the selection to a caret
// at that point. Scrolls and drags are excluded by the tap qualification.
const OUTSIDE_TAP_MAX_DURATION_MS = 500
const OUTSIDE_TAP_MAX_TRAVEL_PX = 24
let outsideTouchStart: { x: number; y: number; time: number } | null = null

function isInsideToolbar(target: EventTarget | null) {
  return Boolean(
    target instanceof Node && toolbarElement.value && toolbarElement.value.contains(target),
  )
}

function dismissSelectionAtPoint(x: number, y: number) {
  if (!props.host) {
    return
  }

  const hitElement = document.elementFromPoint(x, y)
  if (!hitElement || !props.host.contains(hitElement)) {
    return
  }

  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return
  }

  const range = caretRangeAtPoint(x, y)
  if (!range || !props.host.contains(range.startContainer)) {
    return
  }

  selection.removeAllRanges()
  selection.addRange(range)
  visible.value = false
  lastEditorSelectionRange = null
  emit('dismissSelection', range.cloneRange())
}

function onDocumentTouchStart(event: TouchEvent) {
  if (!visible.value || isInsideToolbar(event.target)) {
    outsideTouchStart = null
    return
  }

  const touch = event.touches[0]
  outsideTouchStart = touch
    ? { x: touch.clientX, y: touch.clientY, time: Date.now() }
    : null
}

function onDocumentTouchEnd(event: TouchEvent) {
  const start = outsideTouchStart
  outsideTouchStart = null
  if (!visible.value || !start) {
    return
  }

  const touch = event.changedTouches[0]
  if (!touch) {
    return
  }

  const travelX = touch.clientX - start.x
  const travelY = touch.clientY - start.y
  const isTap =
    Date.now() - start.time <= OUTSIDE_TAP_MAX_DURATION_MS &&
    travelX * travelX + travelY * travelY <= OUTSIDE_TAP_MAX_TRAVEL_PX ** 2
  if (isTap) {
    dismissSelectionAtPoint(touch.clientX, touch.clientY)
  }
}

function onDocumentMouseDown(event: MouseEvent) {
  if (!visible.value || isInsideToolbar(event.target)) {
    return
  }

  dismissSelectionAtPoint(event.clientX, event.clientY)
}

onMounted(() => {
  document.addEventListener('touchstart', onDocumentTouchStart, { capture: true, passive: true })
  document.addEventListener('touchend', onDocumentTouchEnd, { capture: true, passive: true })
  document.addEventListener('mousedown', onDocumentMouseDown, true)
  document.addEventListener('selectionchange', scheduleUpdate)
  document.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true })
  window.addEventListener('resize', scheduleUpdate)
  window.visualViewport?.addEventListener('resize', scheduleUpdate)
  window.visualViewport?.addEventListener('scroll', scheduleUpdate)
  scheduleUpdate()
})

onBeforeUnmount(() => {
  document.removeEventListener('touchstart', onDocumentTouchStart, { capture: true })
  document.removeEventListener('touchend', onDocumentTouchEnd, { capture: true })
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  document.removeEventListener('selectionchange', scheduleUpdate)
  document.removeEventListener('scroll', scheduleUpdate, { capture: true })
  window.removeEventListener('resize', scheduleUpdate)
  window.visualViewport?.removeEventListener('resize', scheduleUpdate)
  window.visualViewport?.removeEventListener('scroll', scheduleUpdate)
  if (frameId !== null) {
    window.cancelAnimationFrame(frameId)
    frameId = null
  }
})

watch(
  () => [props.editorReady, props.suspended, props.host, props.canPaste] as const,
  scheduleUpdate,
)
</script>

<template>
  <!-- touchstart is prevented so the Android tap gesture can never collapse
       the native text selection; mousedown is prevented so pointer/mouse
       activation never moves focus off the selection either. -->
  <div
    v-if="visible"
    ref="toolbarElement"
    class="mobile-selection-toolbar"
    :class="`is-${placement}`"
    :style="{ left: `${left}px`, top: `${top}px` }"
    role="toolbar"
    :aria-label="t('editor.selection.toolbarLabel')"
    data-testid="mobile-selection-toolbar"
    @touchstart.prevent
    @mousedown.prevent
  >
    <button
      v-for="command in getSelectionToolbarCommands(canPaste)"
      :key="command.commandId"
      class="selection-toolbar-button"
      :class="{ 'is-pressed': pressedCommandId === command.commandId }"
      type="button"
      :aria-label="t(command.labelKey)"
      :title="t(command.labelKey)"
      :data-command-id="command.commandId"
      :data-testid="`selection-command-${command.commandId}`"
      @touchstart="pressedCommandId = command.commandId"
      @touchcancel="pressedCommandId = null"
      @touchend.prevent="runCommandFromTouch(command.commandId, $event)"
      @click="runCommand(command.commandId)"
    >
      <svg
        v-if="command.iconName === 'copy'"
        class="selection-toolbar-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="9" y="8" width="10" height="12" rx="2" />
        <path d="M5 16V6a2 2 0 0 1 2-2h8" />
      </svg>
      <svg
        v-else-if="command.iconName === 'cut'"
        class="selection-toolbar-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="6" cy="7" r="2.3" />
        <circle cx="6" cy="17" r="2.3" />
        <path d="M8.1 8.1 19 19" />
        <path d="M8.1 15.9 19 5" />
      </svg>
      <svg
        v-else-if="command.iconName === 'paste'"
        class="selection-toolbar-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M9 5h6" />
        <path d="M9 4.8A2.8 2.8 0 0 1 11.8 2h.4A2.8 2.8 0 0 1 15 4.8V6H9Z" />
        <path d="M8 5H6.8A2.8 2.8 0 0 0 4 7.8v10.4A2.8 2.8 0 0 0 6.8 21h10.4a2.8 2.8 0 0 0 2.8-2.8V7.8A2.8 2.8 0 0 0 17.2 5H16" />
      </svg>
      <svg
        v-else
        class="selection-toolbar-icon selection-toolbar-icon-select-all"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M8 9h8" />
        <path d="M8 12h8" />
        <path d="M8 15h5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.mobile-selection-toolbar {
  position: fixed;
  z-index: 24;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-toolbar-menu);
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}

.selection-toolbar-button {
  display: grid;
  place-items: center;
  width: 44px;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  touch-action: manipulation;
}

.selection-toolbar-button:active,
.selection-toolbar-button.is-pressed {
  background: var(--accent-tint-11);
}

.selection-toolbar-icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.selection-toolbar-icon-select-all rect {
  stroke-dasharray: 2.4 2.4;
}
</style>
