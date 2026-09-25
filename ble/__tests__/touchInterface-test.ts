import {
  TOUCH_CONFIG_SERVICE_UUID,
  TOUCH_GESTURE_UUID,
  TOUCH_RAW_DATA_UUID,
  TOUCH_SAMPLING_ENABLE_UUID,
  TOUCH_SERVICE_UUID,
  TOUCH_STATE_UUID,
  serviceUuidForCharacteristic,
  TouchState,
  RawTouchSample,
} from 'senswear'
import {
  TOUCH_POSITION_MAX,
  touchPositionFromSample,
  touchPositionPercent,
} from '../touchAxis'

describe('published SDK touch BLE interface', () => {
  it('matches the firmware touch service UUIDs', () => {
    expect(TOUCH_SERVICE_UUID).toBe('33a5eb3f-0e13-424f-8b7a-942be0ee5cfc')
    expect(TOUCH_STATE_UUID).toBe('33a5eb42-0e13-424f-8b7a-942be0ee5cfc')
    expect(TOUCH_GESTURE_UUID).toBe('33a5eb43-0e13-424f-8b7a-942be0ee5cfc')
    expect(TOUCH_RAW_DATA_UUID).toBe('33a5eb44-0e13-424f-8b7a-942be0ee5cfc')
    expect(TOUCH_CONFIG_SERVICE_UUID).toBe('33a5eb50-0e13-424f-8b7a-942be0ee5cfc')
    expect(TOUCH_SAMPLING_ENABLE_UUID).toBe('33a5eb51-0e13-424f-8b7a-942be0ee5cfc')
  })

  it('routes touch characteristics through the correct services', () => {
    expect(serviceUuidForCharacteristic(TOUCH_STATE_UUID)).toBe(TOUCH_SERVICE_UUID)
    expect(serviceUuidForCharacteristic(TOUCH_GESTURE_UUID)).toBe(TOUCH_SERVICE_UUID)
    expect(serviceUuidForCharacteristic(TOUCH_RAW_DATA_UUID)).toBe(TOUCH_SERVICE_UUID)
    expect(serviceUuidForCharacteristic(TOUCH_SAMPLING_ENABLE_UUID)).toBe(
      TOUCH_CONFIG_SERVICE_UUID
    )
  })

  it('presents only the physical one-dimensional touch axis', () => {
    expect(TOUCH_POSITION_MAX).toBe(896)
    expect(touchPositionFromSample(new TouchState(0n, true, 448, 0))).toBe(448)
    expect(touchPositionFromSample(new TouchState(0n, false, 448, 0))).toBeNull()
    expect(touchPositionFromSample(new TouchState(0n, true, 5000, 0))).toBeNull()
    expect(touchPositionFromSample(new TouchState(0n, true, 448, 128))).toBeNull()
    expect(touchPositionFromSample(new RawTouchSample(0n, true, 896, 0, 0))).toBe(896)
    expect(touchPositionPercent(TOUCH_POSITION_MAX)).toBe(1)
  })
})
