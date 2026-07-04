import type { SettingsValue } from '../settings/settingsState'

export type ImageSharingSettingKey = 'imageCopyImages' | 'shareImages' | 'shareLinkedImages'
export type ImageShareMode = 'attach' | 'link-only'

export interface ImageSharingSettings {
  imageCopyImages: boolean
  shareImages: ImageShareMode
  shareLinkedImages: boolean
}

export const IMAGE_SHARING_SETTING_KEYS = [
  'imageCopyImages',
  'shareImages',
  'shareLinkedImages',
] as const satisfies readonly ImageSharingSettingKey[]

export const DEFAULT_IMAGE_SHARING_SETTINGS = {
  imageCopyImages: true,
  shareImages: 'attach',
  shareLinkedImages: false,
} as const satisfies ImageSharingSettings

const IMAGE_SHARE_MODES = new Set<ImageShareMode>(['attach', 'link-only'])

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeChoice<T extends string>(value: unknown, options: Set<T>, fallback: T): T {
  return options.has(value as T) ? (value as T) : fallback
}

export function normalizeImageSharingSettingValue(
  key: ImageSharingSettingKey,
  value: SettingsValue,
) {
  switch (key) {
    case 'imageCopyImages':
      return normalizeBoolean(value, DEFAULT_IMAGE_SHARING_SETTINGS.imageCopyImages)
    case 'shareImages':
      return normalizeChoice(value, IMAGE_SHARE_MODES, DEFAULT_IMAGE_SHARING_SETTINGS.shareImages)
    case 'shareLinkedImages':
      // TODO: Wire linked image sharing after Android URI image export is supported.
      return normalizeBoolean(value, DEFAULT_IMAGE_SHARING_SETTINGS.shareLinkedImages)
  }
}

export function getImageSharingSettings(
  getValue: <T extends SettingsValue>(key: string, defaultValue: T) => T,
): ImageSharingSettings {
  return {
    imageCopyImages: normalizeBoolean(
      getValue('imageCopyImages', DEFAULT_IMAGE_SHARING_SETTINGS.imageCopyImages),
      DEFAULT_IMAGE_SHARING_SETTINGS.imageCopyImages,
    ),
    shareImages: normalizeChoice(
      getValue('shareImages', DEFAULT_IMAGE_SHARING_SETTINGS.shareImages),
      IMAGE_SHARE_MODES,
      DEFAULT_IMAGE_SHARING_SETTINGS.shareImages,
    ),
    shareLinkedImages: normalizeBoolean(
      getValue('shareLinkedImages', DEFAULT_IMAGE_SHARING_SETTINGS.shareLinkedImages),
      DEFAULT_IMAGE_SHARING_SETTINGS.shareLinkedImages,
    ),
  }
}

export function shouldAttachImagesWhenSharing(
  settings: Pick<ImageSharingSettings, 'shareImages'>,
) {
  return settings.shareImages === 'attach'
}
