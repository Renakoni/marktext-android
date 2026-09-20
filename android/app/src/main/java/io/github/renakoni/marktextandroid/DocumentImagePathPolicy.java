package io.github.renakoni.marktextandroid;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Android-free path arithmetic behind "show the images next to this document".
 *
 * A Markdown file opened through the system picker carries a grant for that one
 * document, never for its siblings, so `![](images/cover.png)` cannot be read
 * until the user also grants the folder that holds the document. Once that tree
 * grant exists, a sibling image's SAF document id can be derived from the
 * document's own id: for the hierarchical local providers this feature targets
 * (ExternalStorageProvider, DownloadsProvider, MediaDocumentsProvider) a
 * document id is its parent's id, a `/`, and the display name. Providers with
 * opaque ids (cloud drives) are reported as unsupported rather than guessed at,
 * and `..` segments are clamped inside the granted tree so a crafted Markdown
 * file cannot reach anything the user did not grant.
 *
 * Everything here is plain string work so it can be unit-tested without an
 * Android runtime, mirroring {@link DocumentGrantPolicy}.
 */
final class DocumentImagePathPolicy {

    private DocumentImagePathPolicy() {}

    /**
     * The SAF document id of the directory that holds {@code documentId}, or
     * null when the id is opaque (no directory component), which marks the
     * provider as unsupported for relative image resolution.
     */
    static String documentDirectoryId(String documentId) {
        if (documentId == null || documentId.length() == 0) {
            return null;
        }

        int separator = documentId.lastIndexOf('/');
        if (separator > 0) {
            return documentId.substring(0, separator);
        }

        // A document at the root of a volume keeps no `/`: ExternalStorageProvider
        // names it `primary:note.md`, whose directory is the volume root
        // `primary:`. Anything else (`1234`, an opaque cloud id) is unsupported.
        int colon = documentId.indexOf(':');
        if (colon >= 0) {
            return documentId.substring(0, colon + 1);
        }

        return null;
    }

    /**
     * The most specific tree document id in {@code treeDocumentIds} that holds
     * {@code documentId}, or null when none of them does.
     */
    static String findCoveringTreeDocumentId(
        String documentId,
        Collection<String> treeDocumentIds
    ) {
        String best = null;
        if (treeDocumentIds == null) {
            return null;
        }

        for (String treeDocumentId : treeDocumentIds) {
            if (!treeContainsDocument(treeDocumentId, documentId)) {
                continue;
            }
            if (best == null || treeDocumentId.length() > best.length()) {
                best = treeDocumentId;
            }
        }
        return best;
    }

    /**
     * Whether {@code treeDocumentId} is the document's own directory or one of
     * its ancestors (and so covers the document).
     */
    static boolean treeContainsDocument(String treeDocumentId, String documentId) {
        return relativeWithinTree(treeDocumentId, documentDirectoryId(documentId)) != null;
    }

    /**
     * The path of {@code pathId} relative to {@code treeDocumentId}, or null
     * when the tree does not contain it. {@code pathId} is a directory id here,
     * so a tree equal to it yields the empty path.
     */
    private static String relativeWithinTree(String treeDocumentId, String pathId) {
        if (treeDocumentId == null || treeDocumentId.length() == 0 || pathId == null) {
            return null;
        }
        if (pathId.equals(treeDocumentId)) {
            return "";
        }

        // A volume root ("primary:") names its children directly after the
        // colon (`primary:8vo`); every other container separates with a `/`
        // (`primary:8vo/post`), and requiring that separator is what keeps
        // `primary:8vo` from claiming `primary:8vo-other`.
        if (treeDocumentId.endsWith(":")) {
            return pathId.startsWith(treeDocumentId)
                ? pathId.substring(treeDocumentId.length())
                : null;
        }
        return pathId.startsWith(treeDocumentId + "/")
            ? pathId.substring(treeDocumentId.length() + 1)
            : null;
    }

    /**
     * The document id of the image {@code relativeSource} names, resolved
     * against the document's own directory inside {@code treeDocumentId}.
     *
     * Returns null when the tree does not cover the document, when the source
     * names no file, or when it escapes the granted tree. `.` and `..` segments
     * are collapsed; backslashes are treated as separators, matching how the
     * editor normalises Markdown image destinations.
     */
    static String resolveChildDocumentId(
        String treeDocumentId,
        String documentId,
        String relativeSource
    ) {
        String relativeDirectory = relativeWithinTree(
            treeDocumentId,
            documentDirectoryId(documentId)
        );
        if (relativeDirectory == null) {
            return null;
        }

        List<String> segments = new ArrayList<>();
        appendSegments(segments, relativeDirectory, false);
        if (!appendSegments(segments, relativeSource, true)) {
            return null;
        }
        if (segments.isEmpty()) {
            return null;
        }

        String prefix = treeDocumentId.endsWith(":") ? treeDocumentId : treeDocumentId + "/";
        return prefix + String.join("/", segments);
    }

    /**
     * Appends the path segments of {@code path} to {@code segments}. When
     * {@code clampsToRoot} is set, a `..` that would climb above the granted
     * tree root fails the walk instead of resolving outside it.
     */
    private static boolean appendSegments(
        List<String> segments,
        String path,
        boolean clampsToRoot
    ) {
        if (path == null) {
            return true;
        }

        for (String segment : path.replace('\\', '/').split("/")) {
            if (segment.length() == 0 || ".".equals(segment)) {
                continue;
            }
            if ("..".equals(segment)) {
                if (segments.isEmpty()) {
                    if (clampsToRoot) {
                        return false;
                    }
                    continue;
                }
                segments.remove(segments.size() - 1);
                continue;
            }
            segments.add(segment);
        }
        return true;
    }
}
