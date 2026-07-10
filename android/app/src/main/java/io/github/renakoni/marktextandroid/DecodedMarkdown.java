package io.github.renakoni.marktextandroid;

/** Result of decoding Markdown bytes: text plus the encoding metadata used. */
class DecodedMarkdown {

    final String markdown;
    final String encoding;
    final boolean hasBom;

    DecodedMarkdown(String markdown, String encoding, boolean hasBom) {
        this.markdown = markdown;
        this.encoding = encoding;
        this.hasBom = hasBom;
    }
}
