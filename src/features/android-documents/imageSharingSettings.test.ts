import { describe, expect, it } from 'vitest'
import type { SettingsValue } from '../settings/settingsState'
import {
  getImageSharingSettings,
  normalizeImageSharingSettingValue,
  shouldAttachImagesWhenSharing,
} from './imageSharingSettings'

describe('imageSharingSettings', () => {
  it('normalizes image and share setting values', () => {
    expect(normalizeImageSharingSettingValue('imageCopyImages', false)).toBe(false)
    expect(normalizeImageSharingSettingValue('imageCopyImages', 'false')).toBe(true)
    expect(normalizeImageSharingSettingValue('shareImages', 'link-only')).toBe('link-only')
    expect(normalizeImageSharingSettingValue('shareImages', 'bad')).toBe('attach')
    expect(normalizeImageSharingSettingValue('shareLinkedImages', true)).toBe(true)
    expect(normalizeImageSharingSettingValue('shareLinkedImages', 'true')).toBe(false)
  })

  it('reads settings with safe defaults', () => {
    const values: Record<string, SettingsValue> = {
      imageCopyImages: false,
      shareImages: 'link-only',
      shareLinkedImages: true,
    }

    const settings = getImageSharingSettings((key, fallback) => {
      const value = values[key]
      return value === undefined ? fallback : (value as typeof fallback)
    })

    expect(settings).toEqual({
      imageCopyImages: false,
      shareImages: 'link-only',
      shareLinkedImages: true,
    })
    expect(shouldAttachImagesWhenSharing(settings)).toBe(false)
  })
})
