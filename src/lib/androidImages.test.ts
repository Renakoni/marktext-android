// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveDocumentImages = vi.fn()
const getImportedImageDirectory = vi.fn()

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
    // Identity keeps the raw content URIs visible to the assertions; the real
    // native bridge only rewrites them into a loadable URL.
    convertFileSrc: (value: string) => value,
  },
  registerPlugin: () => ({
    getImportedImageDirectory: (...args: unknown[]) => getImportedImageDirectory(...args),
    resolveDocumentImages: (...args: unknown[]) => resolveDocumentImages(...args),
  }),
}))

import {
  AndroidImageError,
  collectMarkTextLocalImageFileNames,
  ensureAndroidImageResolver,
  findLocalMarkdownImageSources,
  formatImportedImageStorageBytes,
  isLocalRelativeImageSource,
  prepareAndroidDocumentImages,
  resetAndroidDocumentImages,
  resolveMarkTextImageSource,
  shouldOfferAndroidDocumentImageAccess,
  type AndroidDocumentImagePreparation,
} from './androidImages'

const DOCUMENT_URI =
  'content://com.android.externalstorage.documents/document/primary%3A8vo%2Fpost%2FMarkText.md'
const TREE_URI = 'content://com.android.externalstorage.documents/tree/primary%3A8vo%2Fpost'

function editorResolver() {
  return (window as { MarkTextAndroidImageResolver?: (source: string) => string | null })
    .MarkTextAndroidImageResolver
}

beforeEach(() => {
  resolveDocumentImages.mockReset()
  getImportedImageDirectory.mockReset()
  getImportedImageDirectory.mockResolvedValue({ fileUri: 'file:///data/images' })
  resetAndroidDocumentImages()
})

describe('androidImages', () => {
  it('resolves app-local Markdown image sources', () => {
    expect(
      resolveMarkTextImageSource('marktext-image://local/picked%20image.png', {
        fileUri: 'file:///data/user/0/io.github.renakoni.marktextandroid/files/images',
        webBaseUri: 'http://localhost/images',
      }),
    ).toBe('http://localhost/images/picked%20image.png')
  })

  it('resolves Android URI Markdown image sources through Capacitor', () => {
    expect(
      resolveMarkTextImageSource(
        'marktext-image://android/content%3A%2F%2Fmedia%2Fimage%2F1',
        null,
      ),
    ).toBe('content://media/image/1')
  })

  it('rejects image source filenames that escape the image directory', () => {
    expect(() =>
      resolveMarkTextImageSource('marktext-image://local/..%2Fsecret.png', {
        fileUri: 'file:///data/user/0/io.github.renakoni.marktextandroid/files/images',
      }),
    ).toThrow(AndroidImageError)
  })

  it('rejects non-content Android image source URIs', () => {
    expect(() =>
      resolveMarkTextImageSource(
        'marktext-image://android/file%3A%2F%2Fsdcard%2Fphoto.png',
        null,
      ),
    ).toThrow(AndroidImageError)
  })

  it('ignores app-local image sources until the native directory is available', () => {
    expect(resolveMarkTextImageSource('marktext-image://local/picked.png', null)).toBeNull()
    expect(resolveMarkTextImageSource('marktext-image://local/..%2Fsecret.png', null)).toBeNull()
  })

  it('normalizes invalid percent-encoded image filenames into Android image errors', () => {
    expect(() =>
      resolveMarkTextImageSource('marktext-image://local/%E0%A4%A.png', {
        fileUri: 'file:///data/user/0/io.github.renakoni.marktextandroid/files/images',
      }),
    ).toThrow(AndroidImageError)
  })

  it('collects unique app-local image references from Markdown and HTML', () => {
    expect(collectMarkTextLocalImageFileNames(`
![first](marktext-image://local/1700000000000-a1b2c3d4-first.png)
<img src="marktext-image://local/1700000000001-b2c3d4e5-second.webp">
![duplicate](marktext-image://local/1700000000000-a1b2c3d4-first.png)
![linked](marktext-image://android/content%3A%2F%2Fmedia%2Fimage%2F1)
`)).toEqual([
      '1700000000000-a1b2c3d4-first.png',
      '1700000000001-b2c3d4e5-second.webp',
    ])
  })

  it('formats imported image storage without overstating precision', () => {
    expect(formatImportedImageStorageBytes(0, 'en')).toBe('0 B')
    expect(formatImportedImageStorageBytes(1536, 'en')).toBe('1.5 KB')
    expect(formatImportedImageStorageBytes(5 * 1024 * 1024, 'en')).toBe('5 MB')
  })
})

describe('local document images', () => {
  it('accepts only destinations that can name a file beside the document', () => {
    expect(isLocalRelativeImageSource('images/Designer.png')).toBe(true)
    expect(isLocalRelativeImageSource('./cover.webp')).toBe(true)
    expect(isLocalRelativeImageSource('images\\cover.jpg')).toBe(true)
    expect(isLocalRelativeImageSource('<images/with space.png>')).toBe(true)

    expect(isLocalRelativeImageSource('https://example.com/a.png')).toBe(false)
    expect(isLocalRelativeImageSource('//example.com/a.png')).toBe(false)
    expect(isLocalRelativeImageSource('data:image/png;base64,AAAA')).toBe(false)
    expect(isLocalRelativeImageSource('marktext-image://local/a.png')).toBe(false)
    expect(isLocalRelativeImageSource('/storage/emulated/0/a.png')).toBe(false)
    expect(isLocalRelativeImageSource('C:\\pictures\\a.png')).toBe(false)
    expect(isLocalRelativeImageSource('notes.txt')).toBe(false)
    expect(isLocalRelativeImageSource('')).toBe(false)
  })

  it('scans inline destinations and reference definitions, ignoring everything else', () => {
    const markdown = [
      '![cover](images/Designer.png)',
      '![spaced](<images/with space.png>)',
      '![remote](https://example.com/a.png)',
      '![rooted](/storage/emulated/0/a.png)',
      '![data](data:image/png;base64,AAAA)',
      '![inserted](marktext-image://local/a.png)',
      '![no extension](images/notes.txt)',
      '',
      '[ref]: images/ref.png',
      '![via reference][ref]',
    ].join('\n')

    expect(findLocalMarkdownImageSources(markdown)).toEqual([
      'images/Designer.png',
      'images/with space.png',
      'images/ref.png',
    ])
  })

  it('reports the folder grant as missing until the user allows it', async () => {
    resolveDocumentImages.mockResolvedValueOnce({
      supported: true,
      access: 'missing',
      folderName: 'post',
      resolved: {},
    })

    const preparation = await prepareAndroidDocumentImages({
      sourceUri: DOCUMENT_URI,
      markdown: '![cover](images/Designer.png)',
    })

    expect(preparation).toEqual({
      supported: true,
      access: 'missing',
      folderName: 'post',
      localImageCount: 1,
      unresolvedImageCount: 1,
    })
    expect(resolveDocumentImages).toHaveBeenCalledWith({
      sourceUri: DOCUMENT_URI,
      sources: ['images/Designer.png'],
    })

    await ensureAndroidImageResolver()
    expect(editorResolver()?.('images/Designer.png')).toBeNull()
  })

  it('never offers a folder grant for a provider without local siblings', async () => {
    resolveDocumentImages.mockResolvedValueOnce({
      supported: false,
      access: 'missing',
      resolved: {},
    })

    const preparation = await prepareAndroidDocumentImages({
      sourceUri: 'cloud:onedrive:item-1',
      markdown: '![cover](images/Designer.png)',
    })

    expect(preparation.supported).toBe(false)
    expect(resolveDocumentImages).not.toHaveBeenCalled()
  })

  it('serves the images Android confirmed inside the granted folder', async () => {
    resolveDocumentImages.mockResolvedValueOnce({
      supported: true,
      access: 'granted',
      folderName: 'post',
      treeUri: TREE_URI,
      treeDocumentId: 'primary:8vo/post',
      documentDirectoryId: 'primary:8vo/post',
      resolved: {
        'images/Designer.png':
          'content://com.android.externalstorage.documents/tree/primary%3A8vo%2Fpost/document/primary%3A8vo%2Fpost%2Fimages%2FDesigner.png',
      },
    })

    const preparation = await prepareAndroidDocumentImages({
      sourceUri: DOCUMENT_URI,
      markdown: '![cover](images/Designer.png)',
    })

    expect(preparation.access).toBe('granted')
    expect(preparation.unresolvedImageCount).toBe(0)

    await ensureAndroidImageResolver()
    expect(editorResolver()?.('images/Designer.png')).toBe(
      'content://com.android.externalstorage.documents/tree/primary%3A8vo%2Fpost/document/primary%3A8vo%2Fpost%2Fimages%2FDesigner.png',
    )
  })

  it('derives a sibling URI so an image typed after the open still resolves', async () => {
    resolveDocumentImages.mockResolvedValueOnce({
      supported: true,
      access: 'granted',
      treeUri: TREE_URI,
      documentDirectoryId: 'primary:8vo/post',
      resolved: {},
    })

    // A document that links nothing yet still learns the folder is granted.
    await prepareAndroidDocumentImages({ sourceUri: DOCUMENT_URI, markdown: 'No images yet.' })
    await ensureAndroidImageResolver()

    expect(editorResolver()?.('images/later.png')).toBe(
      `${TREE_URI}/document/${encodeURIComponent('primary:8vo/post/images/later.png')}`,
    )
    // Climbing above the granted folder is refused, mapped nothing.
    expect(editorResolver()?.('../../../etc/passwd.png')).toBeNull()
  })

  it('forgets the previous document images when a new document is prepared', async () => {
    resolveDocumentImages.mockResolvedValueOnce({
      supported: true,
      access: 'granted',
      treeUri: TREE_URI,
      documentDirectoryId: 'primary:8vo/post',
      resolved: {},
    })
    await prepareAndroidDocumentImages({ sourceUri: DOCUMENT_URI, markdown: '' })
    await ensureAndroidImageResolver()
    expect(editorResolver()?.('images/later.png')).not.toBeNull()

    await prepareAndroidDocumentImages({ sourceUri: null, markdown: '' })
    expect(editorResolver()?.('images/later.png')).toBeNull()
  })
})

describe('shouldOfferAndroidDocumentImageAccess', () => {
  const unreachable: AndroidDocumentImagePreparation = {
    supported: true,
    access: 'missing',
    folderName: 'post',
    localImageCount: 2,
    unresolvedImageCount: 2,
  }

  it('offers the document folder when a linked sibling is unreachable', () => {
    expect(shouldOfferAndroidDocumentImageAccess(unreachable, DOCUMENT_URI)).toBe(true)
  })

  it('stays quiet for drafts, cloud documents, other providers, and held grants', () => {
    expect(shouldOfferAndroidDocumentImageAccess(unreachable, null)).toBe(false)
    expect(
      shouldOfferAndroidDocumentImageAccess(unreachable, 'cloud:onedrive:item-1'),
    ).toBe(false)
    expect(
      shouldOfferAndroidDocumentImageAccess({ ...unreachable, supported: false }, DOCUMENT_URI),
    ).toBe(false)
    expect(
      shouldOfferAndroidDocumentImageAccess({ ...unreachable, access: 'granted' }, DOCUMENT_URI),
    ).toBe(false)
    expect(
      shouldOfferAndroidDocumentImageAccess(
        { ...unreachable, unresolvedImageCount: 0 },
        DOCUMENT_URI,
      ),
    ).toBe(false)
  })
})
