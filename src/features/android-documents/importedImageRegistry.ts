import { collectMarkTextLocalImageFileNames } from '../../lib/androidImages'

export const IMPORTED_IMAGE_REGISTRY_STORAGE_KEY =
  'marktext-for-android:imported-image-registry'

interface ImportedImageRegistryStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ImportedImageRegistrySnapshot {
  managedFileNames: string[]
  protectedFileNames: string[]
}

interface StoredImportedImageRegistry extends ImportedImageRegistrySnapshot {
  version: 1
}

const EMPTY_REGISTRY: ImportedImageRegistrySnapshot = {
  managedFileNames: [],
  protectedFileNames: [],
}

// SAF cannot prove that an external document stopped referencing an image.
// Protection is therefore monotonic, and pre-registry files never enter the managed cleanup set.

function getDefaultStorage(): ImportedImageRegistryStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function normalizeStoredFileNames(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const fileNames = new Set<string>()
  for (const valueItem of value) {
    if (typeof valueItem !== 'string') {
      continue
    }
    const markdownSource = `marktext-image://local/${encodeURIComponent(valueItem)}`
    for (const fileName of collectMarkTextLocalImageFileNames(markdownSource)) {
      fileNames.add(fileName)
    }
  }
  return [...fileNames]
}

export function readImportedImageRegistry(
  storage: ImportedImageRegistryStorage | null = getDefaultStorage(),
): ImportedImageRegistrySnapshot {
  if (!storage) {
    return { ...EMPTY_REGISTRY }
  }

  try {
    const value: unknown = JSON.parse(
      storage.getItem(IMPORTED_IMAGE_REGISTRY_STORAGE_KEY) ?? 'null',
    )
    if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) {
      return { ...EMPTY_REGISTRY }
    }
    const registry = value as Partial<StoredImportedImageRegistry>
    return {
      managedFileNames: normalizeStoredFileNames(registry.managedFileNames),
      protectedFileNames: normalizeStoredFileNames(registry.protectedFileNames),
    }
  } catch {
    return { ...EMPTY_REGISTRY }
  }
}

function writeImportedImageRegistry(
  registry: ImportedImageRegistrySnapshot,
  storage: ImportedImageRegistryStorage | null,
) {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(IMPORTED_IMAGE_REGISTRY_STORAGE_KEY, JSON.stringify({
      version: 1,
      ...registry,
    } satisfies StoredImportedImageRegistry))
    return true
  } catch {
    return false
  }
}

export function registerImportedImageCopy(
  markdownSource: string,
  protectFromCleanup: boolean,
  storage: ImportedImageRegistryStorage | null = getDefaultStorage(),
) {
  const importedFileNames = collectMarkTextLocalImageFileNames(markdownSource)
  if (importedFileNames.length === 0) {
    return true
  }

  const registry = readImportedImageRegistry(storage)
  return writeImportedImageRegistry({
    managedFileNames: [...new Set([...registry.managedFileNames, ...importedFileNames])],
    protectedFileNames: protectFromCleanup
      ? [...new Set([...registry.protectedFileNames, ...importedFileNames])]
      : registry.protectedFileNames,
  }, storage)
}

export function protectImportedImagesInAndroidDocument(
  markdown: string,
  storage: ImportedImageRegistryStorage | null = getDefaultStorage(),
) {
  const referencedFileNames = collectMarkTextLocalImageFileNames(markdown)
  if (referencedFileNames.length === 0) {
    return true
  }

  const registry = readImportedImageRegistry(storage)
  return writeImportedImageRegistry({
    ...registry,
    protectedFileNames: [
      ...new Set([...registry.protectedFileNames, ...referencedFileNames]),
    ],
  }, storage)
}
