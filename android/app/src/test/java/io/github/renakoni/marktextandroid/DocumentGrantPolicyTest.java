package io.github.renakoni.marktextandroid;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.Test;

public class DocumentGrantPolicyTest {

    private static final long NOW = 1_700_000_000_000L;
    private static final long SETTLED = NOW - DocumentGrantPolicy.SETTLE_WINDOW_MILLIS - 1;

    private static Map<String, DocumentGrantPolicy.Entry> ledger(Object... pairs) {
        Map<String, DocumentGrantPolicy.Entry> ledger = new HashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            ledger.put((String) pairs[index], (DocumentGrantPolicy.Entry) pairs[index + 1]);
        }
        return ledger;
    }

    private static DocumentGrantPolicy.Entry document(long takenAtMillis) {
        return new DocumentGrantPolicy.Entry(DocumentGrantPolicy.Kind.DOCUMENT, takenAtMillis);
    }

    private static DocumentGrantPolicy.Entry image(long takenAtMillis) {
        return new DocumentGrantPolicy.Entry(DocumentGrantPolicy.Kind.IMAGE, takenAtMillis);
    }

    @Test
    public void releasesOnlySettledUnreferencedDocumentGrants() {
        List<String> persisted = Arrays.asList(
            "content://docs/referenced",
            "content://docs/orphan",
            "content://docs/fresh"
        );
        Map<String, DocumentGrantPolicy.Entry> entries = ledger(
            "content://docs/referenced", document(SETTLED),
            "content://docs/orphan", document(SETTLED),
            "content://docs/fresh", document(NOW - 1_000)
        );

        DocumentGrantPolicy.Decision decision = DocumentGrantPolicy.decide(
            persisted,
            entries,
            Collections.singleton("content://docs/referenced"),
            NOW
        );

        assertEquals(Collections.singletonList("content://docs/orphan"), decision.releaseUris);
        assertEquals(
            new HashSet<>(Arrays.asList("content://docs/referenced", "content://docs/fresh")),
            decision.nextLedger.keySet()
        );
    }

    @Test
    public void neverReleasesGrantsWithoutALedgerEntry() {
        DocumentGrantPolicy.Decision decision = DocumentGrantPolicy.decide(
            Collections.singletonList("content://docs/legacy"),
            ledger(),
            Collections.emptySet(),
            NOW
        );

        assertTrue(decision.releaseUris.isEmpty());
        assertTrue(decision.nextLedger.isEmpty());
    }

    @Test
    public void neverReleasesImageGrants() {
        DocumentGrantPolicy.Decision decision = DocumentGrantPolicy.decide(
            Collections.singletonList("content://media/linked-image"),
            ledger("content://media/linked-image", image(SETTLED)),
            Collections.emptySet(),
            NOW
        );

        assertTrue(decision.releaseUris.isEmpty());
        assertEquals(
            Collections.singleton("content://media/linked-image"),
            decision.nextLedger.keySet()
        );
    }

    @Test
    public void settleWindowBoundaryIsExact() {
        long atWindow = NOW - DocumentGrantPolicy.SETTLE_WINDOW_MILLIS;
        Map<String, DocumentGrantPolicy.Entry> entries = ledger(
            "content://docs/at-window", document(atWindow),
            "content://docs/past-window", document(atWindow - 1)
        );

        DocumentGrantPolicy.Decision decision = DocumentGrantPolicy.decide(
            Arrays.asList("content://docs/at-window", "content://docs/past-window"),
            entries,
            Collections.emptySet(),
            NOW
        );

        assertEquals(Collections.singletonList("content://docs/past-window"), decision.releaseUris);
        assertEquals(Collections.singleton("content://docs/at-window"), decision.nextLedger.keySet());
    }

    @Test
    public void dropsLedgerEntriesWhoseGrantIsGone() {
        DocumentGrantPolicy.Decision decision = DocumentGrantPolicy.decide(
            Collections.singletonList("content://docs/alive"),
            ledger(
                "content://docs/alive", document(SETTLED),
                "content://docs/revoked", document(SETTLED)
            ),
            Collections.singleton("content://docs/alive"),
            NOW
        );

        assertTrue(decision.releaseUris.isEmpty());
        assertEquals(Collections.singleton("content://docs/alive"), decision.nextLedger.keySet());
    }

    @Test
    public void ledgerSerializationRoundTripsIncludingPipesInUris() {
        Map<String, DocumentGrantPolicy.Entry> entries = ledger(
            "content://docs/plain", document(123L),
            "content://docs/with%7Cpipe|raw", image(456L)
        );

        Map<String, DocumentGrantPolicy.Entry> parsed = DocumentGrantPolicy.parseLedger(
            DocumentGrantPolicy.serializeLedger(entries)
        );

        assertEquals(entries.keySet(), parsed.keySet());
        assertEquals(DocumentGrantPolicy.Kind.DOCUMENT, parsed.get("content://docs/plain").kind);
        assertEquals(123L, parsed.get("content://docs/plain").takenAtMillis);
        assertEquals(
            DocumentGrantPolicy.Kind.IMAGE,
            parsed.get("content://docs/with%7Cpipe|raw").kind
        );
        assertEquals(456L, parsed.get("content://docs/with%7Cpipe|raw").takenAtMillis);
    }

    @Test
    public void parsingSkipsMalformedLinesAndEmptyInput() {
        assertTrue(DocumentGrantPolicy.parseLedger(null).isEmpty());
        assertTrue(DocumentGrantPolicy.parseLedger("").isEmpty());

        Map<String, DocumentGrantPolicy.Entry> parsed = DocumentGrantPolicy.parseLedger(
            String.join(
                "\n",
                "garbage",
                "unknown-kind|123|content://docs/a",
                "document|not-a-number|content://docs/b",
                "document|123|",
                "document|123|content://docs/valid"
            )
        );

        assertEquals(Collections.singleton("content://docs/valid"), parsed.keySet());
    }

    @Test
    public void manyDocumentsStressStaysUnderTheGrantQuota() {
        // Simulates a long-lived install opening 500 documents one minute
        // apart, with the web recents store keeping its newest 100 records
        // and a cleanup after every open — the wiring this PR adds. The OS
        // quota floor is 128 (Android 10 and below).
        final int quota = 128;
        final int recentsCap = 100;
        long clock = NOW;

        Map<String, DocumentGrantPolicy.Entry> entries = new HashMap<>();
        Set<String> persisted = new LinkedHashSet<>();
        Deque<String> recents = new ArrayDeque<>();

        for (int index = 0; index < 500; index++) {
            clock += 60_000;
            String uri = "content://docs/stress-" + index;
            persisted.add(uri);
            entries.put(uri, document(clock));
            recents.addFirst(uri);
            while (recents.size() > recentsCap) {
                recents.removeLast();
            }

            DocumentGrantPolicy.Decision decision = DocumentGrantPolicy.decide(
                new ArrayList<>(persisted),
                entries,
                new HashSet<>(recents),
                clock
            );
            decision.releaseUris.forEach(persisted::remove);
            entries = decision.nextLedger;

            // Live grants: the 100 recents plus at most the not-yet-settled
            // evictions (settle window / open interval = 5 grants).
            assertTrue(
                "grants at open " + index + ": " + persisted.size(),
                persisted.size() <= recentsCap + (int) (DocumentGrantPolicy.SETTLE_WINDOW_MILLIS / 60_000)
            );
            assertTrue(persisted.size() < quota);
        }

        // Once the last evictions settle, the grant table converges to
        // exactly the protected set.
        DocumentGrantPolicy.Decision finalDecision = DocumentGrantPolicy.decide(
            new ArrayList<>(persisted),
            entries,
            new HashSet<>(recents),
            clock + DocumentGrantPolicy.SETTLE_WINDOW_MILLIS + 1
        );
        finalDecision.releaseUris.forEach(persisted::remove);
        assertEquals(recentsCap, persisted.size());
        assertEquals(new HashSet<>(recents), persisted);
    }

    @Test
    public void pinnedStyleReferencesSurviveIndefinitely() {
        // A pinned document's URI stays in the referenced set forever even
        // as hundreds of newer documents come and go; its grant must too.
        final String pinned = "content://docs/pinned";
        long clock = NOW;

        Map<String, DocumentGrantPolicy.Entry> entries = new HashMap<>();
        Set<String> persisted = new LinkedHashSet<>();
        persisted.add(pinned);
        entries.put(pinned, document(clock));

        for (int index = 0; index < 300; index++) {
            clock += 60_000;
            String uri = "content://docs/churn-" + index;
            persisted.add(uri);
            entries.put(uri, document(clock));

            Set<String> referenced = new HashSet<>();
            referenced.add(pinned);
            referenced.add(uri);

            DocumentGrantPolicy.Decision decision = DocumentGrantPolicy.decide(
                new ArrayList<>(persisted),
                entries,
                referenced,
                clock
            );
            decision.releaseUris.forEach(persisted::remove);
            entries = decision.nextLedger;
        }

        assertTrue(persisted.contains(pinned));
        assertFalse(persisted.contains("content://docs/churn-0"));
        assertTrue(persisted.size() <= 1 + 1 + (int) (DocumentGrantPolicy.SETTLE_WINDOW_MILLIS / 60_000));
    }
}
