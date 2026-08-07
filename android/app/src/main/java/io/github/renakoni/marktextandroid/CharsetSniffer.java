package io.github.renakoni.marktextandroid;

import java.util.List;

/**
 * Statistical charset sniffer for Markdown bytes without a BOM. Candidates
 * are ordered by descending confidence (0-100). MarkdownCodec applies its own
 * acceptance policy on top — supported-set mapping, a confidence threshold,
 * and strict round-trip validation — so a sniffer guess alone never decides.
 */
interface CharsetSniffer {

    List<Guess> sniff(byte[] bytes);

    final class Guess {

        final String charsetName;
        final int confidence;

        Guess(String charsetName, int confidence) {
            this.charsetName = charsetName;
            this.confidence = confidence;
        }
    }
}
