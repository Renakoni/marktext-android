package io.github.renakoni.marktextandroid;

import java.io.IOException;
import java.util.Map;

/**
 * Minimal HTTP seam so cloud clients stay pure JVM: the plugin binds a real
 * HttpsURLConnection executor, tests bind canned responses.
 */
interface HttpTransport {

    final class Request {

        final String method;
        final String url;
        final Map<String, String> headers;
        final byte[] body;
        /**
         * Stop reading the response body once it exceeds this many bytes
         * (0 = unbounded). The transport delivers at most maxResponseBytes+1
         * bytes so callers can detect the overflow without the full body
         * ever being buffered — a swapped-in huge file must not be able to
         * allocate hundreds of MB before the size check runs.
         */
        final int maxResponseBytes;

        Request(String method, String url, Map<String, String> headers, byte[] body) {
            this(method, url, headers, body, 0);
        }

        Request(String method, String url, Map<String, String> headers, byte[] body, int maxResponseBytes) {
            this.method = method;
            this.url = url;
            this.headers = headers;
            this.body = body;
            this.maxResponseBytes = maxResponseBytes;
        }
    }

    final class Response {

        final int status;
        final Map<String, String> headers;
        final byte[] body;

        Response(int status, Map<String, String> headers, byte[] body) {
            this.status = status;
            this.headers = headers;
            this.body = body;
        }

        String header(String name) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(name)) {
                    return entry.getValue();
                }
            }
            return null;
        }
    }

    /** Executes without following redirects; redirect handling is client policy. */
    Response execute(Request request) throws IOException;
}
