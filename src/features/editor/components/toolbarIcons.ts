/**
 * The bottom toolbar's icon vocabulary: hand-drawn 24x24 stroke paths in the
 * app's established icon language (stroke: currentColor, width 1.8, round
 * caps/joins — the same system as the top bar, sheets, and the floating
 * selection toolbar). No icon dependency: every glyph is an original path,
 * so license, bundle size, and visual consistency stay under our control.
 *
 * Dots are zero-length segments — a round line cap renders them as circles
 * at stroke width, keeping the whole set on one stroke pipeline.
 */
export const TOOLBAR_ICON_PATHS = {
  undo: ['M8.5 5 4 9.5 8.5 14', 'M4 9.5h9a5.75 5.75 0 0 1 0 11.5H9'],
  redo: ['M15.5 5 20 9.5 15.5 14', 'M20 9.5h-9a5.75 5.75 0 0 0 0 11.5H15'],
  link: [
    'M10.2 13.8a4.1 4.1 0 0 0 5.8 0l2.8-2.8a4.1 4.1 0 1 0-5.8-5.8L11.6 6.6',
    'M13.8 10.2a4.1 4.1 0 0 0-5.8 0l-2.8 2.8a4.1 4.1 0 1 0 5.8 5.8l1.4-1.4',
  ],
  image: [
    'M4.5 6.8A2.3 2.3 0 0 1 6.8 4.5h10.4a2.3 2.3 0 0 1 2.3 2.3v10.4a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3z',
    'M9 9.5h0.01',
    'M4.8 17.5 10 12.3l3.1 3.1 2.4-2.4 3.9 3.9',
  ],
  table: [
    'M4.5 6.8A2.3 2.3 0 0 1 6.8 4.5h10.4a2.3 2.3 0 0 1 2.3 2.3v10.4a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3z',
    'M4.5 10h15',
    'M10.5 4.5v15',
  ],
  'horizontal-rule': ['M4.5 12h15', 'M7.5 6.5h9', 'M7.5 17.5h9'],
  quote: [
    'M9.7 7.5c-2.3.5-3.7 2.1-3.7 4.6v4.4h4.7v-4.7H7.9c0-1.6.8-2.6 2.3-3.1z',
    'M18.3 7.5c-2.3.5-3.7 2.1-3.7 4.6v4.4h4.7v-4.7h-2.8c0-1.6.8-2.6 2.3-3.1z',
  ],
  'bullet-list': [
    'M5 6.5h0.01',
    'M10 6.5h9.5',
    'M5 12h0.01',
    'M10 12h9.5',
    'M5 17.5h0.01',
    'M10 17.5h9.5',
  ],
  'ordered-list': [
    'M4.4 5.7l1.6-1v4.5',
    'M10.5 7h9',
    'M4.3 13.6c.1-.9.9-1.5 1.8-1.4.9.1 1.5.9 1.2 1.7-.3.9-1.4 1.5-3 3.1h3.2',
    'M10.5 15h9',
  ],
  'task-list': [
    'M4.5 6.2a1.2 1.2 0 0 1 1.2-1.2h3.1A1.2 1.2 0 0 1 10 6.2v3.1a1.2 1.2 0 0 1-1.2 1.2H5.7a1.2 1.2 0 0 1-1.2-1.2z',
    'M6 7.8l1.2 1.2 1.9-2.3',
    'M13 7.8h6.5',
    'M4.5 14.7a1.2 1.2 0 0 1 1.2-1.2h3.1a1.2 1.2 0 0 1 1.2 1.2v3.1a1.2 1.2 0 0 1-1.2 1.2H5.7a1.2 1.2 0 0 1-1.2-1.2z',
    'M13 16.3h6.5',
  ],
  'inline-code': ['M9 8.5 5.5 12 9 15.5', 'M15 8.5 18.5 12 15 15.5'],
  'code-block': [
    'M4.5 6.8A2.3 2.3 0 0 1 6.8 4.5h10.4a2.3 2.3 0 0 1 2.3 2.3v10.4a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3z',
    'M8 9.5l2.6 2.5L8 14.5',
    'M12.8 14.5H16',
  ],
  'html-block': ['M7.5 9 4.5 12l3 3', 'M16.5 9l3 3-3 3', 'M13.4 6.5l-2.8 11'],
  'front-matter': [
    'M5.5 6.3A1.8 1.8 0 0 1 7.3 4.5h9.4a1.8 1.8 0 0 1 1.8 1.8v11.4a1.8 1.8 0 0 1-1.8 1.8H7.3a1.8 1.8 0 0 1-1.8-1.8z',
    'M5.5 9.8h13',
    'M8.5 7.2h4',
    'M8.5 13h7',
    'M8.5 16h5',
  ],
  highlight: [
    'M10.2 15.8 6.5 12l7.8-7.8a1.9 1.9 0 0 1 2.7 0l1 1a1.9 1.9 0 0 1 0 2.7z',
    'M6.5 12l-1.6 3.5 2 2 3.3-1.7',
    'M4 19.5h9',
  ],
  'clear-format': [
    'M13.6 5.2 19 10.6a1.5 1.5 0 0 1 0 2.1l-6 6H9.2l-4.4-4.4a1.5 1.5 0 0 1 0-2.1z',
    'M8 9.5l6.7 6.7',
    'M13 18.7h7',
  ],
  'line-spacing': [
    'M6.2 5.5v13',
    'M3.8 8 6.2 5.5 8.6 8',
    'M3.8 16l2.4 2.5L8.6 16',
    'M12 6.5h7.5',
    'M12 12h7.5',
    'M12 17.5h7.5',
  ],
} as const

export type ToolbarIconName = keyof typeof TOOLBAR_ICON_PATHS
