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

public class GoogleDriveClientTest {

    /** Canned transport recording requests and replaying queued responses. */
    private static final class FakeTransport implements HttpTransport {

        final List<Request> requests = new ArrayList<>();
        final Deque<Response> responses = new ArrayDeque<>();

        void enqueue(int status, String body) {
            responses.addLast(new Response(
                status,
                new LinkedHashMap<>(),
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
    public void pickerAuthorizeUrlCarriesPkceStateScopeAndThePickerTrigger() {
        String url = GoogleDriveClient.buildPickerAuthorizeUrl(
            "client-123.apps.googleusercontent.com",
            "com.googleusercontent.apps.client-123:/oauth2redirect",
            "state-x",
            "challenge-y");

        assertTrue(url.startsWith(GoogleDriveClient.AUTH_ENDPOINT + "?"));
        assertTrue(url.contains("client_id=client-123.apps.googleusercontent.com"));
        assertTrue(url.contains(
            "redirect_uri=com.googleusercontent.apps.client-123%3A%2Foauth2redirect"));
        assertTrue(url.contains("state=state-x"));
        assertTrue(url.contains("code_challenge=challenge-y"));
        assertTrue(url.contains("code_challenge_method=S256"));
        assertTrue(url.contains(
            "scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file"));
        // The in-flow picker: consent is mandatory alongside the trigger,
        // and it guarantees a fresh refresh token on every pick.
        assertTrue(url.contains("prompt=consent"));
        assertTrue(url.contains("trigger_onepick=true"));
        assertTrue(url.contains("mimetypes=text%2Fmarkdown"));
        assertTrue(url.contains("access_type=offline"));
    }

    @Test
    public void redirectSchemeIsTheReversedClientId() {
        assertEquals(
            "com.googleusercontent.apps.432-abc",
            GoogleDriveClient.redirectSchemeFor("432-abc.apps.googleusercontent.com"));
        assertEquals("", GoogleDriveClient.redirectSchemeFor(""));
        assertEquals("", GoogleDriveClient.redirectSchemeFor("not-a-google-client-id"));
        assertEquals("", GoogleDriveClient.redirectSchemeFor(null));
    }

    @Test
    public void codeExchangeParsesTokensAndComputesExpiry() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"access_token\":\"AT\",\"refresh_token\":\"RT\",\"expires_in\":3599}");

        GoogleDriveClient.TokenResult result = new GoogleDriveClient(transport)
            .exchangeCode("client", "scheme:/oauth2redirect", "code-1", "verifier-1", 1_000_000L);

        assertEquals("AT", result.tokens.accessToken);
        assertEquals("RT", result.tokens.refreshToken);
        assertEquals(1_000_000L + 3_599_000L, result.tokens.expiresAtMillis);

        HttpTransport.Request request = transport.requests.get(0);
        assertEquals(GoogleDriveClient.TOKEN_ENDPOINT, request.url);
        String form = new String(request.body, StandardCharsets.UTF_8);
        assertTrue(form.contains("grant_type=authorization_code"));
        assertTrue(form.contains("code=code-1"));
        assertTrue(form.contains("code_verifier=verifier-1"));
        assertTrue(form.contains("redirect_uri=scheme%3A%2Foauth2redirect"));
    }

    @Test
    public void refreshKeepsThePreviousRefreshTokenWhenOmitted() throws Exception {
        // Google refresh responses never repeat the refresh token.
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"access_token\":\"AT2\",\"expires_in\":3599}");
        CloudTokenStore previous = new CloudTokenStore("AT1", "RT1", 0, "user@gmail.com");

        GoogleDriveClient.TokenResult result =
            new GoogleDriveClient(transport).refresh("client", previous, 5_000L);

        assertEquals("AT2", result.tokens.accessToken);
        assertEquals("RT1", result.tokens.refreshToken);
        assertEquals("user@gmail.com", result.tokens.accountName);
    }

    @Test
    public void invalidGrantOnRefreshMapsToAuthExpired() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(400, "{\"error\":\"invalid_grant\",\"error_description\":\"Token has been revoked.\"}");

        try {
            new GoogleDriveClient(transport)
                .refresh("client", new CloudTokenStore("AT", "RT", 0, null), 0);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_AUTH_EXPIRED", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void accountNamePrefersTheEmailFromTheAboutResource() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"user\":{\"displayName\":\"A. User\",\"emailAddress\":\"a@gmail.com\"}}");

        String name = new GoogleDriveClient(transport).getAccountName("AT");

        assertEquals("a@gmail.com", name);
        assertTrue(transport.requests.get(0).url.startsWith(GoogleDriveClient.DRIVE + "/about?"));
        assertEquals("Bearer AT", transport.requests.get(0).headers.get("Authorization"));
    }

    @Test
    public void readFetchesMetadataThenMediaWithTheByteCap() throws Exception {
        FakeTransport transport = new FakeTransport();
        // Drive v3 serializes size as a string.
        transport.enqueue(200, "{\"name\":\"notes.md\",\"mimeType\":\"text/markdown\","
            + "\"headRevisionId\":\"rev-1\",\"size\":\"5\",\"capabilities\":{\"canModifyContent\":true}}");
        transport.enqueue(200, "hello");

        GoogleDriveClient.FileContent file =
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);

        assertEquals("notes.md", file.name);
        assertEquals("rev-1", file.headRevisionId);
        assertTrue(file.canWrite);
        assertEquals("hello", new String(file.bytes, StandardCharsets.UTF_8));

        HttpTransport.Request metadata = transport.requests.get(0);
        assertTrue(metadata.url.startsWith(GoogleDriveClient.DRIVE + "/files/file-1?fields="));
        assertTrue(metadata.url.contains("capabilities/canModifyContent"));
        HttpTransport.Request download = transport.requests.get(1);
        assertEquals(GoogleDriveClient.DRIVE + "/files/file-1?alt=media", download.url);
        assertEquals("Bearer AT", download.headers.get("Authorization"));
        assertEquals(1024, download.maxResponseBytes);
    }

    @Test
    public void readReportsReadOnlySharedFilesAsNotWritable() throws Exception {
        // canEdit=true does NOT imply content writes are allowed (content
        // restrictions); only canModifyContent governs the media upload.
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"shared.md\",\"mimeType\":\"text/markdown\","
            + "\"headRevisionId\":\"rev-1\",\"size\":\"5\","
            + "\"capabilities\":{\"canEdit\":true,\"canModifyContent\":false}}");
        transport.enqueue(200, "hello");

        GoogleDriveClient.FileContent file =
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);

        assertFalse(file.canWrite);
    }

    @Test
    public void readFailsClosedToReadOnlyWhenCapabilitiesAreMissing() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"odd.md\",\"mimeType\":\"text/markdown\","
            + "\"headRevisionId\":\"rev-1\",\"size\":\"5\"}");
        transport.enqueue(200, "hello");

        GoogleDriveClient.FileContent file =
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);

        assertFalse(file.canWrite);
    }

    @Test
    public void readRejectsBinariesThatOnlyMatchedTheOctetStreamFilter() {
        // application/octet-stream is in the picker filter because old .md
        // uploads carry it — but it also matches arbitrary binaries. A
        // non-text MIME without a Markdown/text extension must not reach
        // the charset decoder (decodable bytes are not necessarily text).
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"model.bin\",\"mimeType\":\"application/octet-stream\","
            + "\"headRevisionId\":\"rev-1\",\"size\":\"5\"}");

        try {
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("UNSUPPORTED_DOCUMENT", ex.code);
            assertEquals(1, transport.requests.size());
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void readAcceptsOctetStreamFilesWithAMarkdownExtension() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"legacy.md\",\"mimeType\":\"application/octet-stream\","
            + "\"headRevisionId\":\"rev-1\",\"size\":\"5\"}");
        transport.enqueue(200, "hello");

        GoogleDriveClient.FileContent file =
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);

        assertEquals("legacy.md", file.name);
    }

    @Test
    public void readRejectsOversizedFilesBeforeDownloading() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"big.md\",\"headRevisionId\":\"r\",\"size\":\"9999\"}");

        try {
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("DOCUMENT_TOO_LARGE", ex.code);
            assertEquals(1, transport.requests.size());
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void readRejectsAnOversizedDownloadEvenWhenMetadataLied() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"a.md\",\"headRevisionId\":\"r\",\"size\":\"5\"}");
        byte[] oversized = new byte[1025];
        transport.enqueue(200, new String(oversized, StandardCharsets.ISO_8859_1));

        try {
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("DOCUMENT_TOO_LARGE", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void readTreatsTrashedFilesAsMissing() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"gone.md\",\"trashed\":true,\"size\":\"5\"}");

        try {
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_DOCUMENT_NOT_FOUND", ex.code);
            assertEquals(1, transport.requests.size());
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void writeComparesTheHeadRevisionBeforeUploading() {
        // Drive v3 has no If-Match; the compare-then-write gate is the
        // conflict protection and a mismatch must stop before any upload.
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"notes.md\",\"mimeType\":\"text/markdown\",\"headRevisionId\":\"rev-2\"}");

        try {
            new GoogleDriveClient(transport)
                .writeFile("AT", "file-1", "new".getBytes(StandardCharsets.UTF_8), "rev-1");
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_DOCUMENT_CONFLICT", ex.code);
            assertEquals(1, transport.requests.size());
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void writeUploadsMediaWithTheMethodOverrideAndEchoedMimeType() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"notes.md\",\"mimeType\":\"text/plain\",\"headRevisionId\":\"rev-1\"}");
        transport.enqueue(200, "{\"name\":\"notes.md\",\"headRevisionId\":\"rev-2\","
            + "\"modifiedTime\":\"2026-08-07T01:00:00.000Z\"}");

        GoogleDriveClient.WriteResult result = new GoogleDriveClient(transport)
            .writeFile("AT", "file-1", "new".getBytes(StandardCharsets.UTF_8), "rev-1");

        assertEquals("rev-2", result.headRevisionId);
        assertEquals("2026-08-07T01:00:00.000Z", result.lastModified);

        HttpTransport.Request upload = transport.requests.get(1);
        // HttpURLConnection cannot send PATCH; Google's documented
        // POST + X-HTTP-Method-Override form stands in for it.
        assertEquals("POST", upload.method);
        assertEquals("PATCH", upload.headers.get("X-HTTP-Method-Override"));
        assertEquals("text/plain", upload.headers.get("Content-Type"));
        assertTrue(upload.url.startsWith(GoogleDriveClient.UPLOAD + "/files/file-1?uploadType=media"));
    }

    @Test
    public void writeRefusesTrashedFiles() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(200, "{\"name\":\"gone.md\",\"trashed\":true,\"headRevisionId\":\"rev-1\"}");

        try {
            new GoogleDriveClient(transport).writeFile("AT", "file-1", new byte[] {65}, "rev-1");
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_DOCUMENT_NOT_FOUND", ex.code);
            assertEquals(1, transport.requests.size());
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void unauthorizedDriveCallsMapToAuthExpired() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(401, "{\"error\":{\"code\":401,\"message\":\"Invalid Credentials\"}}");

        try {
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_AUTH_EXPIRED", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void rateLimit403MapsToUnavailableWhileOther403MeansAccessIsGone() {
        // Drive reports throttling as 403 userRateLimitExceeded — retryable,
        // not a reason to declare the account disconnected.
        FakeTransport throttled = new FakeTransport();
        throttled.enqueue(403, "{\"error\":{\"errors\":[{\"reason\":\"userRateLimitExceeded\"}],\"code\":403}}");
        try {
            new GoogleDriveClient(throttled).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_UNAVAILABLE", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }

        // Per-file permission reasons route to the request-level code (see
        // perFilePermission403DoesNotDisconnectTheAccount); only the
        // remaining 403s mean authorization itself is gone.
        FakeTransport forbidden = new FakeTransport();
        forbidden.enqueue(403, "{\"error\":{\"errors\":[{\"reason\":\"forbidden\"}],\"code\":403}}");
        try {
            new GoogleDriveClient(forbidden).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_AUTH_EXPIRED", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void perFilePermission403DoesNotDisconnectTheAccount() {
        // A read-only shared file that slipped into a write, or a
        // not-downloadable file, is a document problem — mapping it to
        // CLOUD_AUTH_EXPIRED would wrongly tell the user to sign in again.
        FakeTransport transport = new FakeTransport();
        transport.enqueue(403,
            "{\"error\":{\"errors\":[{\"reason\":\"insufficientFilePermissions\"}],\"code\":403}}");

        try {
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_REQUEST_FAILED", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }

    @Test
    public void revokeReportsWhetherGoogleConfirmedIt() throws Exception {
        FakeTransport confirmed = new FakeTransport();
        confirmed.enqueue(200, "{}");
        assertTrue(new GoogleDriveClient(confirmed).revoke("RT"));

        FakeTransport refused = new FakeTransport();
        refused.enqueue(400, "{\"error\":\"invalid_token\"}");
        assertFalse(new GoogleDriveClient(refused).revoke("RT"));
    }

    @Test
    public void missingFilesMapToDocumentNotFound() {
        FakeTransport transport = new FakeTransport();
        transport.enqueue(404, "{\"error\":{\"code\":404,\"message\":\"File not found\"}}");

        try {
            new GoogleDriveClient(transport).readFile("AT", "file-1", 1024);
            fail("expected CloudProviderException");
        } catch (CloudProviderException ex) {
            assertEquals("CLOUD_DOCUMENT_NOT_FOUND", ex.code);
        } catch (Exception ex) {
            fail("unexpected " + ex);
        }
    }
}
