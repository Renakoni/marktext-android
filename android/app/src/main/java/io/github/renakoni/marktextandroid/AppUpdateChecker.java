package io.github.renakoni.marktextandroid;

import java.io.IOException;
import java.net.URLDecoder;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Resolves the latest published release from the {@code releases/latest}
 * HTTP redirect on github.com: the Location header carries the tag. The
 * web endpoint is not behind the GitHub API's 60-requests/hour-per-IP
 * quota, so this keeps working on shared-egress networks (VPN, CGNAT)
 * where the unauthenticated API answers 403. Pure JVM over the
 * {@link HttpTransport} seam.
 */
final class AppUpdateChecker {

    static final String RELEASES_BASE =
        "https://github.com/Renakoni/marktext-android/releases";
    static final String LATEST_RELEASE_URL = RELEASES_BASE + "/latest";
    private static final String TAG_PREFIX = RELEASES_BASE + "/tag/";

    static final class LatestRelease {

        final String tagName;
        final String releaseUrl;

        LatestRelease(String tagName, String releaseUrl) {
            this.tagName = tagName;
            this.releaseUrl = releaseUrl;
        }
    }

    private final HttpTransport transport;

    AppUpdateChecker(HttpTransport transport) {
        this.transport = transport;
    }

    LatestRelease fetchLatestRelease() throws IOException {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Accept", "text/html");
        HttpTransport.Response response = transport.execute(new HttpTransport.Request(
            "GET",
            LATEST_RELEASE_URL,
            headers,
            null,
            64 * 1024
        ));

        if (response.status < 300 || response.status >= 400) {
            throw new IOException("releases/latest did not redirect (HTTP " + response.status + ")");
        }

        String location = response.header("Location");
        if (location == null || location.isEmpty()) {
            throw new IOException("releases/latest redirect carried no Location");
        }
        if (location.startsWith("/")) {
            location = "https://github.com" + location;
        }
        int cut = location.indexOf('?');
        if (cut >= 0) {
            location = location.substring(0, cut);
        }
        cut = location.indexOf('#');
        if (cut >= 0) {
            location = location.substring(0, cut);
        }

        // Anything but this repository's tag page is refused — a repo with
        // no releases redirects to the plain /releases listing, and the
        // returned URL is later opened in a browser, so it must never be
        // attacker-shaped.
        if (!location.startsWith(TAG_PREFIX)) {
            throw new IOException("releases/latest did not point at a release tag");
        }

        String tagName = URLDecoder.decode(location.substring(TAG_PREFIX.length()), "UTF-8");
        if (tagName.isEmpty()) {
            throw new IOException("releases/latest pointed at an empty tag");
        }

        return new LatestRelease(tagName, location);
    }
}
