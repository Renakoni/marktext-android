# ICU4J charset detector (vendored)

Charset-detection classes extracted verbatim from ICU4J. The platform ships
the same engine as `android.icu.text.CharsetDetector`, but that class is not
part of the public Android SDK, so the app compiles these sources directly.

- Upstream: `com.ibm.icu:icu4j:74.2` sources jar
  (https://repo1.maven.org/maven2/com/ibm/icu/icu4j/74.2/icu4j-74.2-sources.jar)
- Files: `com/ibm/icu/text/CharsetDetector.java`, `CharsetMatch.java`,
  `CharsetRecognizer.java`, `CharsetRecog_UTF8.java`,
  `CharsetRecog_Unicode.java`, `CharsetRecog_mbcs.java`,
  `CharsetRecog_sbcs.java`, `CharsetRecog_2022.java` — unmodified.
- The set is self-contained: it only imports `java.*` and embeds its n-gram
  frequency tables in code, so no ICU data files are required.
- License: Unicode/ICU license, see `LICENSE` (copied from the same jar).

The app consumes this through `MarkdownCodec`'s `CharsetSniffer` seam
(`IcuCharsetSniffer`); detection guesses are only accepted after the codec's
own confidence threshold and strict round-trip validation.

If a real `com.ibm.icu:icu4j` dependency is ever added to the Android app,
delete this directory first — the classes keep their original package name
and would collide.
