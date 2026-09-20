package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class DocumentImagePathPolicyTest {

    private static final String DOCUMENT_ID = "primary:8vo/post/MarkText.md";
    private static final String DOCUMENT_DIRECTORY = "primary:8vo/post";

    @Test
    public void readsTheDocumentDirectoryFromAHierarchicalId() {
        assertEquals(DOCUMENT_DIRECTORY, DocumentImagePathPolicy.documentDirectoryId(DOCUMENT_ID));
    }

    @Test
    public void treatsAVolumeRootDocumentAsLivingInThatVolume() {
        assertEquals(
            "primary:",
            DocumentImagePathPolicy.documentDirectoryId("primary:note.md")
        );
        assertEquals(
            "raw:/storage/emulated/0/Download",
            DocumentImagePathPolicy.documentDirectoryId("raw:/storage/emulated/0/Download/note.md")
        );
    }

    @Test
    public void rejectsOpaqueProviderIds() {
        assertNull(DocumentImagePathPolicy.documentDirectoryId("1A2B3C4D5E"));
        assertNull(DocumentImagePathPolicy.documentDirectoryId(""));
        assertNull(DocumentImagePathPolicy.documentDirectoryId(null));
    }

    @Test
    public void coversTheDocumentFromItsOwnDirectoryOrAnAncestor() {
        assertTrue(DocumentImagePathPolicy.treeContainsDocument(DOCUMENT_DIRECTORY, DOCUMENT_ID));
        assertTrue(DocumentImagePathPolicy.treeContainsDocument("primary:8vo", DOCUMENT_ID));
        assertTrue(DocumentImagePathPolicy.treeContainsDocument("primary:", DOCUMENT_ID));
    }

    @Test
    public void doesNotCoverFromASiblingOrUnrelatedTree() {
        assertFalse(
            DocumentImagePathPolicy.treeContainsDocument("primary:8vo/other", DOCUMENT_ID)
        );
        assertFalse(DocumentImagePathPolicy.treeContainsDocument("primary:8v", DOCUMENT_ID));
        // A shared name prefix is not containment.
        assertFalse(
            DocumentImagePathPolicy.treeContainsDocument("primary:8vo-other", DOCUMENT_ID)
        );
        assertFalse(DocumentImagePathPolicy.treeContainsDocument("", DOCUMENT_ID));
        assertFalse(DocumentImagePathPolicy.treeContainsDocument(null, DOCUMENT_ID));
        assertFalse(DocumentImagePathPolicy.treeContainsDocument("primary:8vo", "opaque"));
    }

    @Test
    public void picksTheMostSpecificCoveringTree() {
        assertEquals(
            DOCUMENT_DIRECTORY,
            DocumentImagePathPolicy.findCoveringTreeDocumentId(
                DOCUMENT_ID,
                Arrays.asList("primary:", "primary:8vo", DOCUMENT_DIRECTORY, "primary:elsewhere")
            )
        );
        assertNull(
            DocumentImagePathPolicy.findCoveringTreeDocumentId(
                DOCUMENT_ID,
                Collections.singletonList("primary:elsewhere")
            )
        );
        assertNull(DocumentImagePathPolicy.findCoveringTreeDocumentId(DOCUMENT_ID, null));
    }

    @Test
    public void resolvesASiblingImageAgainstTheDocumentsOwnFolder() {
        assertEquals(
            "primary:8vo/post/images/Designer.png",
            DocumentImagePathPolicy.resolveChildDocumentId(
                DOCUMENT_DIRECTORY,
                DOCUMENT_ID,
                "images/Designer.png"
            )
        );
    }

    @Test
    public void resolvesThroughTheDocumentsFolderInsideAnAncestorTree() {
        assertEquals(
            "primary:8vo/post/images/Designer.png",
            DocumentImagePathPolicy.resolveChildDocumentId(
                "primary:8vo",
                DOCUMENT_ID,
                "images/Designer.png"
            )
        );
        assertEquals(
            "primary:8vo/post/images/Designer.png",
            DocumentImagePathPolicy.resolveChildDocumentId(
                "primary:",
                DOCUMENT_ID,
                "images/Designer.png"
            )
        );
    }

    @Test
    public void normalisesDotAndBackslashSegments() {
        assertEquals(
            "primary:8vo/post/cover.png",
            DocumentImagePathPolicy.resolveChildDocumentId(
                DOCUMENT_DIRECTORY,
                DOCUMENT_ID,
                "images/../cover.png"
            )
        );
        assertEquals(
            "primary:8vo/post/images/Designer.png",
            DocumentImagePathPolicy.resolveChildDocumentId(
                DOCUMENT_DIRECTORY,
                DOCUMENT_ID,
                ".\\images\\Designer.png"
            )
        );
    }

    @Test
    public void clampsParentTraversalInsideTheGrantedTree() {
        // Climbing above the tree root is refused outright, so a crafted
        // Markdown file cannot name a file the user never granted. Here the
        // grant covers `primary:8vo`, so `..` may leave `post/` but not `8vo`.
        assertNull(
            DocumentImagePathPolicy.resolveChildDocumentId(
                "primary:8vo",
                DOCUMENT_ID,
                "../../../etc/passwd"
            )
        );
        assertNull(
            DocumentImagePathPolicy.resolveChildDocumentId(
                DOCUMENT_DIRECTORY,
                DOCUMENT_ID,
                "../escape.png"
            )
        );
        // A `..` that stays inside a broader grant is a normal path: the
        // document's own `post/` folder belongs to the `primary:8vo` tree.
        assertEquals(
            "primary:8vo/cover.png",
            DocumentImagePathPolicy.resolveChildDocumentId(
                "primary:8vo",
                DOCUMENT_ID,
                "../cover.png"
            )
        );
    }

    @Test
    public void resolvesImagesBesideAVolumeRootDocument() {
        assertEquals(
            "primary:images/Designer.png",
            DocumentImagePathPolicy.resolveChildDocumentId(
                "primary:",
                "primary:note.md",
                "images/Designer.png"
            )
        );
    }

    @Test
    public void refusesSourcesThatNameNoFile() {
        assertNull(
            DocumentImagePathPolicy.resolveChildDocumentId(DOCUMENT_DIRECTORY, DOCUMENT_ID, "")
        );
        assertNull(
            DocumentImagePathPolicy.resolveChildDocumentId(DOCUMENT_DIRECTORY, DOCUMENT_ID, ".")
        );
        assertNull(
            DocumentImagePathPolicy.resolveChildDocumentId(DOCUMENT_DIRECTORY, DOCUMENT_ID, null)
        );
    }

    @Test
    public void refusesWhenTheTreeDoesNotCoverTheDocument() {
        assertNull(
            DocumentImagePathPolicy.resolveChildDocumentId(
                "primary:other",
                DOCUMENT_ID,
                "images/Designer.png"
            )
        );
        assertNull(
            DocumentImagePathPolicy.resolveChildDocumentId(
                DOCUMENT_DIRECTORY,
                "1A2B3C4D5E",
                "images/Designer.png"
            )
        );
    }
}
