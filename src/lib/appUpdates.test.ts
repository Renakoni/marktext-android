import { describe, expect, test } from 'vitest'
import { APP_INFO } from './appInfo'
import { checkForAppUpdates, compareVersionTags } from './appUpdates'

describe('compareVersionTags', () => {
  test('compares semver-like release tags', () => {
    expect(compareVersionTags('v1.2.0', '1.1.9')).toBe(1)
    expect(compareVersionTags('1.0.0', '1.0')).toBe(0)
    expect(compareVersionTags('0.9.0', '1.0.0')).toBe(-1)
  })
})

describe('checkForAppUpdates', () => {
  test('reports a newer GitHub release as available', async () => {
    const result = await checkForAppUpdates(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            tag_name: 'v0.1.0',
            html_url: 'https://github.com/Renakoni/marktext-android/releases/tag/v0.1.0',
          }),
          { status: 200 },
        ),
      ),
    )

    expect(result).toMatchObject({
      status: 'available',
      latestVersion: '0.1.0',
      releaseUrl: 'https://github.com/Renakoni/marktext-android/releases/tag/v0.1.0',
    })
  })

  test('handles repositories without published releases', async () => {
    const result = await checkForAppUpdates(() => Promise.resolve(new Response('', { status: 404 })))

    expect(result).toEqual({
      status: 'unavailable',
      message: 'No published releases yet',
      latestVersion: null,
      releaseUrl: APP_INFO.releasesUrl,
    })
  })
})
