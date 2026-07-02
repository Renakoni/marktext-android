import { APP_INFO } from './appInfo'

interface GitHubReleaseResponse {
  tag_name?: unknown
  html_url?: unknown
}

export type AppUpdateCheckResult =
  | {
      status: 'available'
      message: string
      latestVersion: string
      releaseUrl: string | null
    }
  | {
      status: 'current' | 'unavailable'
      message: string
      latestVersion: string | null
      releaseUrl: string | null
    }

type ReleaseFetch = typeof fetch

function normalizeVersionTag(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().replace(/^v/i, '')
  return normalized || null
}

function parseVersionParts(value: string) {
  const version = normalizeVersionTag(value)?.split(/[+-]/, 1)[0]
  if (!version) {
    return null
  }

  const parts = version.split('.').map(part => Number.parseInt(part, 10))
  if (parts.some(part => Number.isNaN(part))) {
    return null
  }

  return parts
}

export function compareVersionTags(left: string, right: string) {
  const leftParts = parseVersionParts(left)
  const rightParts = parseVersionParts(right)

  if (!leftParts || !rightParts) {
    return normalizeVersionTag(left) === normalizeVersionTag(right) ? 0 : 1
  }

  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0
    const rightValue = rightParts[index] ?? 0
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1
    }
  }

  return 0
}

export async function checkForAppUpdates(fetchRelease: ReleaseFetch = fetch) {
  try {
    const response = await fetchRelease(APP_INFO.latestReleaseApiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
    })

    if (response.status === 404) {
      return {
        status: 'unavailable',
        message: 'No published releases yet',
        latestVersion: null,
        releaseUrl: APP_INFO.releasesUrl,
      } satisfies AppUpdateCheckResult
    }

    if (!response.ok) {
      return {
        status: 'unavailable',
        message: `Could not check updates (${response.status})`,
        latestVersion: null,
        releaseUrl: APP_INFO.releasesUrl,
      } satisfies AppUpdateCheckResult
    }

    const release = (await response.json()) as GitHubReleaseResponse
    const latestVersion = normalizeVersionTag(release.tag_name)
    const releaseUrl = typeof release.html_url === 'string' ? release.html_url : APP_INFO.releasesUrl

    if (!latestVersion) {
      return {
        status: 'unavailable',
        message: 'Latest release did not include a version',
        latestVersion: null,
        releaseUrl,
      } satisfies AppUpdateCheckResult
    }

    if (compareVersionTags(latestVersion, APP_INFO.version) > 0) {
      return {
        status: 'available',
        message: `Update available: v${latestVersion}`,
        latestVersion,
        releaseUrl,
      } satisfies AppUpdateCheckResult
    }

    return {
      status: 'current',
      message: 'You are on the latest version',
      latestVersion,
      releaseUrl,
    } satisfies AppUpdateCheckResult
  } catch {
    return {
      status: 'unavailable',
      message: 'Could not reach GitHub releases',
      latestVersion: null,
      releaseUrl: APP_INFO.releasesUrl,
    } satisfies AppUpdateCheckResult
  }
}
