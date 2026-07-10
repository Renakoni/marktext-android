package io.github.renakoni.marktextandroid;

/**
 * Checked failure with a stable machine-readable code that the Capacitor
 * bridge forwards to the WebView error mapping.
 */
class DocumentReadException extends Exception {

    final String code;

    DocumentReadException(String code, String message) {
        super(message);
        this.code = code;
    }
}
