// @vitest-environment happy-dom

import { createApp, nextTick, type App } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SETTINGS_PAGES } from '../settingsNavigation'
import SettingsDetailPage from './SettingsDetailPage.vue'

describe('SettingsDetailPage maintenance focus', () => {
  let app: App<Element> | null = null

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
  })

  afterEach(() => {
    app?.unmount()
    app = null
  })

  it('keeps focus in the dialog while every action is disabled', async () => {
    app = createApp(SettingsDetailPage, {
      page: SETTINGS_PAGES.ADVANCED,
      runMaintenanceAction: () => new Promise<void>(() => {}),
    })
    app.mount('#app')
    await nextTick()

    document.querySelector<HTMLButtonElement>('[data-testid="settings-advanced-clear-drafts-action"]')
      ?.click()
    await nextTick()
    await nextTick()

    const dialog = document.querySelector<HTMLElement>('[data-testid="settings-maintenance-sheet"]')!
    const confirm = document.querySelector<HTMLButtonElement>(
      '[data-testid="settings-maintenance-clear-confirm"]',
    )!
    confirm.focus()
    confirm.click()
    await nextTick()

    expect(confirm.disabled).toBe(true)
    expect(document.activeElement).toBe(dialog)
  })
})
