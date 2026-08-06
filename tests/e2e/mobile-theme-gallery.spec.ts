import { expect, test } from '@playwright/test'
import { THEME_CATALOG } from '../../src/features/settings/themeCatalog'
import { openLocalDraft } from './helpers/drafts'

test.describe.configure({ timeout: 60000 })

// One rich document exercising every themed surface: headings, emphasis,
// lists, tasks, quote, code, table, divider, link.
const GALLERY_MARKDOWN = [
  '# Kyoto, day three',
  '',
  'Rain held off until dusk. I spent the **morning** in a *paper shop* off',
  'Teramachi, then walked the [Philosopher’s Path](https://example.com) until the light turned amber.',
  '',
  '> Simplicity is the ultimate sophistication.',
  '',
  '## Before the train',
  '',
  '- [x] Charge the camera',
  '- [ ] Tickets to Nara',
  '- Buy `sencha` for home',
  '',
  '```js',
  'const stops = ["Gion", "Arashiyama"];',
  'export function nextStop(index) {',
  '  return stops[index % stops.length]; // wraps around',
  '}',
  '```',
  '',
  '| Stop | Line | Minutes |',
  '| ---- | ---- | ------- |',
  '| Gion | Keihan | 12 |',
  '| Nara | Kintetsu | 45 |',
  '',
  '---',
  '',
  'The lanterns came on one street at a time.',
].join('\n')

for (const entry of THEME_CATALOG) {
  test(`renders the ${entry.label} theme palette`, async ({ page }) => {
    await openLocalDraft(page, {
      id: `gallery-${entry.id}`,
      markdown: GALLERY_MARKDOWN,
      title: /Kyoto, day three/,
      settings: { themeMode: 'custom', customTheme: entry.id },
    })

    // The runtime stamped the palette and the palette actually resolved:
    // the editor surface shows the catalog's paper color.
    await expect(page.locator('html')).toHaveAttribute('data-theme', entry.id)
    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
    )
    expect(surface).toBe(entry.swatches[0])
    await expect(page.getByTestId('editor-host')).toContainText('lanterns')

    await page.screenshot({
      path: `test-results/theme-gallery/${entry.id}.png`,
      fullPage: false,
    })
  })
}

test('lists every catalog theme in the picker with swatches and group headings', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByTestId('bottom-nav-settings').click()
  await page.getByTestId('settings-entry-appearance').click()
  await page.getByTestId('settings-appearance-theme-mode-option-custom').click()
  await page.getByTestId('settings-appearance-custom-theme-trigger').click()

  for (const entry of THEME_CATALOG) {
    const option = page.getByTestId(
      `settings-appearance-custom-theme-option-${entry.id.replace(/[^a-z0-9]+/gi, '-')}`,
    )
    await expect(option).toContainText(entry.label)
    await expect(option.locator('.settings-select-swatch').first()).toBeVisible()
  }

  const headings = page.locator('.settings-select-group-heading')
  await expect(headings).toHaveCount(2)

  await page.screenshot({ path: 'test-results/theme-gallery/picker.png' })
})

test('the whole picker row is the hit target, not just its swatches and label', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByTestId('bottom-nav-settings').click()
  await page.getByTestId('settings-entry-appearance').click()
  await page.getByTestId('settings-appearance-theme-mode-option-custom').click()
  await page.getByTestId('settings-appearance-custom-theme-trigger').click()

  // Every option row stretches to the panel width — the auto grid track
  // used to shrink rows to their content, leaving the space right of the
  // radio dead to taps.
  const panelBox = await page.locator('.settings-select-panel').boundingBox()
  const option = page.getByTestId('settings-appearance-custom-theme-option-nord')
  const optionBox = await option.boundingBox()
  expect(optionBox!.width).toBeGreaterThan(panelBox!.width - 24)

  // Selecting by tapping the far RIGHT edge of the row (formerly dead
  // space) works.
  await option.click({ position: { x: optionBox!.width - 8, y: optionBox!.height / 2 } })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord')
})
