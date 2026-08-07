package io.github.renakoni.marktextandroid;

/**
 * OAuth client configuration for cloud providers.
 *
 * The OneDrive client id comes from a (free) Microsoft Entra app
 * registration: portal.azure.com -> App registrations -> New registration,
 * supported account types "personal and organizational", platform "Mobile
 * and desktop applications" with BOTH redirect URIs registered:
 *   io.github.renakoni.marktextandroid://oauth/onedrive
 *   io.github.renakoni.marktextandroid.debug://oauth/onedrive
 * (the scheme follows the applicationId, so debug and release installs
 * never race for the same redirect).
 *
 * The Google Drive client id is NOT here: Google binds Android OAuth
 * clients to the package name AND signing-certificate SHA-1, so the id is
 * a per-variant resource (`googledrive_client_id` resValue in
 * app/build.gradle — debug and release each carry their own registered
 * client). The redirect scheme is derived from the id
 * ({@link GoogleDriveClient#redirectSchemeFor}) and each variant's
 * intent-filter lives in its own manifest overlay (src/debug,
 * src/release) for the same reason.
 *
 * While an id is empty, the provider reads unavailable and connecting
 * rejects with CLOUD_CLIENT_ID_MISSING.
 */
final class CloudAuthConfig {

    static final String ONEDRIVE_CLIENT_ID = "12cb7287-50f6-494b-9abc-b2879a200d39";

    private CloudAuthConfig() {}
}
