import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface BackgroundIsolationState {
  activeCount: number
  inert: string | null
  ariaHidden: string | null
}

const backgroundIsolationStates = new WeakMap<HTMLElement, BackgroundIsolationState>()

interface ModalFocusOptions {
  root: Ref<HTMLElement | null>
  initialFocus?: () => HTMLElement | null
  onEscape?: () => void
  restoreFocus?: boolean
  isolateBackground?: boolean
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null) {
  if (value === null) {
    element.removeAttribute(name)
  } else {
    element.setAttribute(name, value)
  }
}

export function getModalFocusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => !element.closest('[hidden], [aria-hidden="true"], [inert]'),
  )
}

export function trapModalTabKey(root: HTMLElement, event: KeyboardEvent) {
  if (event.key !== 'Tab') {
    return
  }

  const focusables = getModalFocusableElements(root)
  if (focusables.length === 0) {
    event.preventDefault()
    root.focus({ preventScroll: true })
    return
  }

  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  const focusIsOutside = !active || !root.contains(active)

  if (focusIsOutside || active === root) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target.focus({ preventScroll: true })
  } else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus({ preventScroll: true })
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus({ preventScroll: true })
  }
}

export function isolateModalBackground(modal: HTMLElement) {
  const isolatedElements: HTMLElement[] = []
  const boundary = modal.closest<HTMLElement>('.app-shell') ?? document.body
  let branch = modal

  while (branch !== boundary && branch.parentElement) {
    const parent = branch.parentElement
    for (const sibling of parent.children) {
      if (sibling === branch || !(sibling instanceof HTMLElement)) {
        continue
      }
      const existingState = backgroundIsolationStates.get(sibling)
      if (existingState) {
        existingState.activeCount += 1
      } else {
        backgroundIsolationStates.set(sibling, {
          activeCount: 1,
          inert: sibling.getAttribute('inert'),
          ariaHidden: sibling.getAttribute('aria-hidden'),
        })
      }
      isolatedElements.push(sibling)
      sibling.setAttribute('inert', '')
      sibling.setAttribute('aria-hidden', 'true')
    }
    branch = parent
  }

  let active = true
  return () => {
    if (!active) {
      return
    }
    active = false

    for (const element of isolatedElements.reverse()) {
      const state = backgroundIsolationStates.get(element)
      if (!state) {
        continue
      }
      state.activeCount -= 1
      if (state.activeCount > 0) {
        continue
      }
      restoreAttribute(element, 'inert', state.inert)
      restoreAttribute(element, 'aria-hidden', state.ariaHidden)
      backgroundIsolationStates.delete(element)
    }
  }
}

export function useModalFocus({
  root,
  initialFocus,
  onEscape,
  restoreFocus = true,
  isolateBackground = true,
}: ModalFocusOptions) {
  let previouslyFocused: HTMLElement | null = null
  let restoreBackground: (() => void) | null = null

  function deactivate() {
    restoreBackground?.()
    restoreBackground = null
    if (restoreFocus && previouslyFocused?.isConnected) {
      previouslyFocused.focus({ preventScroll: true })
    }
    previouslyFocused = null
  }

  function focusInitial() {
    const modal = root.value
    if (!modal) {
      return
    }
    const target = initialFocus?.() ?? getModalFocusableElements(modal)[0] ?? modal
    target.focus({ preventScroll: true })
  }

  function onModalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault()
      event.stopPropagation()
      onEscape()
      return
    }
    const modal = root.value
    if (modal) {
      trapModalTabKey(modal, event)
    }
  }

  watch(root, modal => {
    if (!modal) {
      deactivate()
      return
    }
    previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    void nextTick(() => {
      if (root.value !== modal) {
        return
      }
      if (isolateBackground) {
        restoreBackground = isolateModalBackground(modal)
      }
      focusInitial()
    })
  }, { flush: 'post' })

  onBeforeUnmount(deactivate)

  return { focusInitial, onModalKeydown }
}
