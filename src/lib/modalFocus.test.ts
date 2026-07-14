// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isolateModalBackground,
  trapModalTabKey,
} from './modalFocus'

function createTabEvent(shiftKey = false) {
  return new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  })
}

describe('modal focus', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('wraps Tab in both directions and pulls stray focus back into the dialog', () => {
    document.body.innerHTML = `
      <button id="outside">Outside</button>
      <section id="dialog" tabindex="-1">
        <input id="first">
        <button disabled>Disabled</button>
        <button id="last">Last</button>
      </section>
    `
    const dialog = document.querySelector<HTMLElement>('#dialog')!
    const outside = document.querySelector<HTMLElement>('#outside')!
    const first = document.querySelector<HTMLElement>('#first')!
    const last = document.querySelector<HTMLElement>('#last')!

    last.focus()
    const forward = createTabEvent()
    trapModalTabKey(dialog, forward)
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)

    const backward = createTabEvent(true)
    trapModalTabKey(dialog, backward)
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)

    outside.focus()
    const stray = createTabEvent()
    trapModalTabKey(dialog, stray)
    expect(stray.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
  })

  it('isolates every background branch up to the app shell and restores prior attributes', () => {
    document.body.innerHTML = `
      <main class="app-shell">
        <header id="header"></header>
        <div id="content">
          <div id="already-hidden" aria-hidden="false" inert></div>
          <section id="dialog"></section>
          <button id="row"></button>
        </div>
        <nav id="navigation"></nav>
      </main>
      <div id="outside-app"></div>
    `
    const dialog = document.querySelector<HTMLElement>('#dialog')!
    const backgroundIds = ['already-hidden', 'row', 'header', 'navigation']

    const restore = isolateModalBackground(dialog)

    for (const id of backgroundIds) {
      const element = document.querySelector<HTMLElement>(`#${id}`)!
      expect(element.hasAttribute('inert')).toBe(true)
      expect(element.getAttribute('aria-hidden')).toBe('true')
    }
    expect(document.querySelector('#outside-app')?.hasAttribute('inert')).toBe(false)

    restore()

    expect(document.querySelector('#already-hidden')?.hasAttribute('inert')).toBe(true)
    expect(document.querySelector('#already-hidden')?.getAttribute('aria-hidden')).toBe('false')
    for (const id of ['row', 'header', 'navigation']) {
      const element = document.querySelector<HTMLElement>(`#${id}`)!
      expect(element.hasAttribute('inert')).toBe(false)
      expect(element.hasAttribute('aria-hidden')).toBe(false)
    }
  })

  it('prevents Tab when a dialog temporarily has no enabled controls', () => {
    document.body.innerHTML = '<section id="dialog"><button disabled>Busy</button></section>'
    const dialog = document.querySelector<HTMLElement>('#dialog')!
    const event = createTabEvent()
    const focusSpy = vi.spyOn(dialog, 'focus')

    trapModalTabKey(dialog, event)

    expect(event.defaultPrevented).toBe(true)
    expect(focusSpy).not.toHaveBeenCalled()
  })
})
