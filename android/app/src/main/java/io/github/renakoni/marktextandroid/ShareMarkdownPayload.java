package io.github.renakoni.marktextandroid;

import java.io.File;
import java.util.Map;

/** Markdown rewritten for sharing plus the image files to attach. */
class ShareMarkdownPayload {

    final String markdown;
    final Map<String, File> images;

    ShareMarkdownPayload(String markdown, Map<String, File> images) {
        this.markdown = markdown;
        this.images = images;
    }
}
