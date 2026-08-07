package io.github.renakoni.marktextandroid;

import java.util.List;

/**
 * Skeleton seam for the planned WebDAV provider (#185 Phase 2): one
 * standard-protocol client would cover Nextcloud, ownCloud, Nutstore and
 * friends with no vendor SDK and no OAuth scope audits.
 *
 * Intended contract, mirroring {@link OneDriveGraphClient} shapes:
 * - connect: server URL + username/password (or app password) instead of a
 *   browser OAuth flow; verify with an authenticated PROPFIND on the root,
 *   then persist credentials like {@link CloudTokenStore} persists tokens.
 * - listFolder: PROPFIND depth 1 -> folders plus Markdown candidates.
 * - readFile: GET with the byte cap enforced; ETag from the response.
 * - writeFile: PUT with If-Match for conflict detection (412 -> conflict).
 *
 * Every method fails closed until the implementation lands, so the plugin
 * can already route the provider id without special-casing.
 */
final class WebDavCloudClient {

    static final String NOT_IMPLEMENTED_CODE = "CLOUD_PROVIDER_UNAVAILABLE";
    private static final String NOT_IMPLEMENTED_MESSAGE = "WebDAV support is not available yet";

    List<OneDriveGraphClient.Entry> listFolder(String folderId) throws CloudProviderException {
        throw notImplemented();
    }

    OneDriveGraphClient.FileContent readFile(String fileId, int maxBytes) throws CloudProviderException {
        throw notImplemented();
    }

    OneDriveGraphClient.WriteResult writeFile(String fileId, byte[] bytes, String expectedETag)
        throws CloudProviderException {
        throw notImplemented();
    }

    private static CloudProviderException notImplemented() {
        return new CloudProviderException(NOT_IMPLEMENTED_CODE, NOT_IMPLEMENTED_MESSAGE);
    }
}
