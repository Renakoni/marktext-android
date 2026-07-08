import { describe, expect, it } from 'vitest'
import {
  readAndroidClipboardText,
  shouldUseAndroidSelectionControl,
  writeAndroidClipboardText,
} from './androidSelection'

describe('android selection control platform gate', () => {
  it('enables native selection control only for Android native runtime', () => {
    expect(shouldUseAndroidSelectionControl('android', true)).toBe(true)
    expect(shouldUseAndroidSelectionControl('android', false)).toBe(false)
    expect(shouldUseAndroidSelectionControl('web', true)).toBe(false)
    expect(shouldUseAndroidSelectionControl('ios', true)).toBe(false)
  })
})

describe('android clipboard bridge off Android', () => {
  it('reads empty text instead of calling the native plugin', async () => {
    await expect(readAndroidClipboardText()).resolves.toBe('')
  })

  it('reports writes as not written instead of calling the native plugin', async () => {
    await expect(writeAndroidClipboardText('draft text')).resolves.toBe(false)
  })
})
