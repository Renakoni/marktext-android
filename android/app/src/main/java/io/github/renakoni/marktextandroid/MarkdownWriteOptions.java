package io.github.renakoni.marktextandroid;

/** Encoding selection for writing Markdown bytes. */
class MarkdownWriteOptions {

    final String encoding;
    final boolean writeBom;

    MarkdownWriteOptions(String encoding, boolean writeBom) {
        this.encoding = encoding;
        this.writeBom = writeBom;
    }
}
