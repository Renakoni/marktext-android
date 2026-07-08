import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readClipboardSource() {
  return readFileSync(resolve('third_party/muya/src/clipboard/index.ts'), 'utf8')
}

function getCutSelectionToClipboardDataBody(source: string) {
  const methodStart = source.indexOf('cutSelectionToClipboardData(): IClipboardPayload {')
  expect(methodStart).toBeGreaterThanOrEqual(0)

  const nextMethodStart = source.indexOf('\n    copyHandler(', methodStart)
  expect(nextMethodStart).toBeGreaterThan(methodStart)

  return source.slice(methodStart, nextMethodStart)
}

describe('Muya clipboard Android cut contract', () => {
  it('captures clipboard data before deleting the selection', () => {
    const methodBody = getCutSelectionToClipboardDataBody(readClipboardSource())

    expect(methodBody.indexOf('const payload = this.getClipboardData()')).toBeLessThan(
      methodBody.indexOf('this.cutHandler()'),
    )
  })

  it('notifies Muya content observers after a synchronous toolbar cut', () => {
    const methodBody = getCutSelectionToClipboardDataBody(readClipboardSource())

    expect(methodBody).toContain("this.muya.eventCenter.emit('content-change'")
    expect(methodBody.indexOf('this.cutHandler()')).toBeLessThan(
      methodBody.indexOf("this.muya.eventCenter.emit('content-change'"),
    )
  })
})
