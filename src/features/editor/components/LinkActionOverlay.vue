<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { computeSelectionToolbarPlacement } from '../selectionToolbar'
import { LINK_WRAPPER_SELECTOR, getOpenableLinkTarget, readLinkWrapperHref } from '../linkTargets'
import { copyTextToClipboard } from '../../../lib/clipboard'
import { useI18n } from '../../../lib/i18n'

const props = defineProps<{
  editorReady: boolean
  // A sheet or prompt owns the surface: the overlay stands down like the
  // selection toolbar does.
  suspended: boolean
  // A long-press caret session already shows the selection toolbar; never
  // stack a second floating bar over it.
  caretSession: boolean
  // The stable editor containment root (Muya replaces the inner host on init).
  host: HTMLElement | null
  // The `linkPopup` editing setting: the whole affordance is opt-out.
  enabled: boolean
}>()

const emit = defineEmits<{
  open: [href: string]
}>()

const { t } = useI18n()

const visible = ref(false)
const href = ref('')
const left = ref(0)
const top = ref(0)
const placement = ref<'above' | 'below'>('above')
const overlayElement = ref<HTMLElement | null>(null)
const pressedId = ref<'open' | 'copy' | null>(null)
// After Copy, the button confirms in place for a moment instead of relying on
// a global toast — self-contained, honest, and does not clobber the save-state
// line. Reset on any move that hides the overlay.
const copied = ref(false)
let copiedTimer: number | null = null

// First placement pass runs before the bar has rendered; the update loop
// re-measures the real element as soon as it is visible.
const FALLBACK_OVERLAY_SIZE = { width: 99, height: 52 }
let frameId: number | null = null

function clearCopiedFeedback() {
  copied.value = false
  if (copiedTimer !== null) {
    window.clearTimeout(copiedTimer)
    copiedTimer = null
  }
}

function hide() {
  if (visible.value) {
    visible.value = false
  }
  clearCopiedFeedback()
}

// The Muya link wrapper closest to the collapsed caret, only when the caret is
// a plain caret (no selection) sitting inside the editor. A text selection or a
// caret session belongs to the selection toolbar, not here.
function resolveCaretLinkTarget(): { element: HTMLElement; target: string } | null {
  const host = props.host
  if (!host) {
    return null
  }

  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null
  }

  const anchor = selection.anchorNode
  if (!anchor || !host.contains(anchor)) {
    return null
  }

  const element = anchor instanceof Element ? anchor : anchor.parentElement
  const wrapper = element?.closest<HTMLElement>(LINK_WRAPPER_SELECTOR) ?? null
  if (!wrapper || !host.contains(wrapper)) {
    return null
  }

  const target = getOpenableLinkTarget(readLinkWrapperHref(wrapper))
  return target ? { element: wrapper, target } : null
}

function updateFromSelection() {
  if (!props.enabled || !props.editorReady || props.suspended || props.caretSession) {
    hide()
    return
  }

  const resolved = resolveCaretLinkTarget()
  if (!resolved) {
    hide()
    return
  }

  const rect = resolved.element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    hide()
    return
  }

  if (href.value !== resolved.target) {
    // Moving to a different link cancels any lingering "Copied" state.
    clearCopiedFeedback()
    href.value = resolved.target
  }

  const box = overlayElement.value
    ? { width: overlayElement.value.offsetWidth, height: overlayElement.value.offsetHeight }
    : FALLBACK_OVERLAY_SIZE
  const placed = computeSelectionToolbarPlacement(
    {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    },
    box,
    { width: window.innerWidth, height: window.innerHeight },
  )
  left.value = placed.left
  top.value = placed.top
  placement.value = placed.placement

  if (!visible.value) {
    visible.value = true
    void nextFramePlacement()
  }
}

// Re-measure once the real bar exists so a wide URL label cannot push it off
// screen (mirrors the selection toolbar's post-show pass).
function nextFramePlacement(): Promise<void> {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => {
      updateFromSelection()
      resolve()
    })
  })
}

function scheduleUpdate() {
  if (frameId !== null) {
    return
  }

  frameId = window.requestAnimationFrame(() => {
    frameId = null
    updateFromSelection()
  })
}

// Touch path mirrors the selection toolbar: the container prevents touchstart
// so a tap can never collapse or move the caret out of the link (which would
// hide the overlay mid-tap); commands fire from a guarded touchend.
function releasedInside(event: TouchEvent) {
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

function openLink() {
  if (href.value) {
    emit('open', href.value)
  }
}

async function copyLink() {
  const target = href.value
  if (!target) {
    return
  }

  const written = await copyTextToClipboard(target)
  // Confirm ONLY after a real write, and only if the overlay is still showing
  // the same link: during the await the caret may have moved to another link
  // or left entirely, and a stale success must never light up a new target.
  if (!written || !visible.value || href.value !== target) {
    return
  }

  copied.value = true
  if (copiedTimer !== null) {
    window.clearTimeout(copiedTimer)
  }
  copiedTimer = window.setTimeout(() => {
    copied.value = false
    copiedTimer = null
  }, 1500)
}

function openFromTouch(event: TouchEvent) {
  pressedId.value = null
  if (releasedInside(event)) {
    openLink()
  }
}

function copyFromTouch(event: TouchEvent) {
  pressedId.value = null
  if (releasedInside(event)) {
    void copyLink()
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', scheduleUpdate)
  document.addEventListener('scroll', scheduleUpdate, { capture: true, passive: true })
  window.addEventListener('resize', scheduleUpdate)
  window.visualViewport?.addEventListener('resize', scheduleUpdate)
  window.visualViewport?.addEventListener('scroll', scheduleUpdate)
  scheduleUpdate()
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', scheduleUpdate)
  document.removeEventListener('scroll', scheduleUpdate, { capture: true })
  window.removeEventListener('resize', scheduleUpdate)
  window.visualViewport?.removeEventListener('resize', scheduleUpdate)
  window.visualViewport?.removeEventListener('scroll', scheduleUpdate)
  if (frameId !== null) {
    window.cancelAnimationFrame(frameId)
    frameId = null
  }
  clearCopiedFeedback()
})

watch(
  () =>
    [props.editorReady, props.suspended, props.caretSession, props.host, props.enabled] as const,
  scheduleUpdate,
)
</script>

<template>
  <div
    v-if="visible"
    ref="overlayElement"
    class="link-action-overlay"
    :class="`is-${placement}`"
    :style="{ left: `${left}px`, top: `${top}px` }"
    role="toolbar"
    :aria-label="t('editor.link.overlayLabel')"
    data-testid="link-action-overlay"
    @touchstart.prevent
    @mousedown.prevent
  >
    <button
      class="link-action-button"
      :class="{ 'is-pressed': pressedId === 'open' }"
      type="button"
      :aria-label="t('editor.link.open')"
      :title="t('editor.link.open')"
      data-testid="link-action-open"
      @touchstart="pressedId = 'open'"
      @touchcancel="pressedId = null"
      @touchend.prevent="openFromTouch"
      @click="openLink"
    >
      <svg class="link-action-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 4h6v6" />
        <path d="M20 4l-8 8" />
        <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
      </svg>
    </button>
    <button
      class="link-action-button"
      :class="{ 'is-pressed': pressedId === 'copy' }"
      type="button"
      :aria-label="copied ? t('editor.link.copied') : t('editor.link.copy')"
      :title="copied ? t('editor.link.copied') : t('editor.link.copy')"
      data-testid="link-action-copy"
      @touchstart="pressedId = 'copy'"
      @touchcancel="pressedId = null"
      @touchend.prevent="copyFromTouch"
      @click="copyLink"
    >
      <svg
        v-if="copied"
        class="link-action-icon link-action-icon-check"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M5 12.5l4.5 4.5L19 7" />
      </svg>
      <svg v-else class="link-action-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="8" width="10" height="12" rx="2" />
        <path d="M5 16V6a2 2 0 0 1 2-2h8" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.link-action-overlay {
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
  animation: link-action-overlay-in var(--dur-quick) var(--ease-out);
}

@keyframes link-action-overlay-in {
  from {
    opacity: 0;
    transform: translateY(2px) scale(0.98);
  }
}

.link-action-button {
  display: grid;
  place-items: center;
  flex: none;
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

.link-action-button:active,
.link-action-button.is-pressed {
  background: var(--accent-tint-11);
  transition-duration: 0ms;
}

.link-action-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
  .link-action-overlay {
    animation: none;
  }
}

.link-action-icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.link-action-icon-check {
  color: var(--accent);
}
</style>
