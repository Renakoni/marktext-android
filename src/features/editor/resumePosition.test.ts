import { describe, expect, it } from 'vitest'
import { computeResumeAnchor, computeResumeScrollTop } from './resumePosition'

// Rects as a scrolled viewport would report them: viewportTop is the scroll
// container's own top edge in the same coordinate space.
const BLOCKS = [
  { top: -500, height: 200 }, // spans -500..-300
  { top: -280, height: 400 }, // spans -280..120 (20px margin gap before it)
  { top: 140, height: 100 }, // spans 140..240
]

describe('computeResumeAnchor', () => {
  it('returns null for an empty document', () => {
    expect(computeResumeAnchor(0, [])).toBeNull()
  })

  it('resolves the block under the viewport top with an in-block ratio', () => {
    const anchor = computeResumeAnchor(0, BLOCKS)
    expect(anchor).toEqual({ index: 1, ratio: 0.7 })
  })

  it('resolves a margin gap to the next block at ratio 0', () => {
    // -290 sits between block 0 (ends -300) and block 1 (starts -280).
    expect(computeResumeAnchor(-290, BLOCKS)).toEqual({ index: 1, ratio: 0 })
  })

  it('resolves a viewport above the first block to index 0, ratio 0', () => {
    expect(computeResumeAnchor(-600, BLOCKS)).toEqual({ index: 0, ratio: 0 })
  })

  it('resolves a viewport past the last block to the last block at ratio 1', () => {
    expect(computeResumeAnchor(500, BLOCKS)).toEqual({ index: 2, ratio: 1 })
  })

  it('treats a zero-height block as ratio 0', () => {
    expect(computeResumeAnchor(10, [{ top: 0, height: 0 }, { top: 10, height: 50 }])).toEqual({
      index: 1,
      ratio: 0,
    })
  })
})

describe('computeResumeScrollTop', () => {
  it('places the viewport top at the saved ratio inside the block', () => {
    // Container top at 100, block currently rendered at 400 with height 200,
    // current scrollTop 50: ratio 0.25 targets y=450 → scrollTop 50+350.
    expect(
      computeResumeScrollTop({
        scrollTop: 50,
        containerTop: 100,
        blockTop: 400,
        blockHeight: 200,
        ratio: 0.25,
      }),
    ).toBe(400)
  })

  it('clamps the ratio and never returns a negative offset', () => {
    expect(
      computeResumeScrollTop({
        scrollTop: 0,
        containerTop: 0,
        blockTop: -30,
        blockHeight: 10,
        ratio: -2,
      }),
    ).toBe(0)
  })

  it('is the inverse of computeResumeAnchor for an unchanged layout', () => {
    // A capture at scrollTop 380 with the container top at 0: block rects in
    // viewport coordinates are documentTop - scrollTop.
    const layout = [
      { documentTop: 0, height: 300 },
      { documentTop: 320, height: 500 },
      { documentTop: 840, height: 200 },
    ]
    const scrollTop = 380
    const rects = layout.map(block => ({ top: block.documentTop - scrollTop, height: block.height }))
    const anchor = computeResumeAnchor(0, rects)
    expect(anchor).not.toBeNull()

    // Restore in a fresh session (scrollTop 0, same layout).
    const freshRect = layout[anchor!.index]
    const restored = computeResumeScrollTop({
      scrollTop: 0,
      containerTop: 0,
      blockTop: freshRect.documentTop,
      blockHeight: freshRect.height,
      ratio: anchor!.ratio,
    })
    expect(restored).toBeCloseTo(scrollTop, 6)
  })
})
