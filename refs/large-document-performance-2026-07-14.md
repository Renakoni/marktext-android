# Android large-document performance (2026-07-14)

## Decision

The measured outline, search, and resume paths no longer contain the identified
quadratic or whole-document redraw behavior. The real-device matrix now
completes through a 1.5 MB document with 30,001 top-level blocks; the previous
10,000-section run exceeded the 120-second editor-open timeout.

## Environment

- Device: Xiaomi 23127PN0CC (`4dd67ae4`)
- Android: 14 / API 34
- WebView: `com.google.android.webview` 149.0.7827.91
- Documents: 250, 1,000, 5,000, and 10,000 repeated Markdown sections
- Evidence: timings, long tasks, and editor/outline CPU profiles under
  `logs/large-document-matrix/`

## Changes

1. Muya search redraws only the previous and next active blocks during
   navigation.
2. Above 100 matches, search retains the exact count and navigation set but
   renders only the active highlight.
3. Query input uses a 120 ms trailing debounce and flushes immediately for
   Enter/Next/Previous.
4. Resume-anchor lookup uses binary search over ordered block rectangles,
   reducing layout reads from O(n) to O(log n).
5. Muya state snapshots use a schema-specific defensive tree clone instead of
   Android WebView's slow `structuredClone` implementation.
6. Reference-definition collection is cached by a monotonic JSON-state
   revision. A document is scanned once after a replacement or applied OT
   operation, rather than once for every rendered content block.

## Results

| Sections | Markdown | Blocks | Editor ready | Outline | Sparse search | Dense search | Next | Clear | Resume persist |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 250 | 37.5 KB | 751 | 0.75s | 0.26s | 0.21s | 0.17s | 4ms | 55ms | 34ms |
| 1,000 | 150 KB | 3,001 | 1.58s | 0.49s | 0.21s | 0.20s | 9ms | 76ms | 65ms |
| 5,000 | 750 KB | 15,001 | 13.26s | 1.53s | 0.37s | 0.45s | 28ms | 250ms | 203ms |
| 10,000 | 1.50 MB | 30,001 | 45.73s | 3.19s | 3.00s | 1.54s | 34ms | 489ms | 442ms |

The 1,000-section baseline before these changes took about 26.8 seconds to
open, 6.4 seconds to search 1,000 matches, 12.5 seconds to move to the next
match, and 6.2 seconds to clear. Before the final reference cache, the
5,000-section editor took about 60.7 seconds and the 10,000-section case timed
out above 120 seconds.

## Profiles and boundaries

The pre-fix 5,000-section profile showed reference-definition collection
scanning the full JSON state for every block. After caching, that path is no
longer material. At 10,000 sections the remaining editor-open cost is primarily
Markdown parsing and unavoidable creation of 30,001 editor blocks:

- `walkTokens`: about 19.7s self time
- `_convertMarkdownToState`: about 5.2s
- parser `start`: about 5.2s
- garbage collection: about 3.0s

The outline profile attributes only about 7 ms to `getTOC`; its 3.19-second
10,000-heading cost is WebView mounting and layout of the complete accessible
list. A `content-visibility` experiment was rejected after it caused a
greater-than-30-second interaction stall at 5,000 headings. Virtualizing the
list would change TalkBack traversal semantics and is not justified for this
extreme case without a dedicated accessible-list design.

## Data safety

The probe backs up every WebView local-storage key before each matrix and
restores the original values in `finally`, including failure and timeout paths.
It does not write Android documents or download dependencies.

## Reproduction

Build and install the current debug APK, then run:

```powershell
$env:ANDROID_SERIAL = '4dd67ae4'
node scripts/probe-android-large-document.mjs
```
