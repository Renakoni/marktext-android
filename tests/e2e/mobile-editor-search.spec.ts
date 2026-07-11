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
