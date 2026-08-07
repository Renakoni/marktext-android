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
 * A public-client id is not a secret; committing it is standard practice.
 * While it is empty, connecting rejects with CLOUD_CLIENT_ID_MISSING.
 */
final class CloudAuthConfig {

    static final String ONEDRIVE_CLIENT_ID = "";

    private CloudAuthConfig() {}
}
