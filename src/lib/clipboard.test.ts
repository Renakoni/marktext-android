// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

const { writeAndroidClipboardText } = vi.hoisted(() => ({
  writeAndroidClipboardText: vi.fn(),
}))
vi.mock('./androidSelection', () => ({ writeAndroidClipboardText }))

import { copyTextToClipboard } from './clipboard'

describe('copyTextToClipboard', () => {
  afterEach(() => {
    writeAndroidClipboardText.mockReset()
    vi.unstubAllGlobals()
  })

  it('reports success when the Android clipboard bridge writes', async () => {
    writeAndroidClipboardText.mockResolvedValue(true)
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyTextToClipboard('https://example.com')).resolves.toBe(true)
    // The web fallback is never reached once the native bridge succeeds.
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to the web Clipboard API and reports its success', async () => {
    writeAndroidClipboardText.mockResolvedValue(false)
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyTextToClipboard('https://example.com')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('https://example.com')
  })

  it('reports failure when the bridge fails and the web Clipboard API is absent', async () => {
    writeAndroidClipboardText.mockResolvedValue(false)
    vi.stubGlobal('navigator', {})

    await expect(copyTextToClipboard('https://example.com')).resolves.toBe(false)
  })

  it('reports failure when the bridge fails and the web write rejects', async () => {
    writeAndroidClipboardText.mockResolvedValue(false)
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyTextToClipboard('https://example.com')).resolves.toBe(false)
  })
})
