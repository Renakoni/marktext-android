/**
 * Every shipped custom theme, in picker order (light themes first, then
 * dark, each group alphabetical). Single source of truth: the appearance
 * settings derive the valid custom-theme ids from this list, the theme
 * runtime derives the palette registry and the dark set, and the settings
 * picker derives its options — adding a theme means one palette file in
 * src/styles/themes/ plus one entry here.
 *
 * Labels are the themes' product names (Ayu Light, One Dark…), not
 * translatable copy, so the picker shows them verbatim in every locale.
 * Swatches preview a palette in the picker: paper, accent, a heading hue,
 * and ink, in that order.
 */

export type ThemeAppearance = 'light' | 'dark'

export interface ThemeCatalogEntry {
  readonly id: string
  readonly label: string
  readonly appearance: ThemeAppearance
  readonly swatches: readonly [string, string, string, string]
}

export const THEME_CATALOG = [
  {
    id: 'ayu-light',
    label: 'Ayu Light',
    appearance: 'light',
    swatches: ['#fafafa', '#399ee6', '#fa8d3e', '#454c54'],
  },
  {
    id: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    appearance: 'light',
    swatches: ['#eff1f5', '#1e66f5', '#d20f39', '#4c4f69'],
  },
  {
    id: 'classic-light',
    label: 'Classic Light',
    appearance: 'light',
    swatches: ['#ffffff', '#21b56f', '#333333', '#4d4d4d'],
  },
  {
    id: 'everforest-light',
    label: 'Everforest Light',
    appearance: 'light',
    swatches: ['#fdf6e3', '#8da101', '#f85552', '#5c6a72'],
  },
  {
    id: 'gruvbox-light',
    label: 'Gruvbox Light',
    appearance: 'light',
    swatches: ['#fbf1c7', '#458588', '#cc241d', '#3c3836'],
  },
  {
    id: 'rose-pine-dawn',
    label: 'Rosé Pine Dawn',
    appearance: 'light',
    swatches: ['#faf4ed', '#907aa9', '#d7827e', '#575279'],
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    appearance: 'light',
    swatches: ['#fdf6e3', '#268bd2', '#dc322f', '#586e75'],
  },
  {
    id: 'tokyo-night-light',
    label: 'Tokyo Night Light',
    appearance: 'light',
    swatches: ['#d5d6db', '#34548a', '#965027', '#343b58'],
  },
  {
    id: 'ulysses',
    label: 'Ulysses',
    appearance: 'light',
    swatches: ['#f3f3f3', '#0c8bba', '#d16a3d', '#656565'],
  },
  {
    id: 'one-dark',
    label: 'One Dark',
    appearance: 'dark',
    swatches: ['#282c34', '#4d78cc', '#e06c75', '#b9c1cc'],
  },
] as const satisfies readonly ThemeCatalogEntry[]

export type CustomThemeId = (typeof THEME_CATALOG)[number]['id']

export const CUSTOM_THEME_IDS = THEME_CATALOG.map(entry => entry.id) as readonly CustomThemeId[]

export const DARK_CUSTOM_THEME_IDS = THEME_CATALOG.filter(
  entry => entry.appearance === 'dark',
).map(entry => entry.id) as readonly CustomThemeId[]
