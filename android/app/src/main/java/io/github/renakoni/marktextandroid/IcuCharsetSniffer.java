package io.github.renakoni.marktextandroid;

import com.ibm.icu.text.CharsetDetector;
import com.ibm.icu.text.CharsetMatch;
import java.util.ArrayList;
import java.util.List;

/**
 * CharsetSniffer backed by the vendored ICU charset detector
 * (third_party/icu4j-charset-detector — the platform ships the same engine,
 * but android.icu.text.CharsetDetector is not public SDK). Pure JVM, so unit
 * tests exercise the real statistical recognizers directly.
 */
final class IcuCharsetSniffer implements CharsetSniffer {

    @Override
    public List<Guess> sniff(byte[] bytes) {
        CharsetDetector detector = new CharsetDetector();
        detector.setText(bytes);
        CharsetMatch[] matches = detector.detectAll();
        List<Guess> guesses = new ArrayList<>();
        if (matches != null) {
            for (CharsetMatch match : matches) {
                guesses.add(new Guess(match.getName(), match.getConfidence()));
            }
        }
        return guesses;
    }
}
