import { useCallback, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  TouchGesture,
  type RawTouchSample,
  type TouchGestureSample,
  type TouchState,
} from 'senswear'
import { useBle } from '@/hooks/BleSessionProvider'
import { useCsvExport } from '@/hooks/useCsvExport'

const CSV_COLUMNS = ['received_at_utc', 'device_timestamp_us', 'event', 'touched',
  'x_controller_units', 'y_controller_units', 'position_mm', 'gesture', 'gesture_state',
  'touch_state', 'sampling_enabled', 'result', 'error']

export const TOUCH_HISTORY_LIMIT = 180
export const TOUCH_GESTURE_LIMIT = 8
export const TOUCH_UPDATE_MS = 100

// Persist cleanup barriers across route unmount/remount as well as refocus.
// Weak keys avoid retaining disconnected clients after their session is gone.
const touchLifecycles = new WeakMap<object, Promise<void>>()

export type TouchHistoryPoint = { position: number | null; timestampUs: bigint }
export type TouchGestureEntry = { sample: TouchGestureSample; sequence: number }
export type TouchSandbox = { level: number; lit: boolean; locked: boolean; slot: number }

const initialSandbox = (): TouchSandbox => ({ level: 50, lit: false, locked: false, slot: 2 })

type Snapshot = {
  latest: TouchState | RawTouchSample | null
  raw: RawTouchSample | null
  history: TouchHistoryPoint[]
  gestures: TouchGestureEntry[]
  samples: number
  sandbox: TouchSandbox
}

const emptySnapshot = (): Snapshot => ({
  latest: null, raw: null, history: [], gestures: [], samples: 0, sandbox: initialSandbox(),
})

function applyGesture(sandbox: TouchSandbox, gesture: number): TouchSandbox {
  switch (gesture) {
    case TouchGesture.SingleClick: return { ...sandbox, lit: !sandbox.lit }
    case TouchGesture.DoubleClick: return initialSandbox()
    case TouchGesture.ClickAndHold: return { ...sandbox, locked: !sandbox.locked }
    case TouchGesture.LeftSwipe: return { ...sandbox, slot: Math.max(0, sandbox.slot - 1) }
    case TouchGesture.RightSwipe: return { ...sandbox, slot: Math.min(4, sandbox.slot + 1) }
    case TouchGesture.LeftSwipeAndHold:
      return { ...sandbox, slot: Math.max(0, sandbox.slot - 1), locked: true }
    case TouchGesture.RightSwipeAndHold:
      return { ...sandbox, slot: Math.min(4, sandbox.slot + 1), locked: true }
    default: return sandbox
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

type SessionControls = {
  sampling: (enabled: boolean) => Promise<void>
  clear: () => void
  resetSandbox: () => void
}

/** Owns the touch screen's subscriptions and restores the sampling state on blur.
 * A lifecycle barrier prevents a late setup/cleanup from touching a new focus.
 */
export function useTouchDemo() {
  const { client, isConnected } = useBle()
  const { record, share, sharing } = useCsvExport('Touch', CSV_COLUMNS)
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot)
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'ready' | 'error'>('disconnected')
  const [samplingEnabled, setSamplingEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const controls = useRef<SessionControls | null>(null)

  useFocusEffect(useCallback(() => {
    setSnapshot(emptySnapshot())
    setError(null)
    setSamplingEnabled(false)
    setBusy(false)
    if (!client || !isConnected) {
      setStatus('disconnected')
      return
    }

    let active = true
    let receiving = true
    let dirty = false
    let originalSampling: boolean | null = null
    let samplingModified = false
    let sequence = 0
    let notificationGeneration = 0
    let draft = emptySnapshot()
    let finalized: Promise<void> | null = null
    let stateAttempted = false
    let gestureAttempted = false
    let rawAttempted = false
    setStatus('connecting')

    const flush = () => {
      if (!active || !dirty) return
      dirty = false
      setSnapshot({ ...draft, history: [...draft.history], gestures: [...draft.gestures] })
    }
    const acceptState = (sample: TouchState | RawTouchSample) => {
      if (!active || !receiving) return
      draft.latest = sample
      if (sample.positionNormalized !== null && !draft.sandbox.locked) {
        draft.sandbox = { ...draft.sandbox, level: Math.round(sample.positionNormalized * 100) }
      }
      dirty = true
    }
    const finalize = () => {
      if (finalized) return finalized
      receiving = false
      finalized = (async () => {
        const results = await Promise.allSettled([
          ...(stateAttempted ? [client.touch.unsubscribeState()] : []),
          ...(gestureAttempted ? [client.touch.unsubscribeGesture()] : []),
          ...(rawAttempted ? [client.touch.unsubscribeRaw()] : []),
        ])
        const failures = results.filter((result) => result.status === 'rejected')
        if (samplingModified && originalSampling !== null) {
          try {
            await client.touch.setSamplingEnabled(originalSampling)
            if (active) setSamplingEnabled(originalSampling)
          } catch (failure) {
            failures.push({ status: 'rejected', reason: failure })
          }
        }
        if (failures.length) {
          // Cleanup can finish after blur; report it without updating an unfocused screen.
          console.warn('Touch cleanup failed', failures.map((failure) => errorMessage(failure.reason)))
        }
      })()
      return finalized
    }

    let operations = (touchLifecycles.get(client.touch) ?? Promise.resolve()).then(async () => {
      if (!active) return
      originalSampling = await client.touch.isSamplingEnabled()
      if (!active) return
      stateAttempted = true
      await client.touch.subscribeState((sample) => {
        if (!active || !receiving) return
        record({ event: 'state', device_timestamp_us: sample.timestampUs, touched: sample.touched,
          x_controller_units: sample.x, y_controller_units: sample.y, position_mm: sample.positionMm })
        notificationGeneration++
        acceptState(sample)
      })
      if (!active) return
      gestureAttempted = true
      await client.touch.subscribeGesture((sample) => {
        if (!active || !receiving) return
        record({ event: 'gesture', device_timestamp_us: sample.timestampUs,
          gesture: sample.gesture, gesture_state: sample.gestureState })
        if (sample.gesture === TouchGesture.None) return
        draft.gestures = [{ sample, sequence: ++sequence }, ...draft.gestures].slice(0, TOUCH_GESTURE_LIMIT)
        draft.sandbox = applyGesture(draft.sandbox, sample.gesture)
        dirty = true
      })
      if (!active) return
      rawAttempted = true
      await client.touch.subscribeRaw((sample) => {
        if (!active || !receiving) return
        record({ event: 'raw', device_timestamp_us: sample.timestampUs, touched: sample.touched,
          x_controller_units: sample.x, y_controller_units: sample.y, position_mm: sample.positionMm,
          touch_state: sample.touchState })
        notificationGeneration++
        acceptState(sample)
        draft.raw = sample
        const last = draft.history[draft.history.length - 1]
        // Firmware timestamps are adjustable RTC time, not a monotonic clock.
        if (last && sample.timestampUs < last.timestampUs) draft.history = []
        draft.history.push({ position: sample.positionNormalized, timestampUs: sample.timestampUs })
        if (draft.history.length > TOUCH_HISTORY_LIMIT) draft.history.shift()
        draft.samples++
        dirty = true
      })
      if (!active) return
      if (!originalSampling) {
        samplingModified = true
        record({ event: 'start_sampling', sampling_enabled: true, result: 'write_requested' })
        await client.touch.setSamplingEnabled(true)
        record({ event: 'start_sampling', sampling_enabled: true, result: 'write_succeeded' })
      }
      if (!active) return
      setSamplingEnabled(true)
      const generationBeforeRead = notificationGeneration
      const initial = await client.touch.readState()
      if (notificationGeneration === generationBeforeRead) acceptState(initial)
      if (!active) return
      setStatus('ready')
      flush()
    }).catch(async (failure: unknown) => {
      if (active) {
        setError(`Could not start touch: ${errorMessage(failure)}`)
        setStatus('error')
      }
      await finalize()
    })

    const session: SessionControls = {
      sampling: (enabled) => {
        if (!active) return Promise.resolve()
        setBusy(true)
        setError(null)
        operations = operations.then(async () => {
          if (!active || finalized) return
          samplingModified = true
          record({ event: 'set_sampling', sampling_enabled: enabled, result: 'write_requested' })
          await client.touch.setSamplingEnabled(enabled)
          record({ event: 'set_sampling', sampling_enabled: enabled, result: 'write_succeeded' })
          if (!active) return
          receiving = enabled
          setSamplingEnabled(enabled)
          if (!enabled) {
            draft.latest = null
            dirty = true
            flush()
          }
        }).catch((failure: unknown) => {
          record({ event: 'set_sampling', sampling_enabled: enabled, result: 'write_failed',
            error: errorMessage(failure) })
          if (active) setError(`Could not change sampling: ${errorMessage(failure)}`)
        }).finally(() => {
          if (active) setBusy(false)
        })
        return operations
      },
      clear: () => {
        record({ event: 'clear_display_history', result: 'local_action' })
        draft.history = []
        draft.gestures = []
        draft.samples = 0
        dirty = true
        flush()
      },
      resetSandbox: () => {
        record({ event: 'reset_controller_demo', result: 'local_action' })
        draft.sandbox = initialSandbox()
        dirty = true
        flush()
      },
    }
    controls.current = session
    const interval = setInterval(flush, TOUCH_UPDATE_MS)

    return () => {
      active = false
      clearInterval(interval)
      if (controls.current === session) controls.current = null
      const cleanup = operations.then(finalize).catch((failure: unknown) => {
        console.warn('Touch cleanup failed', errorMessage(failure))
      })
      touchLifecycles.set(client.touch, cleanup)
      void cleanup.then(() => {
        if (touchLifecycles.get(client.touch) === cleanup) touchLifecycles.delete(client.touch)
      })
    }
  // Rebuilding the focus callback is how the explicit Retry action starts a new session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isConnected, retry, record]))

  return {
    ...snapshot,
    status,
    samplingEnabled,
    busy,
    error,
    shareCsv: share,
    sharingCsv: sharing,
    setSamplingEnabled: (enabled: boolean) => controls.current?.sampling(enabled),
    clearHistory: () => controls.current?.clear(),
    resetSandbox: () => controls.current?.resetSandbox(),
    retry: () => setRetry((value) => value + 1),
  }
}
