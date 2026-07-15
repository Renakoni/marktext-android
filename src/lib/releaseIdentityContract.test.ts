import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { APP_INFO } from './appInfo'

function requireMatch(source: string, pattern: RegExp, label: string) {
  const match = source.match(pattern)
  expect(match, `${label} was not found`).not.toBeNull()
  return match?.[1]
}

describe('release identity contract', () => {
  const packageJson = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version?: unknown }
  const appGradle = readFileSync(new URL('../../android/app/build.gradle', import.meta.url), 'utf8')

  test('keeps web and Android versions aligned', () => {
    const androidVersion = requireMatch(appGradle, /versionName\s+["']([^"']+)["']/, 'versionName')
    const androidVersionCode = requireMatch(appGradle, /versionCode\s+(\d+)/, 'versionCode')

    expect(packageJson.version).toBe(APP_INFO.version)
    expect(androidVersion).toBe(APP_INFO.version)
    expect(Number(androidVersionCode)).toBeGreaterThan(0)
  })

  test('requires release tags to match the app version', () => {
    if (process.env.GITHUB_REF_TYPE !== 'tag') {
      return
    }

    expect(process.env.GITHUB_REF_NAME).toBe(`v${APP_INFO.version}`)
  })
})
