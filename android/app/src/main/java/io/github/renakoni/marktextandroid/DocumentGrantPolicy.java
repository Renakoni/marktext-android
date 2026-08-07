package io.github.renakoni.marktextandroid;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Android-free policy for the persisted SAF grant lifecycle (#153).
 *
 * The web layer's recent-documents store is the LRU: it is capped at 100
 * records, pin-protected, and recency-ordered, and every Android document
 * record in it carries the content URI whose grant it depends on. This
 * policy follows that store instead of keeping a second recency clock: a
 * grant is released only when ALL of the following hold, so a release is
 * provably safe rather than heuristically likely:
 *
 * 1. The ledger proves this app took the grant for a Markdown document.
 *    Image grants and grants that predate the ledger have dependents this
 *    policy cannot enumerate (document bodies reference linked images;
 *    legacy grants have no recorded kind), so they are never released.
 * 2. The web layer reports no recent/pinned/current document references
 *    the URI.
 * 3. The grant settled: it was taken more than {@link #SETTLE_WINDOW_MILLIS}
 *    ago. A cleanup call carries a reference snapshot the web computed
 *    before a concurrent open could add its URI, so fresh grants are
 *    skipped and picked up by the next cleanup instead.
 */
final class DocumentGrantPolicy {

    /** Skip releasing grants younger than this; see class contract point 3. */
    static final long SETTLE_WINDOW_MILLIS = 5 * 60 * 1000;

    enum Kind {
        DOCUMENT,
        IMAGE;

        static Kind fromStorageName(String value) {
            if ("document".equals(value)) {
                return DOCUMENT;
            }
            if ("image".equals(value)) {
                return IMAGE;
            }
            return null;
        }

        String toStorageName() {
            return this == DOCUMENT ? "document" : "image";
        }
    }

    static final class Entry {

        final Kind kind;
        final long takenAtMillis;

        Entry(Kind kind, long takenAtMillis) {
            this.kind = kind;
            this.takenAtMillis = takenAtMillis;
        }
    }

    static final class Decision {

        /** URIs whose persisted grant should be released, in input order. */
        final List<String> releaseUris;
        /** Ledger to persist after the releases succeed. */
        final Map<String, Entry> nextLedger;

        Decision(List<String> releaseUris, Map<String, Entry> nextLedger) {
            this.releaseUris = releaseUris;
            this.nextLedger = nextLedger;
        }
    }

    private DocumentGrantPolicy() {}

    static Decision decide(
        Collection<String> persistedUris,
        Map<String, Entry> ledger,
        Set<String> referencedUris,
        long nowMillis
    ) {
        List<String> releaseUris = new ArrayList<>();
        Map<String, Entry> nextLedger = new HashMap<>();

        for (String uri : persistedUris) {
            Entry entry = ledger.get(uri);
            if (entry == null) {
                // Not ours to manage: predates the ledger or was taken by a
                // code path that does not record. Leave the grant alone.
                continue;
            }

            boolean releasable = entry.kind == Kind.DOCUMENT
                && !referencedUris.contains(uri)
                && nowMillis - entry.takenAtMillis > SETTLE_WINDOW_MILLIS;
            if (releasable) {
                releaseUris.add(uri);
            } else {
                nextLedger.put(uri, entry);
            }
        }

        // Entries whose grant is gone (revoked by the provider, the system's
        // own quota pruning, or the user) are dropped by not copying them, so
        // the ledger cannot outgrow the persisted grant table.
        return new Decision(releaseUris, nextLedger);
    }

    static Map<String, Entry> parseLedger(String serialized) {
        Map<String, Entry> ledger = new HashMap<>();
        if (serialized == null || serialized.length() == 0) {
            return ledger;
        }

        for (String line : serialized.split("\n", -1)) {
            int kindEnd = line.indexOf('|');
            if (kindEnd <= 0) {
                continue;
            }
            int takenAtEnd = line.indexOf('|', kindEnd + 1);
            if (takenAtEnd <= kindEnd + 1 || takenAtEnd + 1 >= line.length()) {
                continue;
            }

            Kind kind = Kind.fromStorageName(line.substring(0, kindEnd));
            if (kind == null) {
                continue;
            }
            long takenAtMillis;
            try {
                takenAtMillis = Long.parseLong(line.substring(kindEnd + 1, takenAtEnd));
            } catch (NumberFormatException ex) {
                continue;
            }

            ledger.put(line.substring(takenAtEnd + 1), new Entry(kind, takenAtMillis));
        }
        return ledger;
    }

    static String serializeLedger(Map<String, Entry> ledger) {
        StringBuilder serialized = new StringBuilder();
        for (Map.Entry<String, Entry> mapEntry : ledger.entrySet()) {
            String uri = mapEntry.getKey();
            if (uri.indexOf('\n') >= 0 || uri.indexOf('\r') >= 0) {
                // A URI that could corrupt the line format cannot round-trip;
                // dropping its entry only makes the grant unmanaged (kept).
                continue;
            }
            if (serialized.length() > 0) {
                serialized.append('\n');
            }
            Entry entry = mapEntry.getValue();
            serialized
                .append(entry.kind.toStorageName())
                .append('|')
                .append(entry.takenAtMillis)
                .append('|')
                .append(uri);
        }
        return serialized.toString();
    }
}
