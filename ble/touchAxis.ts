export const TOUCH_POSITION_MAX = 4095

type TouchPositionSample = {
  touched: boolean
  x: number
}

export function touchPositionFromSample(sample: TouchPositionSample): number | null {
  if (!sample.touched) return null
  return Math.max(0, Math.min(TOUCH_POSITION_MAX, sample.x))
}

export function touchPositionPercent(position: number): number {
  return Math.max(0, Math.min(1, position / TOUCH_POSITION_MAX))
}
