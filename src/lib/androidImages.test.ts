import { describe, expect, it } from 'vitest'
import {
  AndroidImageError,
  collectMarkTextLocalImageFileNames,
  formatImportedImageStorageBytes,
  resolveMarkTextImageSource,
} from './androidImages'

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
