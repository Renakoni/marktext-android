import { describe, expect, it } from 'vitest'
import {
  AndroidImageError,
  buildMarkTextImageSource,
  resolveMarkTextImageSource,
} from './androidImages'

describe('androidImages', () => {
  it('builds and resolves app-local Markdown image sources', () => {
    const source = buildMarkTextImageSource('picked image.png')

    expect(source).toBe('marktext-image://local/picked%20image.png')
    expect(
      resolveMarkTextImageSource(source, {
        fileUri: 'file:///data/user/0/io.github.renakoni.marktextandroid/files/images',
        webBaseUri: 'http://localhost/images',
      }),
    ).toBe('http://localhost/images/picked%20image.png')
  })

  it('rejects image source filenames that escape the image directory', () => {
    expect(() => buildMarkTextImageSource('../secret.png')).toThrow(AndroidImageError)
    expect(() =>
      resolveMarkTextImageSource('marktext-image://local/..%2Fsecret.png', {
        fileUri: 'file:///data/user/0/io.github.renakoni.marktextandroid/files/images',
      }),
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
})
