import {
  TOUCH_POSITION_MAX,
  TouchGesture,
  type RawTouchSample,
  type TouchState,
} from 'senswear'

export { TOUCH_POSITION_MAX } from 'senswear'

export function touchPositionFromSample(sample: TouchState | RawTouchSample): number | null {
  return sample.positionNormalized === null ? null : sample.x
}

export function touchPositionPercent(position: number): number {
  return Math.max(0, Math.min(1, position / TOUCH_POSITION_MAX))
}

export function touchGestureLabel(gesture: number): string {
  switch (gesture) {
    case TouchGesture.SingleClick: return 'Single tap'
    case TouchGesture.DoubleClick: return 'Double tap'
    case TouchGesture.ClickAndHold: return 'Hold'
    case TouchGesture.LeftSwipe: return 'Swipe to connector'
    case TouchGesture.RightSwipe: return 'Swipe to tip'
    case TouchGesture.LeftSwipeAndHold: return 'Swipe to connector + hold'
    case TouchGesture.RightSwipeAndHold: return 'Swipe to tip + hold'
    case TouchGesture.None: return 'No gesture yet'
    default: return `Unsupported gesture (${gesture})`
  }
}
