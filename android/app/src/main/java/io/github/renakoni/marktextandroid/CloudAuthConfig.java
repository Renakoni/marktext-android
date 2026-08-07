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
 * The Google Drive client is an "Android" OAuth client in Google Cloud
 * Console; Google binds it to the package name AND signing-certificate
 * SHA-1, and the redirect scheme is the reversed client id. The committed
 * id is the DEBUG client (package io.github.renakoni.marktextandroid.debug,
 * debug keystore SHA-1) — release-signed builds cannot complete the Google
 * sign-in until a release client is registered and these constants become
 * build-variant aware. The Picker API key is restricted to the Picker and
 * Drive APIs in the console; both values are public-client configuration,
 * not secrets.
 *
 * While an id is empty, connecting rejects with CLOUD_CLIENT_ID_MISSING.
 */
final class CloudAuthConfig {

    static final String ONEDRIVE_CLIENT_ID = "12cb7287-50f6-494b-9abc-b2879a200d39";

    static final String GOOGLEDRIVE_CLIENT_ID =
        "432194989716-i513ggpqg5mt3853s584b9o6s4cp159l.apps.googleusercontent.com";
    /** Reversed client id — must match the manifest intent-filter scheme. */
    static final String GOOGLEDRIVE_REDIRECT_SCHEME =
        "com.googleusercontent.apps.432194989716-i513ggpqg5mt3853s584b9o6s4cp159l";
    static final String GOOGLE_PICKER_API_KEY = "AIzaSyB9FLWQjFgMSMndNhWqX7qlfDUgSKXy91k";
    /** Cloud project number; the Picker needs it to grant drive.file access to picks. */
    static final String GOOGLE_PROJECT_NUMBER = "432194989716";

    private CloudAuthConfig() {}
}
