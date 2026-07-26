import {
  TOUCH_CONFIG_SERVICE_UUID,
  TOUCH_GESTURE_UUID,
  TOUCH_RAW_DATA_UUID,
  TOUCH_SAMPLING_ENABLE_UUID,
  TOUCH_SERVICE_UUID,
  TOUCH_STATE_UUID,
  serviceUuidForCharacteristic,
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
    expect(touchPositionFromSample({ touched: true, x: 2048 })).toBe(2048)
    expect(touchPositionFromSample({ touched: false, x: 2048 })).toBeNull()
    expect(touchPositionFromSample({ touched: true, x: 5000 })).toBe(TOUCH_POSITION_MAX)
    expect(touchPositionPercent(TOUCH_POSITION_MAX)).toBe(1)
  })
})
