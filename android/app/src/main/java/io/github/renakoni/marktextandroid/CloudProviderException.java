package io.github.renakoni.marktextandroid;

/** Cloud provider failure with a stable code the web layer can branch on. */
class CloudProviderException extends Exception {

    final String code;

    CloudProviderException(String code, String message) {
        super(message);
        this.code = code;
    }

    CloudProviderException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }
}
