import { expect, test, type Page } from '@playwright/test'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

async function openSearchDraft(page: Page) {
  await openLocalDraft(page, {
    id: 'editor-search-draft',
    markdown: `# Search Probe

apple banana apple cherry

- apple in a list
`,
    title: /Search Probe/,
  })
}

test('finds matches, shows the counter, and highlights the active match', async ({ page }) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  const input = page.getByTestId('search-input')
  await expect(input).toBeFocused()

  await input.fill('apple')

  await expect(page.getByTestId('search-count')).toHaveText('1/3')
  await expect(page.locator('span.mu-highlight')).toHaveCount(1)
  await expect(page.locator('span.mu-selection')).toHaveCount(2)
})

test('navigates next and previous with wrap-around', async ({ page }) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('apple')
  await expect(page.getByTestId('search-count')).toHaveText('1/3')

  await page.getByTestId('search-next-button').click()
  await expect(page.getByTestId('search-count')).toHaveText('2/3')

  await page.getByTestId('search-next-button').click()
  await page.getByTestId('search-next-button').click()
  await expect(page.getByTestId('search-count')).toHaveText('1/3')

  await page.getByTestId('search-previous-button').click()
  await expect(page.getByTestId('search-count')).toHaveText('3/3')

  await expect(page.locator('span.mu-highlight')).toHaveCount(1)
})

test('reports when nothing matches and disables navigation', async ({ page }) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('zebra')

  await expect(page.getByTestId('search-count')).toHaveText('No matches')
  await expect(page.getByTestId('search-next-button')).toBeDisabled()
  await expect(page.getByTestId('search-previous-button')).toBeDisabled()
  await expect(page.locator('span.mu-highlight')).toHaveCount(0)
})

test('closing clears highlights, restores the top bar, and returns focus to the editor', async ({
  page,
}) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('apple')
  await expect(page.locator('span.mu-highlight')).toHaveCount(1)

  await page.getByTestId('search-close-button').click()

  await expect(page.getByTestId('editor-search-bar')).toHaveCount(0)
  await expect(page.locator('span.mu-highlight')).toHaveCount(0)
  await expect(page.locator('span.mu-selection')).toHaveCount(0)
  await expect(page.getByTestId('back-button')).toBeVisible()

  // Muya's selectHighlight contract drops the cursor onto the last active
  // match, so typing continues inside the editor where the highlight was.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest('[data-testid="editor-host"]')),
      ),
    )
    .toBe(true)
})

test('closing with an empty query returns focus to the editor', async ({ page }) => {
  await openSearchDraft(page)

  // Establish an editing position before opening search.
  await page.getByTestId('editor-host').click()

  await page.getByTestId('search-open-button').click()
  await expect(page.getByTestId('search-input')).toBeFocused()
  await page.getByTestId('search-close-button').click()

  await expect(page.getByTestId('editor-search-bar')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest('[data-testid="editor-host"]')),
      ),
    )
    .toBe(true)
})

test('closing with a no-match query returns focus to the editor', async ({ page }) => {
  await openSearchDraft(page)

  await page.getByTestId('editor-host').click()

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('zebra')
  await expect(page.getByTestId('search-count')).toHaveText('No matches')
  await page.getByTestId('search-close-button').click()

  await expect(page.getByTestId('editor-search-bar')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest('[data-testid="editor-host"]')),
      ),
    )
    .toBe(true)
})

test('Enter navigates to the next match but a composing Enter is left to the IME', async ({
  page,
}) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('apple')
  await expect(page.getByTestId('search-count')).toHaveText('1/3')

  await page.getByTestId('search-input').press('Enter')
  await expect(page.getByTestId('search-count')).toHaveText('2/3')

  // An Enter that is part of an IME composition must not be default-prevented
  // (the input method owns it) and must not navigate.
  const defaultPrevented = await page.evaluate(() => {
    const input = document.querySelector('[data-testid="search-input"]')!
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    })
    input.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(defaultPrevented).toBe(false)
  await expect(page.getByTestId('search-count')).toHaveText('2/3')
})

test('expands the replace row in place and hands focus back on collapse', async ({ page }) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await expect(page.getByTestId('search-replace-row')).toHaveCount(0)

  const toggle = page.getByTestId('search-replace-toggle')
  await toggle.click()
  await expect(page.getByTestId('search-replace-row')).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('search-replace-input')).toBeFocused()

  // The 44px touch floor holds for the ACTUAL interactive boxes: the
  // buttons in both dimensions (short labels like "Aa"/"All" fall under
  // 44 wide on padding alone), and the input stretched across its pill
  // (centered it would be one 19px text line, so taps in the field's
  // padding would not focus it).
  for (const id of [
    'search-case-toggle',
    'search-replace-one-button',
    'search-replace-all-button',
  ]) {
    const box = (await page.getByTestId(id).boundingBox())!
    expect(box.width, `${id} width`).toBeGreaterThanOrEqual(44)
    expect(box.height, `${id} height`).toBeGreaterThanOrEqual(44)
  }
  const inputBox = (await page.getByTestId('search-replace-input').boundingBox())!
  expect(inputBox.height, 'replace input height').toBeGreaterThanOrEqual(40)

  await toggle.click()
  await expect(page.getByTestId('search-replace-row')).toHaveCount(0)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('search-input')).toBeFocused()
})

test('replaces the active match, advances, and Enter repeats it', async ({ page }) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('apple')
  await expect(page.getByTestId('search-count')).toHaveText('1/3')

  await page.getByTestId('search-replace-toggle').click()
  const replaceInput = page.getByTestId('search-replace-input')
  await replaceInput.fill('pear')

  await page.getByTestId('search-replace-one-button').click()
  await expect(page.getByTestId('search-count')).toHaveText('1/2')
  await expect(page.getByTestId('editor-host')).toContainText('pear banana apple cherry')

  // Enter inside the replace input replaces the now-active match.
  await replaceInput.press('Enter')
  await expect(page.getByTestId('search-count')).toHaveText('1/1')
  await expect(page.getByTestId('editor-host')).toContainText('pear banana pear cherry')
})

test('replaces all matches and reports the consumed total in the count slot', async ({
  page,
}) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('apple')
  await expect(page.getByTestId('search-count')).toHaveText('1/3')

  await page.getByTestId('search-replace-toggle').click()
  await page.getByTestId('search-replace-input').fill('pear')
  await page.getByTestId('search-replace-all-button').click()

  await expect(page.getByTestId('search-count')).toHaveText('Replaced 3')
  await expect(page.locator('span.mu-highlight')).toHaveCount(0)
  await expect(page.getByTestId('editor-host')).not.toContainText('apple')
  await expect(page.getByTestId('editor-host')).toContainText('pear in a list')
  await expect(page.getByTestId('search-replace-one-button')).toBeDisabled()
  await expect(page.getByTestId('search-replace-all-button')).toBeDisabled()

  // The notice yields to live match feedback on the next query.
  await page.getByTestId('search-input').fill('pear')
  await expect(page.getByTestId('search-count')).toHaveText('1/3')
})

test('deselects after the last original match when the replacement contains the query', async ({
  page,
}) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('apple')
  await expect(page.getByTestId('search-count')).toHaveText('1/3')

  await page.getByTestId('search-replace-toggle').click()
  await page.getByTestId('search-replace-input').fill('pineapple')
  const replaceOne = page.getByTestId('search-replace-one-button')

  // "pineapple" contains "apple", so the total holds at 3 while the active
  // match keeps stepping past each fresh insertion.
  await replaceOne.click()
  await expect(page.getByTestId('search-count')).toHaveText('2/3')
  await replaceOne.click()
  await expect(page.getByTestId('search-count')).toHaveText('3/3')

  // Consuming the last original deselects: nothing left to auto-target,
  // the single-replace action disables, and the document never compounds.
  await replaceOne.click()
  await expect(page.getByTestId('search-count')).toHaveText('0/3')
  await expect(replaceOne).toBeDisabled()
  await expect(page.getByTestId('search-replace-all-button')).toBeEnabled()
  await expect(page.getByTestId('editor-host')).toContainText(
    'pineapple banana pineapple cherry',
  )
  await expect(page.getByTestId('editor-host')).not.toContainText('pinepineapple')

  // The arrows deliberately navigate back into the surviving matches and
  // re-arm the single replace.
  await page.getByTestId('search-next-button').click()
  await expect(page.getByTestId('search-count')).toHaveText('1/3')
  await expect(replaceOne).toBeEnabled()
})

test('the case toggle re-runs the query with matching sensitivity', async ({ page }) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  await page.getByTestId('search-input').fill('Apple')
  await expect(page.getByTestId('search-count')).toHaveText('1/3')

  await page.getByTestId('search-replace-toggle').click()
  const caseToggle = page.getByTestId('search-case-toggle')
  await expect(caseToggle).toHaveAttribute('aria-pressed', 'false')

  await caseToggle.click()
  await expect(caseToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('search-count')).toHaveText('No matches')
  await expect(page.getByTestId('search-replace-one-button')).toBeDisabled()

  await caseToggle.click()
  await expect(page.getByTestId('search-count')).toHaveText('1/3')
})

test('search matches update after the query changes', async ({ page }) => {
  await openSearchDraft(page)

  await page.getByTestId('search-open-button').click()
  const input = page.getByTestId('search-input')

  await input.fill('banana')
  await expect(page.getByTestId('search-count')).toHaveText('1/1')

  await input.fill('cherry')
  await expect(page.getByTestId('search-count')).toHaveText('1/1')
  await expect(page.locator('span.mu-selection')).toHaveCount(0)

  await input.fill('')
  await expect(page.getByTestId('search-count')).toHaveCount(0)
  await expect(page.locator('span.mu-highlight')).toHaveCount(0)
})
