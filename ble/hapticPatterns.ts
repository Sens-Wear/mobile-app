import {
  HAPTIC_MAX_FRAMES,
  HapticFrame,
  HapticPattern,
} from 'senswear'

export const HAPTIC_PREVIEW_FRAME_MS = 80

export function buildHapticPattern(
  amplitudes: readonly number[],
  intensityScale: number
): HapticPattern | null {
  if (amplitudes.length === 0) return null

  const frames: HapticFrame[] = []
  for (const amplitude of amplitudes) {
    const intensity = Math.max(
      0,
      Math.min(255, Math.round(amplitude * intensityScale * 255))
    )
    const previous = frames[frames.length - 1]
    if (
      previous?.intensity === intensity &&
      previous.durationMs <= 0xffff - HAPTIC_PREVIEW_FRAME_MS
    ) {
      frames[frames.length - 1] = new HapticFrame(
        previous.durationMs + HAPTIC_PREVIEW_FRAME_MS,
        intensity
      )
    } else {
      frames.push(new HapticFrame(HAPTIC_PREVIEW_FRAME_MS, intensity))
    }
  }

  if (frames.length > HAPTIC_MAX_FRAMES) {
    throw new RangeError(`Haptic pattern exceeds the ${HAPTIC_MAX_FRAMES}-frame limit.`)
  }
  return new HapticPattern(frames)
}
