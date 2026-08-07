import { describe, expect, it } from 'vitest'

import { createGoogleDrivePickFlow } from './googleDrivePickFlow'

describe('googleDrivePickFlow ownership', () => {
  it('owns the completion while the user never left the Open page', () => {
    const flow = createGoogleDrivePickFlow()
    flow.beginFlow()

    expect(flow.ownsCompletion()).toBe(true)
  })

  it('leaving during the exchange abandons the flow', () => {
    const flow = createGoogleDrivePickFlow()
    flow.beginFlow()
    flow.noteLeftOpenPage()

    expect(flow.ownsCompletion()).toBe(false)
  })

  it('leaving and coming back does not resurrect the abandoned flow', () => {
    // The Codex round-4 scenario: exchange/download still running, user
    // goes Home and re-enters the Open page; a screen-equality check
    // would now false-positive, the generation does not.
    const flow = createGoogleDrivePickFlow()
    flow.beginFlow()
    flow.noteLeftOpenPage()
    // ...re-enters the Open page; no new flow started...

    expect(flow.ownsCompletion()).toBe(false)
  })

  it('a fresh flow after returning owns its own completion', () => {
    const flow = createGoogleDrivePickFlow()
    flow.beginFlow()
    flow.noteLeftOpenPage()
    flow.beginFlow()

    expect(flow.ownsCompletion()).toBe(true)
  })

  it('nothing is owned before any flow started', () => {
    const flow = createGoogleDrivePickFlow()

    expect(flow.ownsCompletion()).toBe(false)
  })
})
