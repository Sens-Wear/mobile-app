import React from 'react'
import renderer from 'react-test-renderer'

import { BleReconnectOverlay } from '../BleReconnectOverlay'

describe('BleReconnectOverlay', () => {
  it('stays hidden while the BLE session is healthy', () => {
    const tree = renderer.create(<BleReconnectOverlay visible={false} />).toJSON()

    expect(tree).toBeNull()
  })

  it('explains that reconnection continues in the background', () => {
    const tree = renderer.create(<BleReconnectOverlay visible />).root

    expect(tree.findByProps({ children: 'Reconnecting to device' })).toBeTruthy()
    expect(
      tree.findByProps({
        children:
          'The Bluetooth connection was interrupted. SensWear will keep retrying in the background.',
      })
    ).toBeTruthy()
  })
})
