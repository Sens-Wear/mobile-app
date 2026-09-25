import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { DeviceCapabilities, type SenswearClient } from 'senswear'
import { useDeviceMetadata } from '../useDeviceMetadata'

type Metadata = ReturnType<typeof useDeviceMetadata>
const capabilities = new DeviceCapabilities(1, 8, 35)
function makeClient() {
  return { deviceInfo: {
    readFirmwareVersion: jest.fn().mockResolvedValue('2.3.4'),
    readCapabilities: jest.fn().mockResolvedValue(capabilities),
  } }
}
type FakeClient = ReturnType<typeof makeClient>

describe('connection metadata', () => {
  let metadata: Metadata
  let tree: ReactTestRenderer
  function Harness({ client, connected = true }: { client: FakeClient | null; connected?: boolean }) {
    metadata = useDeviceMetadata(client as unknown as SenswearClient, connected)
    return null
  }
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    act(() => tree?.unmount())
    jest.useRealTimers()
  })

  it('loads both values and clears them immediately on disconnect', async () => {
    const client = makeClient()
    await act(async () => { tree = create(<Harness client={client} />) })
    expect(metadata.firmwareVersion).toBe('2.3.4')
    expect(metadata.capabilities).toBe(capabilities)
    expect(metadata.isLoadingDeviceInfo).toBe(false)
    act(() => tree.update(<Harness client={client} connected={false} />))
    expect(metadata.firmwareVersion).toBeNull()
    expect(metadata.capabilities).toBeNull()
  })

  it('keeps a successful version read when older firmware lacks capabilities, and retries', async () => {
    const client = makeClient()
    client.deviceInfo.readCapabilities.mockRejectedValueOnce(new Error('Characteristic not found'))
    await act(async () => { tree = create(<Harness client={client} />) })
    expect(metadata.firmwareVersion).toBe('2.3.4')
    expect(metadata.capabilities).toBeNull()
    expect(metadata.deviceInfoError).not.toBeNull()
    await act(async () => metadata.refreshDeviceInfo())
    expect(metadata.capabilities).toBe(capabilities)
    expect(metadata.deviceInfoError).toBeNull()
  })

  it('discards late replies from a previous device', async () => {
    let resolveVersion!: (value: string) => void
    const first = makeClient()
    first.deviceInfo.readFirmwareVersion.mockReturnValue(new Promise<string>((resolve) => { resolveVersion = resolve }))
    await act(async () => { tree = create(<Harness client={first} />) })
    const second = makeClient()
    await act(async () => tree.update(<Harness client={second} />))
    await act(async () => resolveVersion('stale-version'))
    expect(metadata.firmwareVersion).toBe('2.3.4')
  })

  it('bounds a missing response without inventing capabilities', async () => {
    const client = makeClient()
    client.deviceInfo.readCapabilities.mockReturnValue(new Promise(() => {}))
    await act(async () => { tree = create(<Harness client={client} />) })
    act(() => jest.advanceTimersByTime(10_000))
    expect(metadata.isLoadingDeviceInfo).toBe(false)
    expect(metadata.capabilities).toBeNull()
    expect(metadata.firmwareVersion).toBe('2.3.4')
    expect(metadata.deviceInfoError?.message).toContain('timed out')
  })
})
