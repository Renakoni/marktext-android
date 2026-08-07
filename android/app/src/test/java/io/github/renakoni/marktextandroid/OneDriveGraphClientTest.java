package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.Test;

public class OneDriveGraphClientTest {

    /** Canned transport recording requests and replaying queued responses. */
    private static final class FakeTransport implements HttpTransport {

        final List<Request> requests = new ArrayList<>();
        final Deque<Response> responses = new ArrayDeque<>();

        void enqueue(int status, String body) {
            enqueue(status, new LinkedHashMap<>(), body);
        }

        void enqueue(int status, Map<String, String> headers, String body) {
            responses.addLast(new Response(
                status,
                headers,
                body == null ? new byte[0] : body.getBytes(StandardCharsets.UTF_8)
            ));
        }

        @Override
        public Response execute(Request request) {
            requests.add(request);
            if (responses.isEmpty()) {
                throw new IllegalStateException("No canned response for " + request.url);
            }
            return responses.removeFirst();
        }
    }

    @Test
    public void authorizeUrlCarriesPkceStateAndScopes() {
        String url = OneDriveGraphClient.buildAuthorizeUrl(
            "client-123", "app.debug://oauth/onedrive", "state-x", "challenge-y");

        assertTrue(url.startsWith(OneDriveGraphClient.AUTHORITY + "/authorize?"));
        assertTrue(url.contains("client_id=client-123"));
        assertTrue(url.contains("redirect_uri=app.debug%3A%2F%2Foauth%2Fonedrive"));
        assertTrue(url.contains("state=state-x"));
        assertTrue(url.contains("code_challenge=challenge-y"));
        assertTrue(url.contains("code_challenge_method=S256"));
        assertTrue(url.contains("scope=openid+offline_access+User.Read+Files.ReadWrite"));
        assertTrue(url.contains("response_mode=query"));
    }

    @Test
    public void codeExchangeParsesTokensAndComputesExpiry() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"access_token\":\"AT\",\"refresh_token\":\"RT\",\"expires_in\":3600}");

        OneDriveGraphClient.TokenResult result = new OneDriveGraphClient(transport)
            .exchangeCode("client", "app://oauth/onedrive", "code-1", "verifier-1", 1_000_000L);

        assertEquals("AT", result.tokens.accessToken);
        assertEquals("RT", result.tokens.refreshToken);
        assertEquals(1_000_000L + 3_600_000L, result.tokens.expiresAtMillis);

        String form = new String(transport.requests.get(0).body, StandardCharsets.UTF_8);
        assertTrue(form.contains("grant_type=authorization_code"));
        assertTrue(form.contains("code=code-1"));
        assertTrue(form.contains("code_verifier=verifier-1"));
    }

    @Test
    public void refreshKeepsThePreviousRefreshTokenWhenOmitted() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"access_token\":\"AT2\",\"expires_in\":3600}");
        CloudTokenStore previous = new CloudTokenStore("AT1", "RT1", 0, "user@example.com");

        OneDriveGraphClient.TokenResult result =
            new OneDriveGraphClient(transport).refresh("client", previous, 5_000L);

        assertEquals("AT2", result.tokens.accessToken);
        assertEquals("RT1", result.tokens.refreshToken);
        assertEquals("user@example.com", result.tokens.accountName);
    }

    @Test
    public void invalidGrantOnRefreshMapsToAuthExpired() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(400, "{\"error\":\"invalid_grant\",\"error_description\":\"AADSTS70000: expired\"}");

        try {
            new OneDriveGraphClient(transport)
                .refresh("client", new CloudTokenStore("AT", "RT", 0, null), 0);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_AUTH_EXPIRED", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void listingFollowsPagesAndKeepsFoldersPlusMarkdownCandidatesOnly() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"value\":["
            + "{\"id\":\"f1\",\"name\":\"Notes\",\"folder\":{},\"size\":0},"
            + "{\"id\":\"d1\",\"name\":\"readme.md\",\"file\":{},\"size\":10,\"lastModifiedDateTime\":\"2026-08-07T00:00:00Z\"},"
            + "{\"id\":\"x1\",\"name\":\"photo.jpg\",\"file\":{},\"size\":999}"
            + "],\"@odata.nextLink\":\"https://graph.microsoft.com/v1.0/next-page\"}");
        transport.enqueue(200, "{\"value\":["
            + "{\"id\":\"d2\",\"name\":\"todo.txt\",\"file\":{},\"size\":5}"
            + "]}");

        List<OneDriveGraphClient.Entry> entries =
            new OneDriveGraphClient(transport).listFolder("AT", null);

        assertEquals(3, entries.size());
        assertEquals("f1", entries.get(0).id);
        assertTrue(entries.get(0).isFolder);
        assertEquals("d1", entries.get(1).id);
        assertFalse(entries.get(1).isFolder);
        assertEquals("d2", entries.get(2).id);
        assertEquals("https://graph.microsoft.com/v1.0/next-page", transport.requests.get(1).url);
        assertTrue(transport.requests.get(0).url.startsWith(
            OneDriveGraphClient.GRAPH + "/me/drive/root/children?"));
    }

    @Test
    public void readFollowsThePreauthorizedRedirectWithoutTheBearerHeader() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"id\":\"d1\",\"name\":\"readme.md\",\"eTag\":\"etag-1\",\"size\":5}");
        Map<String, String> redirectHeaders = new LinkedHashMap<>();
        redirectHeaders.put("Location", "https://download.example/readme");
        transport.enqueue(302, redirectHeaders, "");
        transport.enqueue(200, "hello");

        OneDriveGraphClient.FileContent file =
            new OneDriveGraphClient(transport).readFile("AT", "d1", 1024);

        assertEquals("readme.md", file.name);
        assertEquals("etag-1", file.eTag);
        assertEquals("hello", new String(file.bytes, StandardCharsets.UTF_8));
        HttpTransport.Request download = transport.requests.get(2);
        assertEquals("https://download.example/readme", download.url);
        assertFalse(download.headers.containsKey("Authorization"));
    }

    @Test
    public void downloadRequestsCarryTheByteCapForBoundedTransportReads() throws Exception {
        // Codex round 1: the cap must ride the download requests so the
        // transport can stop reading a swapped-in huge file early, instead
        // of buffering it fully before the length check.
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"id\":\"d1\",\"name\":\"a.md\",\"eTag\":\"e\",\"size\":5}");
        Map<String, String> redirectHeaders = new LinkedHashMap<>();
        redirectHeaders.put("Location", "https://download.example/a");
        transport.enqueue(302, redirectHeaders, "");
        transport.enqueue(200, "hello");

        new OneDriveGraphClient(transport).readFile("AT", "d1", 1024);

        assertEquals(1024, transport.requests.get(1).maxResponseBytes);
        assertEquals(1024, transport.requests.get(2).maxResponseBytes);
    }

    @Test
    public void readRejectsAnOversizedDownloadEvenWhenMetadataLied() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"id\":\"d1\",\"name\":\"a.md\",\"eTag\":\"e\",\"size\":5}");
        byte[] oversized = new byte[1025];
        transport.enqueue(200, new LinkedHashMap<>(), new String(oversized, StandardCharsets.ISO_8859_1));

        try {
            new OneDriveGraphClient(transport).readFile("AT", "d1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("DOCUMENT_TOO_LARGE", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void readRejectsOversizedFilesBeforeDownloading() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"id\":\"d1\",\"name\":\"big.md\",\"eTag\":\"e\",\"size\":9999}");

        try {
            new OneDriveGraphClient(transport).readFile("AT", "d1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("DOCUMENT_TOO_LARGE", ex.code);
            assertEquals(1, transport.requests.size());
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void writeSendsIfMatchAndParsesTheNewETag() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"id\":\"d1\",\"name\":\"readme.md\",\"eTag\":\"etag-2\","
            + "\"lastModifiedDateTime\":\"2026-08-07T01:00:00Z\"}");

        OneDriveGraphClient.WriteResult result = new OneDriveGraphClient(transport)
            .writeFile("AT", "d1", "new".getBytes(StandardCharsets.UTF_8), "etag-1");

        assertEquals("etag-2", result.eTag);
        assertEquals("2026-08-07T01:00:00Z", result.lastModified);
        HttpTransport.Request request = transport.requests.get(0);
        assertEquals("PUT", request.method);
        assertEquals("etag-1", request.headers.get("If-Match"));
    }

    @Test
    public void writeConflictMapsToDocumentConflict() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(412, "{\"error\":{\"code\":\"resourceModified\"}}");

        try {
            new OneDriveGraphClient(transport).writeFile("AT", "d1", new byte[] {65}, "etag-old");
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_DOCUMENT_CONFLICT", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void unauthorizedGraphCallsMapToAuthExpired() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(401, "{\"error\":{\"code\":\"InvalidAuthenticationToken\"}}");

        try {
            new OneDriveGraphClient(transport).listFolder("AT", null);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_AUTH_EXPIRED", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }
}
