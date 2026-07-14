# Android modal accessibility audit (2026-07-14)

## Decision

All ten application dialogs now share one focus and background-isolation
contract. The browser test matrix and representative Android accessibility
trees show that focus enters the active dialog, keyboard focus cannot escape,
background controls leave the accessibility tree, and focus is restored after
close.

## Scope

- Editor document actions
- Outline
- Link insertion
- Table insertion
- Local-draft exit decision
- Android-document exit decision
- Incoming-document decision
- Home delete confirmation
- Home rename
- Settings maintenance confirmation

Every `role="dialog"` component uses `useModalFocus`. The shared helper owns
initial focus, Escape handling, Tab and Shift+Tab wrapping, sibling isolation,
attribute restoration, and trigger focus restoration.

Link insertion is the only deliberate non-inert exception. Muya must briefly
focus the mounted editor to restore its saved selection. While the sheet is
open, EditorScreen removes background surfaces from the accessibility tree
with `aria-hidden`; immediately before insertion it removes that state, waits
for Vue to flush, restores the selection, and then returns focus to the sheet
if it remains open.

## Automated evidence

- `src/lib/modalFocus.test.ts`: Tab wrapping, stray-focus recovery, complete
  sibling isolation, exact attribute restoration, and no-control behavior.
- `src/lib/modalFocusContract.test.ts`: all ten dialogs use the shared
  lifecycle; link insertion is the sole non-inert exception.
- `tests/e2e/mobile-modal-accessibility.spec.ts`: editor actions, exit prompt,
  incoming open, home delete/rename, and settings maintenance. Each case checks
  initial focus, every background branch, repeated Tab traversal, close, and
  focus restoration.

The existing related mobile E2E set also covers outline, link, table, Android
Back, and editor selection restoration.

## Device evidence

- Device: Xiaomi 23127PN0CC (`4dd67ae4`)
- Android: 14 / API 34
- WebView: `com.google.android.webview` 149.0.7827.91
- TalkBack service: `com.google.android.marvin.talkback/.TalkBackService`

With TalkBack active, the settings maintenance tree contained only one
`AlertDialog`, its title/body, and its two actions. Home, settings navigation,
and bottom navigation were absent; focus was inside the dialog. The captured
tree is local at `logs/talkback-settings-modal.xml`.

After spoken feedback was stopped, CDP accessibility trees were collected for
three additional app surfaces:

| Surface | Exposed interactive nodes | Background | Initial focus |
| --- | --- | --- | --- |
| Editor actions | Dialog plus Share, Export PDF, Save to device | Absent | Share |
| Link insertion | Dialog, Text/URL fields, Insert, Cancel | Absent | URL field |
| Home delete | Dialog, Delete, Cancel | Absent | Inside dialog |

The incoming-document prompt is covered by the Android event mock E2E because
reproducing a blocked preservation transaction on the user's live document
would require changing persistence settings and injecting unsaved content.

## Device restoration

The device began with accessibility disabled, no enabled accessibility
services, and touch exploration disabled. Those exact values were restored:

- `accessibility_enabled=0`
- `enabled_accessibility_services=null`
- `touch_exploration_enabled=0`

Media volume was restored to its original index 75 and verified unmuted.

## Remaining limit

Spoken announcement wording and swipe order were not listened through on every
dialog. TalkBack was stopped when its speech disturbed the device owner. The
structural accessibility and focus contract is covered across all dialogs;
future manual release checks can sample spoken wording without changing the
implementation contract.
