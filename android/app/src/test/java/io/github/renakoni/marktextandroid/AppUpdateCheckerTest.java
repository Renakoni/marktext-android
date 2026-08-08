package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.Test;

public class AppUpdateCheckerTest {

    /** Canned transport recording requests and replaying queued responses. */
    private static final class FakeTransport implements HttpTransport {

        final List<Request> requests = new ArrayList<>();
        final Deque<Response> responses = new ArrayDeque<>();

        void enqueue(int status, Map<String, String> headers) {
            responses.add(new Response(status, headers, new byte[0]));
        }

        @Override
        public Response execute(Request request) {
            requests.add(request);
            return responses.remove();
        }
    }

    private static Map<String, String> locationHeader(String location) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Location", location);
        return headers;
    }

    @Test
    public void resolvesTheTagFromTheLatestReleaseRedirect() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(302, locationHeader(
            "https://github.com/Renakoni/marktext-android/releases/tag/v0.2.0"));

        AppUpdateChecker.LatestRelease latest =
            new AppUpdateChecker(transport).fetchLatestRelease();

        assertEquals("v0.2.0", latest.tagName);
        assertEquals(
            "https://github.com/Renakoni/marktext-android/releases/tag/v0.2.0",
            latest.releaseUrl);
        HttpTransport.Request request = transport.requests.get(0);
        assertEquals("GET", request.method);
        assertEquals(AppUpdateChecker.LATEST_RELEASE_URL, request.url);
        assertNull(request.body);
    }

    @Test
    public void resolvesARelativeRedirectAndStripsQueryAndFragment() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(302, locationHeader(
            "/Renakoni/marktext-android/releases/tag/v0.2.0%2Bhotfix?utm=x#assets"));

        AppUpdateChecker.LatestRelease latest =
            new AppUpdateChecker(transport).fetchLatestRelease();

        assertEquals("v0.2.0+hotfix", latest.tagName);
        assertEquals(
            "https://github.com/Renakoni/marktext-android/releases/tag/v0.2.0%2Bhotfix",
            latest.releaseUrl);
    }

    @Test
    public void refusesARedirectOutsideTheRepositoryTagPage() {
        // No releases published: GitHub redirects to the plain listing.
        FakeTransport listing = new FakeTransport();
        listing.enqueue(302, locationHeader(
            "https://github.com/Renakoni/marktext-android/releases"));
        assertThrows(IOException.class, () -> new AppUpdateChecker(listing).fetchLatestRelease());

        // The opened URL must never be attacker-shaped.
        FakeTransport foreign = new FakeTransport();
        foreign.enqueue(302, locationHeader(
            "https://example.com/Renakoni/marktext-android/releases/tag/v9.9.9"));
        assertThrows(IOException.class, () -> new AppUpdateChecker(foreign).fetchLatestRelease());
    }

    @Test
    public void refusesNonRedirectAndLocationlessResponses() {
        FakeTransport ok = new FakeTransport();
        ok.enqueue(200, new LinkedHashMap<>());
        assertThrows(IOException.class, () -> new AppUpdateChecker(ok).fetchLatestRelease());

        FakeTransport bare = new FakeTransport();
        bare.enqueue(302, new LinkedHashMap<>());
        assertThrows(IOException.class, () -> new AppUpdateChecker(bare).fetchLatestRelease());
    }

    @Test
    public void keepsTheBoundedBodyReadOnTheRedirectProbe() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(301, locationHeader(
            "https://github.com/Renakoni/marktext-android/releases/tag/v1.0.0"));

        new AppUpdateChecker(transport).fetchLatestRelease();

        // A redirect probe never needs an unbounded body; the cap keeps a
        // misbehaving proxy from feeding the app an arbitrarily large page.
        assertEquals(64 * 1024, transport.requests.get(0).maxResponseBytes);
        assertEquals("text/html", transport.requests.get(0).headers.get("Accept"));
    }
}
