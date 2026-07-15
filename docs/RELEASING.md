# Releasing MarkText for Android

The first distribution channel is GitHub Releases. Release APKs must keep the
application id `io.github.renakoni.marktextandroid` and must always be signed by
the same release certificate.

## Key custody

- Keep the release keystore outside the repository.
- Keep its password and alias in a password manager.
- Maintain at least two encrypted, independently restorable keystore backups.
- Never print, commit, attach, or upload the raw keystore except as an encrypted
  GitHub Actions secret.

Official release certificate SHA-256:

```text
6E:C9:22:52:5B:CE:18:03:42:8B:80:F0:E2:57:7D:18:24:6B:22:90:B4:F3:BB:16:15:0F:A7:07:D1:81:9C:67
```

The release workflow rejects APKs signed by any other certificate.

## Repository secrets

Configure these in GitHub repository settings under Actions secrets:

```text
ANDROID_RELEASE_KEYSTORE_BASE64
ANDROID_RELEASE_STORE_PASSWORD
ANDROID_RELEASE_KEY_ALIAS
ANDROID_RELEASE_KEY_PASSWORD
```

On Windows, copy the keystore's Base64 form without printing it:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes('E:\marktext-signing\marktext-release.jks')
) | Set-Clipboard
```

Use `marktext-release` for the alias. The store and key password may be the same
high-entropy password. Clear the clipboard after each secret is entered.

## Release sequence

1. Increment Android `versionCode`.
2. Set the same semantic version in `android/app/build.gradle`, `package.json`,
   and `src/lib/appInfo.ts`.
3. Merge the release candidate after normal pull-request checks pass.
4. Run the Android Release workflow manually to obtain a signed candidate APK.
5. Verify clean install and same-key upgrade on devices without losing app data.
6. Create and push the matching tag, for example `v0.1.0`.
7. The tag workflow verifies the version, signature, and certificate, then
   creates a draft GitHub Release containing the APK and SHA-256 checksum.
8. Inspect the draft notes and assets, then publish the Release manually.

The in-app update checker reads GitHub's latest published release. APK
installation remains an Android user-confirmed action. AAB delivery is deferred
until Google Play is selected as a distribution channel.
