import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readClipboardSource() {
  return readFileSync(resolve('third_party/muya/src/clipboard/index.ts'), 'utf8')
}

function readPasteSource() {
  return readFileSync(resolve('third_party/muya/src/clipboard/paste.ts'), 'utf8')
}

describe('Muya IME paste interception contract', () => {
  it('listens for beforeinput and routes paste-like inserts through the paste pipeline', () => {
    const source = readClipboardSource()

    expect(source).toContain("attachDOMEvent(document, 'beforeinput', beforeInputHandler)")
    expect(source).toContain("inputType === 'insertFromPaste'")
    expect(source).toContain('pasteRawText(this, text.replace(')
  })

  it('treats multi-line insertText commits as paste-like', () => {
    const source = readClipboardSource()
    expect(source).toContain("inputType === 'insertText' && /[\\r\\n]/.test(text)")
  })

  it('keeps normal-paste semantics for the raw-text entry', () => {
    const source = readPasteSource()
    const start = source.indexOf('export function pasteRawText')
    expect(start).toBeGreaterThanOrEqual(0)
    const body = source.slice(start, source.indexOf('}', start))
    expect(body).toContain('pasteType: clipboard.pasteType')
  })
})
