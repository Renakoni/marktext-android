package io.github.renakoni.marktextandroid;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Real transport behind the {@link HttpTransport} seam: redirects are
 * handled by the caller, never followed. Shared by the cloud clients and
 * the update checker.
 */
final class UrlConnectionTransport implements HttpTransport {

    @Override
    public Response execute(Request request) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(request.url).openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(20_000);
            connection.setReadTimeout(30_000);
            connection.setRequestMethod(request.method);
            for (Map.Entry<String, String> header : request.headers.entrySet()) {
                connection.setRequestProperty(header.getKey(), header.getValue());
            }
            if (request.body != null) {
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(request.body.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(request.body);
                }
            }

            int status = connection.getResponseCode();
            Map<String, String> headers = new LinkedHashMap<>();
            for (Map.Entry<String, List<String>> header : connection.getHeaderFields().entrySet()) {
                if (header.getKey() != null && !header.getValue().isEmpty()) {
                    headers.put(header.getKey(), header.getValue().get(0));
                }
            }

            InputStream stream = status >= 400
                ? connection.getErrorStream()
                : connection.getInputStream();
            ByteArrayOutputStream body = new ByteArrayOutputStream();
            if (stream != null) {
                // Bounded read: deliver at most maxResponseBytes + 1 so
                // the caller sees the overflow without this transport
                // ever buffering an arbitrarily large response.
                int limit = request.maxResponseBytes > 0
                    ? request.maxResponseBytes + 1
                    : Integer.MAX_VALUE;
                byte[] buffer = new byte[8192];
                int read;
                while (body.size() < limit && (read = stream.read(buffer)) != -1) {
                    int keep = Math.min(read, limit - body.size());
                    body.write(buffer, 0, keep);
                }
                stream.close();
            }
            return new Response(status, headers, body.toByteArray());
        } finally {
            connection.disconnect();
        }
    }
}
