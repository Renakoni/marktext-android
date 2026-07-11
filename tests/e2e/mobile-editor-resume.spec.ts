import { expect, test, type Page } from '@playwright/test'
import { DRAFTS_STORAGE_KEY, openLocalDraft } from './helpers/drafts'
import { expectEditorReady } from './helpers/editor'

test.describe.configure({ timeout: 60000 })

const RESUME_STORAGE_KEY = 'marktext-for-android:resume-positions'
const DRAFT_ID = 'resume-draft'
const DOC_KEY = `local-draft:${DRAFT_ID}`
const CAPTURE_SCROLL_TOP = 3000

const LONG_MARKDOWN = `# Resume Alpha

${Array.from(
  { length: 140 },
  (_, index) =>
    `Filler paragraph ${index + 1} with enough words to wrap onto a second line on a phone viewport.`,
).join('\n\n')}
`

async function openResumeDraft(page: Page) {
  await openLocalDraft(page, {
    id: DRAFT_ID,
    markdown: LONG_MARKDOWN,
    title: /Resume Alpha/,
  })
}

async function scrollEditorTo(page: Page, top: number) {
  await page.evaluate(value => {
    document.querySelector<HTMLElement>('.editor-host-shell')!.scrollTop = value
  }, top)
  // Capture happens live at exit; this wait only keeps position assertions
  // deterministic (scroll delivery + card dismissal side effects).
  await page.waitForTimeout(500)
}

function getShellScrollTop(page: Page) {
  return page.evaluate(() => document.querySelector<HTMLElement>('.editor-host-shell')!.scrollTop)
}

function getResumeStorage(page: Page) {
  return page.evaluate(key => localStorage.getItem(key) ?? '', RESUME_STORAGE_KEY)
}

async function exitToHome(page: Page) {
  await page.getByTestId('back-button').click()
  await expect(page.getByTestId('new-document-button')).toBeVisible()
}

async function reopenDraft(page: Page) {
  await page.getByRole('button', { name: /Resume Alpha/ }).click()
  await expectEditorReady(page)
}

/** Open the draft, scroll deep into it, and exit so a position is stored. */
async function seedCapturedPosition(page: Page) {
  await openResumeDraft(page)
  await scrollEditorTo(page, CAPTURE_SCROLL_TOP)
  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)
}

test('captures on exit and resumes from the card without auto-scrolling', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)

  // The document opens at the top; nothing scrolls until the user taps.
  const card = page.getByTestId('resume-card')
  await expect(card).toBeVisible()
  expect(await getShellScrollTop(page)).toBe(0)
  await expect(page.getByTestId('resume-card-button')).toContainText('Filler paragraph')

  await page.getByTestId('resume-card-button').click()

  await expect(card).toHaveCount(0)
  await expect
    .poll(() => getShellScrollTop(page))
    .toBeGreaterThan(CAPTURE_SCROLL_TOP - 60)
  expect(await getShellScrollTop(page)).toBeLessThan(CAPTURE_SCROLL_TOP + 60)

  // The jump never focuses Muya, so the soft keyboard stays closed.
  const focusInEditor = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-testid="editor-host"]')),
  )
  expect(focusInEditor).toBe(false)
})

test('silently discards the position when the document changed since capture', async ({
  page,
}) => {
  await seedCapturedPosition(page)

  // Simulate an external edit between sessions.
  await page.evaluate(key => {
    const drafts = JSON.parse(localStorage.getItem(key)!) as Array<{ markdown: string }>
    drafts[0].markdown += '\nExternally appended line.\n'
    localStorage.setItem(key, JSON.stringify(drafts))
  }, DRAFTS_STORAGE_KEY)
  await page.reload()
  await reopenDraft(page)

  // No card, no fallback jump — and the stale record is cleaned up.
  await page.waitForTimeout(900)
  await expect(page.getByTestId('resume-card')).toHaveCount(0)
  expect(await getShellScrollTop(page)).toBe(0)
  await expect.poll(() => getResumeStorage(page)).not.toContain(DOC_KEY)
})

test('does not offer the card for a position near the top', async ({ page }) => {
  await openResumeDraft(page)
  await scrollEditorTo(page, 200)
  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)

  await reopenDraft(page)
  await page.waitForTimeout(900)
  await expect(page.getByTestId('resume-card')).toHaveCount(0)
})

test('user scrolling dismisses the card without jumping', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await scrollEditorTo(page, 200)

  await expect(page.getByTestId('resume-card')).toHaveCount(0)
  // Dismissal must not trigger the jump.
  expect(await getShellScrollTop(page)).toBeLessThan(400)
})

test('the explicit close control dismisses the card', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await page.getByTestId('resume-card-dismiss').click()

  await expect(page.getByTestId('resume-card')).toHaveCount(0)
  expect(await getShellScrollTop(page)).toBe(0)
})

test('competing editor surfaces dismiss the card', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await page.getByTestId('search-open-button').click()
  await expect(page.getByTestId('editor-search-bar')).toBeVisible()
  await expect(page.getByTestId('resume-card')).toHaveCount(0)

  // A fresh session offers the card again; the outline dismisses it too.
  await page.getByTestId('search-close-button').click()
  await exitToHome(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await page.getByTestId('outline-open-button').click()
  await expect(page.getByTestId('outline-sheet')).toBeVisible()
  await expect(page.getByTestId('resume-card')).toHaveCount(0)
})

test('editing dismisses the card', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  await page.locator('.mu-editor p').first().click()
  await page.keyboard.type('x')

  await expect(page.getByTestId('resume-card')).toHaveCount(0)
})

test('resume never modifies the document, drafts storage, or save state', async ({ page }) => {
  await seedCapturedPosition(page)
  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()

  const draftsBefore = await page.evaluate(key => localStorage.getItem(key), DRAFTS_STORAGE_KEY)
  await page.getByTestId('resume-card-button').click()
  await expect.poll(() => getShellScrollTop(page)).toBeGreaterThan(0)
  await page.waitForTimeout(600)

  const draftsAfter = await page.evaluate(key => localStorage.getItem(key), DRAFTS_STORAGE_KEY)
  expect(draftsAfter).toBe(draftsBefore)
})

test('exiting immediately after scrolling still persists the latest position', async ({
  page,
}) => {
  await openResumeDraft(page)
  // Scroll and leave right away — no settle wait of any kind. The exit path
  // must capture the live viewport, not a debounced snapshot.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.editor-host-shell')!.scrollTop = 3000
  })
  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)

  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()
  await page.getByTestId('resume-card-button').click()
  await expect.poll(() => getShellScrollTop(page)).toBeGreaterThan(2900)
  expect(await getShellScrollTop(page)).toBeLessThan(3100)
})

test('the second scroll position wins over an earlier settled one on immediate exit', async ({
  page,
}) => {
  await openResumeDraft(page)
  await scrollEditorTo(page, 1500)
  // Move again and exit before any quiet window can elapse.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.editor-host-shell')!.scrollTop = 3200
  })
  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)

  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()
  await page.getByTestId('resume-card-button').click()
  await expect.poll(() => getShellScrollTop(page)).toBeGreaterThan(3100)
  expect(await getShellScrollTop(page)).toBeLessThan(3300)
})

test('a structural edit without another scroll never yields a stale anchor target', async ({
  page,
}) => {
  // One very tall paragraph deep in the document: splitting it moves the
  // in-block geometry enough that a stale pre-edit anchor (old index/ratio
  // against the new structure) would land hundreds of pixels off.
  const tallSentence = 'This tall block sentence keeps the paragraph very high on a phone. '
  const markdown = `# Resume Alpha

${Array.from({ length: 30 }, (_, i) => `Lead-in paragraph ${i + 1}.`).join('\n\n')}

${tallSentence.repeat(40).trim()}

${Array.from({ length: 30 }, (_, i) => `Trailing paragraph ${i + 1}.`).join('\n\n')}
`
  await openLocalDraft(page, { id: DRAFT_ID, markdown, title: /Resume Alpha/ })

  // Park the viewport top deep INSIDE the tall block (ratio ~0.75).
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.editor-host-shell')!
    const tall = [...shell.querySelectorAll('.mu-container > p')].find(
      p => (p.textContent ?? '').startsWith('This tall block'),
    )!
    const shellRect = shell.getBoundingClientRect()
    const rect = tall.getBoundingClientRect()
    shell.scrollTop = shell.scrollTop + (rect.top - shellRect.top) + rect.height * 0.75
  })
  await page.waitForTimeout(500)

  // Split the tall block just below the viewport top, then exit WITHOUT
  // scrolling again.
  const shellBox = (await page.locator('.editor-host-shell').boundingBox())!
  await page.mouse.click(shellBox.x + shellBox.width / 2, shellBox.y + 40)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const exitScrollTop = await getShellScrollTop(page)

  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)

  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()
  await page.getByTestId('resume-card-button').click()
  await expect.poll(() => getShellScrollTop(page)).toBeGreaterThan(exitScrollTop - 80)
  expect(await getShellScrollTop(page)).toBeLessThan(exitScrollTop + 80)
})

test('eligibility is judged after the initial layout settles with late-loading content', async ({
  page,
}) => {
  // A tall image above the target loads late on reopen: before it lays out,
  // the target transiently sits above the 1.5-viewport threshold and a
  // premature evaluation would permanently suppress the card.
  // Narrower than the phone editor content width so the height is never
  // scaled down with the aspect ratio.
  const tallSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="3200">' +
    '<rect width="320" height="3200" fill="#dcdce8"/></svg>'
  await page.route('**/slow-block.svg', async route => {
    await new Promise(resolve => setTimeout(resolve, 900))
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      headers: { 'Cache-Control': 'no-store' },
      body: tallSvg,
    })
  })

  // Full URL: Muya's getImageSrc treats a bare "/path" as a local file.
  const markdown = `# Resume Alpha

![tall diagram](http://127.0.0.1:5174/slow-block.svg)

${Array.from({ length: 25 }, (_, i) => `After-image paragraph ${i + 1}.`).join('\n\n')}
`
  await openLocalDraft(page, { id: DRAFT_ID, markdown, title: /Resume Alpha/ })

  // Capture against the final layout: wait for the image to land first.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector<HTMLElement>('.editor-host-shell')!.scrollHeight,
        ),
      { timeout: 15000 },
    )
    .toBeGreaterThan(3000)
  await scrollEditorTo(page, 2600)
  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)

  // Reload so neither the browser cache nor Muya's in-session image cache
  // can short-circuit the slow load on reopen.
  await page.reload()
  await reopenDraft(page)

  await expect(page.getByTestId('resume-card')).toBeVisible({ timeout: 8000 })
  await page.getByTestId('resume-card-button').click()
  await expect.poll(() => getShellScrollTop(page)).toBeGreaterThan(2400)
})

test('stabilization keeps re-pinning while an image is still pending after activation', async ({
  page,
}) => {
  // The image is slower than the initial-settle hard cap, so the card
  // becomes actionable while the image is STILL loading. After the tap, the
  // stabilization window must survive the resize-free network wait (pending
  // image ⇒ quiet window not trustworthy) and re-pin the anchor when the
  // image finally lands — instead of disconnecting after 600 ms of quiet
  // and leaving the user displaced by ~3200 px.
  const tallSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="3200">' +
    '<rect width="320" height="3200" fill="#dcdce8"/></svg>'
  // Fast on the capture session (so the anchor is measured on the full
  // layout), slower than the initial-settle hard cap on the reopen session.
  let imageRequests = 0
  await page.route('**/slow-block.svg', async route => {
    imageRequests += 1
    await new Promise(resolve => setTimeout(resolve, imageRequests === 1 ? 100 : 6500))
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      headers: { 'Cache-Control': 'no-store' },
      body: tallSvg,
    })
  })

  const filler =
    'with enough words to wrap onto a second line on a phone viewport.'
  const markdown = `# Resume Alpha

${Array.from({ length: 60 }, (_, i) => `Lead-in paragraph ${i + 1} ${filler}`).join('\n\n')}

![tall diagram](http://127.0.0.1:5174/slow-block.svg)

${Array.from({ length: 25 }, (_, i) => `Trailing paragraph ${i + 1} ${filler}`).join('\n\n')}
`
  await openLocalDraft(page, { id: DRAFT_ID, markdown, title: /Resume Alpha/ })

  // Capture against the final layout: the CONTENT image (not a UI icon) is
  // in the DOM, anchored in a trailing paragraph BELOW the image.
  await expect(page.locator('.mu-container .mu-inline-image img')).toBeVisible({
    timeout: 15000,
  })
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.editor-host-shell')!
    const target = [...shell.querySelectorAll<HTMLElement>('.mu-container > p')].find(p =>
      (p.textContent ?? '').startsWith('Trailing paragraph 5'),
    )!
    const shellRect = shell.getBoundingClientRect()
    shell.scrollTop = shell.scrollTop + (target.getBoundingClientRect().top - shellRect.top) - 100
  })
  await page.waitForTimeout(500)
  const capturedScrollTop = await getShellScrollTop(page)
  expect(capturedScrollTop).toBeGreaterThan(5000)

  await exitToHome(page)
  await expect.poll(() => getResumeStorage(page)).toContain(DOC_KEY)

  // Fresh page so the slow load happens again on reopen.
  await page.reload()
  await reopenDraft(page)

  // The card is offered at the initial-settle hard cap with the image still
  // in flight; the transient target (image collapsed) is far enough down to
  // stay eligible.
  await expect(page.getByTestId('resume-card')).toBeVisible({ timeout: 8000 })
  await page.getByTestId('resume-card-button').click()

  // First landing happens against the image-less layout, well short of the
  // final position — proving late content displaces the target...
  await expect.poll(() => getShellScrollTop(page)).toBeGreaterThan(1000)
  expect(await getShellScrollTop(page)).toBeLessThan(capturedScrollTop - 2000)

  // ...and the bounded stabilization window re-pins the anchor once the
  // image lands.
  await expect
    .poll(() => getShellScrollTop(page), { timeout: 12000 })
    .toBeGreaterThan(capturedScrollTop - 100)
  expect(await getShellScrollTop(page)).toBeLessThan(capturedScrollTop + 100)
})

test('a revisit without scrolling keeps the stored position', async ({ page }) => {
  await seedCapturedPosition(page)
  const storedBefore = await getResumeStorage(page)

  await reopenDraft(page)
  await expect(page.getByTestId('resume-card')).toBeVisible()
  await exitToHome(page)

  // No scroll happened, so no anchor was captured and the record survives
  // untouched for the next session.
  await page.waitForTimeout(400)
  expect(await getResumeStorage(page)).toBe(storedBefore)
})
