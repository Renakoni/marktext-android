import type { CloudProviderId } from './cloudDocuments'

/**
 * Cloud documents ride the android-document pipeline (state, recents,
 * autosave, recovery drafts) with a synthetic source URI in place of the
 * SAF content URI. The `cloud:` scheme is the routing key: the bridge
 * dispatches reads/writes on it, and the native SAF path can never receive
 * one (its parser accepts only content://).
 */
const CLOUD_URI_PREFIX = 'cloud:'

export function buildCloudSourceUri(provider: CloudProviderId, fileId: string) {
  return `${CLOUD_URI_PREFIX}${provider}:${fileId}`
}

export function isCloudSourceUri(sourceUri: string | null | undefined): sourceUri is string {
  return typeof sourceUri === 'string' && sourceUri.startsWith(CLOUD_URI_PREFIX)
}

export function parseCloudSourceUri(
  sourceUri: string | null | undefined,
): { provider: CloudProviderId; fileId: string } | null {
  if (!isCloudSourceUri(sourceUri)) {
    return null
  }

  const rest = sourceUri.slice(CLOUD_URI_PREFIX.length)
  const providerEnd = rest.indexOf(':')
  if (providerEnd <= 0 || providerEnd === rest.length - 1) {
    return null
  }

  const provider = rest.slice(0, providerEnd)
  if (provider !== 'onedrive' && provider !== 'googledrive' && provider !== 'webdav') {
    return null
  }
  return { provider, fileId: rest.slice(providerEnd + 1) }
}
