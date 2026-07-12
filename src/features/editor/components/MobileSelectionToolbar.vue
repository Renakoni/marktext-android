<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  caretRangeAtPoint,
  captureNonCollapsedSelectionRange,
  chunkSelectionCommands,
  computeSelectionToolbarPageCapacity,
  computeSelectionToolbarPlacement,
  getDomSelectionSnapshot,
  getSelectionToolbarCommands,
  shouldShowSelectionToolbar,
  type SelectionToolbarCommandId,
} from '../selectionToolbar'
import type { SelectionToolbarRows } from '../selectionToolbarSettings'
import type { MobileCommandId } from '../../../lib/mobileCommands'
import type { MobileToolbarCommandButton } from '../../../lib/mobileToolbarConfig'
import ToolbarCommandGlyph from '../../../components/ToolbarCommandGlyph.vue'
import { useI18n, type I18nKey } from '../../../lib/i18n'

const props = defineProps<{
  editorReady: boolean
  suspended: boolean
  host: HTMLElement | null
  canPaste: boolean
  caretSession: boolean
  customCommands: readonly MobileToolbarCommandButton[]
  customRows: SelectionToolbarRows
}>()

const emit = defineEmits<{
  runCommand: [commandId: SelectionToolbarCommandId, restoreRange: Range | null]
  runCustomCommand: [commandId: MobileCommandId, restoreRange: Range | null]
  dismissSelection: [caretRange: Range | null]
}>()

const { t } = useI18n()
const visible = ref(false)
// Drives the state-table action set: selection rows vs caret rows.
const hasSelection = ref(false)
// The EDITOR's actual editability — deliberately not the source-URI write
// capability: an Android document whose URI cannot be overwritten is still
// fully editable in memory (the Save-copy workflow), so it keeps Cut and
// Paste. The read-only table rows apply only when the editable surface
// itself is non-editable.
const canWrite = ref(true)
const left = ref(0)
const top = ref(0)
const placement = ref<'above' | 'below'>('above')
const toolbarElement = ref<HTMLElement | null>(null)
// touchstart's default is prevented on the container, so :active never
// applies on touch; this drives the pressed style instead. Custom command
// ids and the pager ids share the ref, hence the wide string type.
const pressedCommandId = ref<string | null>(null)
// Paging state: page 0 is the clipboard segment (single-row layout) or the
// first custom slice (two-row layout, where the clipboard row is pinned).
const customPage = ref(0)
const pageCapacity = ref(6)

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

const toolbarCommands = computed(() =>
  getSelectionToolbarCommands({
    hasSelection: hasSelection.value,
    canPaste: props.canPaste,
    canWrite: canWrite.value,
  }),
)

// Custom commands attach only to the editable+selection rows of the state
// table: caret and read-only rows keep the shipped clipboard-only surface.
const showCustomCommands = computed(
  () => hasSelection.value && canWrite.value && props.customCommands.length > 0,
)

const customPages = computed(() => {
  if (!showCustomCommands.value) {
    return []
  }

  const capacity = pageCapacity.value
  if (props.customRows === 2) {
    // The clipboard row is pinned; the custom row pages. Arrows are only
    // needed when the list overflows a single page.
    const perPage = props.customCommands.length <= capacity ? capacity : capacity - 2
    return chunkSelectionCommands(props.customCommands, perPage)
  }

  // Single-row layout: the whole row swaps between the clipboard segment and
  // custom slices, so every custom page carries both pager slots.
  return chunkSelectionCommands(props.customCommands, capacity - 2)
})

// Single-row layout: segment 0 = clipboard, segments 1..n = custom pages.
// Two-row layout: customPage indexes the custom row directly.
const totalPages = computed(() =>
  props.customRows === 2 ? customPages.value.length : customPages.value.length + 1,
)
const showClipboardRow = computed(
  () => props.customRows === 2 || !showCustomCommands.value || customPage.value === 0,
)
const activeCustomCommands = computed(() => {
  if (!showCustomCommands.value) {
    return []
  }

  const index = props.customRows === 2 ? customPage.value : customPage.value - 1
  return customPages.value[index] ?? []
})
const canPageBack = computed(() => customPage.value > 0)
const canPageForward = computed(() => customPage.value < totalPages.value - 1)
const showPager = computed(() => showCustomCommands.value && totalPages.value > 1)

function setCustomPage(delta: 1 | -1) {
  const next = customPage.value + delta
  if (next < 0 || next > totalPages.value - 1) {
    return
  }

  customPage.value = next
  void nextTick(() => {
    // The row width changes with the rendered slice; re-run placement.
    scheduleUpdate()
    rescueToolbarFocus()
  })
}

// A page flip can unmount the very button that had keyboard focus (the whole
// row swaps in single-row mode; a pager that reaches its bound becomes
// disabled). Focus falling to <body> strands hardware-keyboard and
// switch-access users, so pull it back into the bar: forward lands on the
// first command of the new page, back-to-clipboard lands on the pager that
// re-enters the custom pages.
function rescueToolbarFocus() {
  const bar = toolbarElement.value
  if (!bar) {
    return
  }

  const active = document.activeElement
  if (active && active !== document.body && bar.contains(active)) {
    return
  }

  const target = bar.querySelector<HTMLElement>(
    'button[data-testid^="selection-custom-"]:not(:disabled), [data-testid="selection-page-next"]:not(:disabled), [data-testid="selection-command-selectAll"]',
  )
  target?.focus({ preventScroll: true })
}

watch(
  () => [visible.value, hasSelection.value, props.customCommands] as const,
  () => {
    customPage.value = 0
  },
)

// A viewport-width change (rotation, foldable expansion, split screen)
// recomputes the capacity and can shrink totalPages below the current page.
// Preserve the invariant 0 <= customPage < totalPages by clamping to the
// last valid page, so the bar never strands the user on an empty page whose
// back arrow the navigation guard would reject.
watch(totalPages, total => {
  const lastValidPage = Math.max(0, total - 1)
  if (customPage.value > lastValidPage) {
    customPage.value = lastValidPage
  }
})

function commandTitle(command: { title: string; titleKey: I18nKey }) {
  return t(command.titleKey) || command.title
}

function readEditorEditability() {
  const editorRoot = props.host?.querySelector('.mu-editor')
  return editorRoot ? editorRoot.getAttribute('contenteditable') !== 'false' : true
}

function updateFromSelection() {
  const snapshot = getDomSelectionSnapshot(props.host)
  const nextVisible = shouldShowSelectionToolbar({
    editorReady: props.editorReady,
    suspended: props.suspended,
    snapshot,
    caretSession: props.caretSession,
  })

  if (!nextVisible || !snapshot?.rect) {
    visible.value = false
    return
  }

  hasSelection.value = !snapshot.collapsed
  canWrite.value = readEditorEditability()
  pageCapacity.value = computeSelectionToolbarPageCapacity(window.innerWidth)

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

  const range = captureNonCollapsedSelectionRange(props.host)
  if (range) {
    lastEditorSelectionRange = range
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

  // Caret rows must not resurrect a stale earlier selection: paste lands at
  // the long-pressed caret, not at whatever was selected minutes ago.
  emit('runCommand', commandId, hasSelection.value ? lastEditorSelectionRange : null)
}

// Custom commands ride the SAME dispatch as the bottom toolbar (range
// restore, sheet orchestration, dirty sync all inherited); only the surface
// differs. They exist solely on selection rows, so the captured range
// always accompanies them.
function runCustomCommand(commandId: MobileCommandId) {
  if (!props.editorReady) {
    return
  }

  emit('runCustomCommand', commandId, lastEditorSelectionRange)
}

// Touch path: the toolbar container prevents touchstart, because on Android
// WebView the tap gesture natively collapses the text selection before the
// synthetic mouse events (whose defaults we also prevent) are dispatched.
// With the gesture suppressed no click is synthesized either, so commands
// are dispatched from touchend, guarded to the touched button's bounds.
function touchReleasedInside(event: TouchEvent) {
  const touch = event.changedTouches[0]
  const target = event.currentTarget
  if (!touch || !(target instanceof HTMLElement)) {
    return false
  }

  const rect = target.getBoundingClientRect()
  return (
    touch.clientX >= rect.left &&
    touch.clientX <= rect.right &&
    touch.clientY >= rect.top &&
    touch.clientY <= rect.bottom
  )
}

function runCommandFromTouch(commandId: SelectionToolbarCommandId, event: TouchEvent) {
  pressedCommandId.value = null
  if (touchReleasedInside(event)) {
    runCommand(commandId)
  }
}

function runCustomCommandFromTouch(commandId: MobileCommandId, event: TouchEvent) {
  pressedCommandId.value = null
  if (touchReleasedInside(event)) {
    runCustomCommand(commandId)
  }
}

function pageFromTouch(delta: 1 | -1, event: TouchEvent) {
  pressedCommandId.value = null
  if (touchReleasedInside(event)) {
    setCustomPage(delta)
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
  () =>
    [
      props.editorReady,
      props.suspended,
      props.host,
      props.canPaste,
      props.caretSession,
    ] as const,
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
    :class="[`is-${placement}`, { 'is-two-row': customRows === 2 && showCustomCommands }]"
    :style="{ left: `${left}px`, top: `${top}px` }"
    role="toolbar"
    :aria-label="t('editor.selection.toolbarLabel')"
    data-testid="mobile-selection-toolbar"
    @touchstart.prevent
    @mousedown.prevent
  >
    <div v-if="showClipboardRow" class="selection-toolbar-row">
      <button
        v-for="command in toolbarCommands"
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
      <!-- Single-row layout: the arrow swaps the whole row to custom pages. -->
      <button
        v-if="customRows === 1 && showCustomCommands"
        class="selection-pager-button"
        :class="{ 'is-pressed': pressedCommandId === 'page-next' }"
        type="button"
        :aria-label="t('editor.selection.moreCommands')"
        data-testid="selection-page-next"
        @touchstart="pressedCommandId = 'page-next'"
        @touchcancel="pressedCommandId = null"
        @touchend.prevent="pageFromTouch(1, $event)"
        @click="setCustomPage(1)"
      >
        <svg class="selection-toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 7l5 5-5 5" />
        </svg>
      </button>
    </div>

    <div
      v-if="showCustomCommands && (customRows === 2 || customPage > 0)"
      class="selection-toolbar-row"
    >
      <button
        v-if="customRows === 1 || showPager"
        class="selection-pager-button"
        :class="{ 'is-pressed': pressedCommandId === 'page-prev' }"
        type="button"
        :disabled="!canPageBack"
        :aria-label="t('editor.selection.previousCommands')"
        data-testid="selection-page-prev"
        @touchstart="pressedCommandId = 'page-prev'"
        @touchcancel="pressedCommandId = null"
        @touchend.prevent="pageFromTouch(-1, $event)"
        @click="setCustomPage(-1)"
      >
        <svg class="selection-toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 7l-5 5 5 5" />
        </svg>
      </button>
      <button
        v-for="command in activeCustomCommands"
        :key="command.commandId"
        class="selection-toolbar-button"
        :class="{ 'is-pressed': pressedCommandId === command.commandId }"
        type="button"
        :aria-label="commandTitle(command)"
        :title="commandTitle(command)"
        :data-command-id="command.commandId"
        :data-testid="`selection-custom-${command.commandId}`"
        @touchstart="pressedCommandId = command.commandId"
        @touchcancel="pressedCommandId = null"
        @touchend.prevent="runCustomCommandFromTouch(command.commandId, $event)"
        @click="runCustomCommand(command.commandId)"
      >
        <ToolbarCommandGlyph :command="command" />
      </button>
      <button
        v-if="(customRows === 1 && canPageForward) || (customRows === 2 && showPager)"
        class="selection-pager-button"
        :class="{ 'is-pressed': pressedCommandId === 'page-next' }"
        type="button"
        :disabled="!canPageForward"
        :aria-label="t('editor.selection.moreCommands')"
        data-testid="selection-page-next"
        @touchstart="pressedCommandId = 'page-next'"
        @touchcancel="pressedCommandId = null"
        @touchend.prevent="pageFromTouch(1, $event)"
        @click="setCustomPage(1)"
      >
        <svg class="selection-toolbar-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 7l5 5-5 5" />
        </svg>
      </button>
    </div>

    <span
      v-if="showCustomCommands && totalPages > 1"
      class="selection-page-status"
      aria-live="polite"
    >
      {{ t('editor.selection.pageStatus', { current: customPage + 1, total: totalPages }) }}
    </span>
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
  border: var(--hairline) solid var(--float-border-color);
  border-radius: var(--radius);
  background: var(--surface-raised);
  box-shadow: var(--shadow-float);
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  animation: selection-toolbar-in var(--dur-quick) var(--ease-out);
}

@keyframes selection-toolbar-in {
  from {
    opacity: 0;
    transform: translateY(2px) scale(0.98);
  }
}

.mobile-selection-toolbar.is-two-row {
  flex-direction: column;
  align-items: stretch;
}

.selection-toolbar-row {
  display: flex;
  align-items: center;
  gap: 3px;
}

.selection-pager-button {
  display: grid;
  place-items: center;
  /* Same 44px minimum touch target as every command button: in single-row
     mode this arrow is the only path into the custom commands. */
  width: 44px;
  min-height: 44px;
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  touch-action: manipulation;
  transition: background-color var(--dur-standard) var(--ease-out);
}

/* Row-start pager (back arrow) hugs the left edge instead. */
.selection-pager-button:first-child {
  margin-left: 0;
  margin-right: 0;
}

.selection-pager-button:active:not(:disabled),
.selection-pager-button.is-pressed {
  background: var(--accent-tint-11);
  transition-duration: 0ms;
}

.selection-pager-button:disabled {
  opacity: 0.35;
}

/* Screen-reader-only page announcement. */
.selection-page-status {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
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
  transition: background-color var(--dur-standard) var(--ease-out);
}

.selection-toolbar-button:active,
.selection-toolbar-button.is-pressed {
  background: var(--accent-tint-11);
  transition-duration: 0ms;
}

.selection-toolbar-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .mobile-selection-toolbar {
    animation: none;
  }
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
