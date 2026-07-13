import { writeAndroidClipboardText } from './androidSelection'

// Copy plain text to the clipboard and report whether the write ACTUALLY
// succeeded. The Android native bridge wins; the web Clipboard API is the
// dev/e2e fallback. Callers must not claim success without checking the return
// value — a missing Clipboard API or a rejected write both resolve to false.
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (await writeAndroidClipboardText(text)) {
    return true
  }

  // `navigator.clipboard?.writeText(text)` would be unsafe here: when the API
  // is absent the optional chain yields `undefined`, and `await undefined`
  // resolves — reporting success without ever copying. Resolve the method
  // first and treat its absence as failure.
  const writeText = navigator.clipboard?.writeText
  if (!writeText) {
    return false
  }

  try {
    await writeText.call(navigator.clipboard, text)
    return true
  } catch {
    return false
  }
}
