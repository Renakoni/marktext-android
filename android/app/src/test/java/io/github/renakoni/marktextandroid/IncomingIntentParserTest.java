package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class IncomingIntentParserTest {

    @Test
    public void recognizesMarkdownExtensionsCaseInsensitively() {
        assertTrue(IncomingIntentParser.hasMarkdownExtension("Notes.MD"));
        assertTrue(IncomingIntentParser.hasMarkdownExtension("a.markdown"));
        assertTrue(IncomingIntentParser.hasMarkdownExtension("a.mdown"));
        assertTrue(IncomingIntentParser.hasMarkdownExtension("a.mkdn"));
        assertTrue(IncomingIntentParser.hasMarkdownExtension("a.mkd"));
        assertFalse(IncomingIntentParser.hasMarkdownExtension("archive.mdx"));
        assertFalse(IncomingIntentParser.hasMarkdownExtension(null));
    }

    @Test
    public void recognizesMarkdownMimeTypesExactly() {
        assertTrue(IncomingIntentParser.isMarkdownMimeType("text/markdown"));
        assertTrue(IncomingIntentParser.isMarkdownMimeType("text/x-markdown"));
        assertTrue(IncomingIntentParser.isMarkdownMimeType("text/vnd.daringfireball.markdown"));
        assertFalse(IncomingIntentParser.isMarkdownMimeType("text/plain"));
        assertFalse(IncomingIntentParser.isMarkdownMimeType("application/octet-stream"));
    }

    @Test
    public void documentCandidatesAcceptPlainTextOnlyByMime() {
        // Picker/read path: a .txt is acceptable via its MIME…
        assertTrue(IncomingIntentParser.isMarkdownCandidate("notes.txt", "text/plain"));
        // …and a Markdown extension wins regardless of MIME.
        assertTrue(IncomingIntentParser.isMarkdownCandidate("notes.md", "application/octet-stream"));
        assertFalse(IncomingIntentParser.isMarkdownCandidate("photo.png", "image/png"));
    }

    @Test
    public void sharedTextAcceptsAnyTextMimeIncludingEmpty() {
        assertTrue(IncomingIntentParser.isSharedTextMimeType(""));
        assertTrue(IncomingIntentParser.isSharedTextMimeType("text/plain"));
        assertTrue(IncomingIntentParser.isSharedTextMimeType("text/anything"));
        assertTrue(IncomingIntentParser.isSharedTextMimeType("text/markdown"));
        assertFalse(IncomingIntentParser.isSharedTextMimeType("application/json"));
        assertFalse(IncomingIntentParser.isSharedTextMimeType("image/png"));
    }

    @Test
    public void normalizesMimeTypesToLowerCaseAndEmpty() {
        assertEquals("text/markdown", IncomingIntentParser.normalizeMimeType("Text/Markdown"));
        assertEquals("", IncomingIntentParser.normalizeMimeType(null));
    }
}
