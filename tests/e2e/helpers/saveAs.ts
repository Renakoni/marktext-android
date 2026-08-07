import { expect, type Page } from '@playwright/test'

/**
 * Save-as opens a full-screen destination page first (#198); picking
 * "This phone" routes to the existing SAF create path. The page overlays
 * the still-mounted editor, so the locator scopes to the overlay.
 */
export async function chooseThisPhoneSaveDestination(page: Page) {
  await expect(page.getByRole('heading', { name: 'Save as', exact: true })).toBeVisible()
  await page.locator('.save-flow-screen').getByRole('button', { name: /This phone/ }).click()
}
