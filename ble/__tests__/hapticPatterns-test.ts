import { HapticPattern } from 'senswear'

import {
  HAPTIC_PREVIEW_FRAME_MS,
  buildHapticPattern,
} from '../hapticPatterns'

describe('current haptic SDK patterns', () => {
  it('compacts a pulse into one frame for haptic.vibrate', () => {
    const pattern = buildHapticPattern([1, 1], 0.75)

    expect(pattern?.frames).toHaveLength(1)
    expect(pattern?.frames[0]).toMatchObject({
      durationMs: HAPTIC_PREVIEW_FRAME_MS * 2,
      intensity: 191,
    })
  })

  it('encodes an eight-frame RTP pattern that requires the negotiated MTU', () => {
    const pattern = buildHapticPattern(
      [0.12, 0.2, 0.32, 0.46, 0.58, 0.72, 0.86, 1],
      1
    )

    expect(pattern?.frames).toHaveLength(8)
    expect(pattern?.toBytes()).toHaveLength(28)
    expect(HapticPattern.fromBytes(pattern!.toBytes()).totalDurationMs).toBe(640)
  })

  it('preserves silent pauses while compacting adjacent sequence frames', () => {
    const pattern = buildHapticPattern([0.7, 0.7, 0, 0, 1, 1, 0.4, 0], 1)

    expect(pattern?.frames.map((frame) => [frame.durationMs, frame.intensity])).toEqual([
      [160, 179],
      [160, 0],
      [160, 255],
      [80, 102],
      [80, 0],
    ])
  })
})
