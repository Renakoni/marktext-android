import { describe, expect, it } from 'vitest'
import {
  IMPORTED_IMAGE_REGISTRY_STORAGE_KEY,
  protectImportedImagesInAndroidDocument,
  readImportedImageRegistry,
  registerImportedImageCopy,
} from './importedImageRegistry'

function createMemoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('imported image registry', () => {
  it('keeps pre-registry files outside the managed cleanup set', () => {
    const storage = createMemoryStorage()

    expect(readImportedImageRegistry(storage)).toEqual({
      managedFileNames: [],
      protectedFileNames: [],
    })
  })

  it('persists managed imports and Android document protection independently of recents', () => {
    const storage = createMemoryStorage()

    expect(registerImportedImageCopy(
      'marktext-image://local/draft.png',
      false,
      storage,
    )).toBe(true)
    expect(registerImportedImageCopy(
      'marktext-image://local/android.png',
      true,
      storage,
    )).toBe(true)
    expect(protectImportedImagesInAndroidDocument(
      '![shared](marktext-image://local/shared.png)',
      storage,
    )).toBe(true)

    expect(readImportedImageRegistry(storage)).toEqual({
      managedFileNames: ['draft.png', 'android.png'],
      protectedFileNames: ['android.png', 'shared.png'],
    })
    expect(storage.getItem(IMPORTED_IMAGE_REGISTRY_STORAGE_KEY)).not.toBeNull()
  })
})
