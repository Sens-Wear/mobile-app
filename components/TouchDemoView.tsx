import React from 'react'
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Line, Path } from 'react-native-svg'
import {
  TOUCH_ELECTRODE_COUNT,
  TOUCH_ELECTRODE_PITCH,
  TOUCH_ELECTRODE_PITCH_MM,
  TOUCH_LENGTH_MM,
  TOUCH_POSITION_MAX,
} from 'senswear'
import { touchGestureLabel } from '@/ble/touchAxis'
import type { TouchHistoryPoint, useTouchDemo } from '@/hooks/useTouchDemo'
import { CsvShareButton, CsvExportHint } from '@/components/CsvShareButton'

type Props = { demo: ReturnType<typeof useTouchDemo>; onBack: () => void }

function waveformPath(history: TouchHistoryPoint[]): string {
  let drawing = false
  return history.map((point, index) => {
    if (point.position === null) {
      drawing = false
      return ''
    }
    const x = 4 + index * 312 / Math.max(1, history.length - 1)
    const y = 132 - point.position * 120
    const instruction = `${drawing ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    drawing = true
    return instruction
  }).join(' ')
}

export function TouchDemoView({ demo, onBack }: Props) {
  const { latest, raw, sandbox } = demo
  const ratio = latest?.positionNormalized ?? null
  const activePad = ratio === null || !latest ? null : Math.round(latest.x / TOUCH_ELECTRODE_PITCH)
  const positionLabel = ratio === null || !latest ? '--' : String(latest.x)
  const lastGesture = demo.gestures[0]?.sample
  const connected = demo.status !== 'disconnected'
  const ready = demo.status === 'ready'
  const contactLabel = !connected ? 'Disconnected' : demo.status === 'connecting' ? 'Connecting'
    : demo.status === 'error' ? 'Unavailable' : !demo.samplingEnabled ? 'Paused'
      : latest?.touched ? 'Touch active' : 'Ready for touch'
  const elapsed = demo.history.length > 1
    ? Number(demo.history[demo.history.length - 1].timestampUs - demo.history[0].timestampUs) / 1e6
    : 0
  const incompatible = latest?.touched && ratio === null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient colors={['#12382D', '#326A56']} style={styles.hero}>
        <View style={styles.row}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back"
            onPress={onBack} style={styles.back}>
            <Ionicons name="chevron-back" size={20} color="#FFF9EF" />
          </TouchableOpacity>
          <Text style={styles.heroTag}>SENSWEAR / TOUCH LAB</Text>
          <CsvShareButton onPress={demo.shareCsv} sharing={demo.sharingCsv} />
        </View>
        <Text style={styles.heroTitle}>One strip.{'\n'}A world of control.</Text>
        <Text style={styles.heroCaption}>
          Slide, tap and hold the 15 electrodes. See every movement become a position or a gesture.
        </Text>
        <View style={styles.pills}>
          <Text style={styles.heroPill}>15 electrodes</Text>
          <Text style={styles.heroPill}>{TOUCH_ELECTRODE_PITCH_MM} mm pitch</Text>
          <Text style={styles.heroPill}>1D touch</Text>
        </View>
      </LinearGradient>
      <CsvExportHint />

      <View style={styles.controlCard}>
        <View style={styles.flex}>
          <Text style={styles.label}>LIVE ACQUISITION</Text>
          <Text testID="touch-status" style={styles.controlTitle}>{contactLabel}</Text>
          <Text style={styles.caption}>Sampling returns to its previous setting when you leave.</Text>
        </View>
        <Switch accessibilityLabel="Touch sampling" testID="touch-sampling"
          value={demo.samplingEnabled} disabled={!ready || demo.busy}
          onValueChange={(enabled) => { void demo.setSamplingEnabled(enabled) }}
          trackColor={{ false: '#CCC9BF', true: '#83BAA1' }} thumbColor="#FFFFFF" />
      </View>
      {!connected && <Text accessibilityRole="alert" style={styles.notice}>
        Connect to a SensWear device with a touch board to begin.
      </Text>}
      {demo.error && <View style={styles.errorCard}>
        <Text accessibilityRole="alert" style={styles.errorText}>{demo.error}</Text>
        {demo.status === 'error' && <TouchableOpacity accessibilityRole="button"
          accessibilityLabel="Retry touch connection" onPress={demo.retry} style={styles.smallButton}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>}
      </View>}

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>The physical strip</Text>
          <Text style={styles.badge}>X ONLY</Text>
        </View>
        <View style={styles.readout}>
          <View>
            <Text style={styles.label}>POSITION X</Text>
            <Text testID="touch-position" style={styles.position}>{positionLabel}<Text style={styles.unit}> / {TOUCH_POSITION_MAX}</Text></Text>
          </View>
          <View style={styles.right}>
            <Text testID="touch-distance" style={styles.distance}>{latest?.positionMm == null ? '--' : latest.positionMm.toFixed(1)} mm</Text>
            <Text style={styles.caption}>{ratio === null ? 'Touch to locate' : `${Math.round(ratio * 100)}% along the strip`}</Text>
          </View>
        </View>
        <View style={styles.electrodes} testID="touch-electrodes">
          {Array.from({ length: TOUCH_ELECTRODE_COUNT }, (_, pad) => (
            <View key={pad} testID={`touch-pad-${pad + 1}`}
              accessibilityLabel={`Electrode ${pad + 1}${activePad === pad ? ', nearest to touch' : ''}`}
              style={[styles.electrode, activePad === pad && styles.electrodeActive]}>
              <Text style={[styles.padNumber, activePad === pad && styles.padNumberActive]}>{pad + 1}</Text>
            </View>
          ))}
        </View>
        <View style={styles.track}>
          {ratio !== null && <View testID="touch-marker" style={[styles.marker, { left: `${ratio * 100}%` }]} />}
        </View>
        <View style={styles.row}>
          <Text style={styles.axisLabel}>Connector{'\n'}0 / 0 mm</Text>
          <Text style={[styles.axisLabel, styles.right]}>Tip{'\n'}{TOUCH_POSITION_MAX} / {TOUCH_LENGTH_MM} mm</Text>
        </View>
        <Text style={styles.caption}>Pad centers are {TOUCH_ELECTRODE_PITCH} X units apart. The highlighted pad is the nearest center; the marker follows the continuous position.</Text>
        {incompatible && <Text accessibilityRole="alert" style={styles.errorText}>
          This sample is outside the current 1D range. Update the device firmware to use this demo.
        </Text>}
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Try it as a controller</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reset controller demo"
            onPress={demo.resetSandbox} disabled={!ready}>
            <Text style={[styles.link, !ready && styles.disabled]}>Reset</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.caption}>Slide to set a level. Tap to switch the light. Hold to lock the level. Swipe to choose a tile; swipe and hold also locks. Double tap resets.</Text>
        <View style={styles.sandboxTiles}>
          {Array.from({ length: 5 }, (_, slot) => <View key={slot}
            testID={`sandbox-tile-${slot + 1}`}
            style={[styles.sandboxTile, sandbox.slot === slot && styles.selectedTile,
              sandbox.slot === slot && sandbox.lit && styles.litTile]}>
            <Text style={[styles.tileText, sandbox.slot === slot && styles.selectedTileText]}>{slot + 1}</Text>
          </View>)}
        </View>
        <View style={styles.row}>
          <Text testID="sandbox-state" style={styles.controlTitle}>Light {sandbox.lit ? 'on' : 'off'} · Tile {sandbox.slot + 1}</Text>
          <Text testID="sandbox-lock" style={styles.badge}>{sandbox.locked ? 'LOCKED' : 'FOLLOWING'}</Text>
        </View>
        <View style={styles.levelTrack}><View style={[styles.levelFill, { width: `${sandbox.level}%` }]} /></View>
        <Text testID="sandbox-level" style={styles.caption}>Level {sandbox.level}% · Demo controls only</Text>
        <View style={styles.gestureHighlight}>
          <Text style={styles.label}>LATEST GESTURE</Text>
          <Text testID="touch-gesture" style={styles.gestureTitle}>{touchGestureLabel(lastGesture?.gesture ?? 0)}</Text>
          <Text style={styles.caption}>Single taps arrive after the 250 ms double-tap window.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Movement trace</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear touch history"
            onPress={demo.clearHistory} disabled={!ready}>
            <Text style={[styles.link, !ready && styles.disabled]}>Clear</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.caption}>Position over recent raw frames. Gaps show no valid touch position. The raw stream contains decoded position and status, not electrode amplitudes.</Text>
        <View style={styles.waveform}>
          <View style={styles.chartLabels}><Text style={styles.axisLabel}>{TOUCH_POSITION_MAX}</Text><Text style={styles.axisLabel}>0</Text></View>
          <Svg testID="touch-waveform" viewBox="0 0 320 144" height={144} style={styles.flex}>
            {[12, 72, 132].map((y) => <Line key={y} x1="4" x2="316" y1={y} y2={y} stroke="#DFE7E0" strokeWidth="1" />)}
            <Path testID="touch-waveform-path" d={waveformPath(demo.history)} fill="none" stroke="#297455" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text testID="touch-history-count" style={styles.caption}>{demo.history.length} recent frames · {elapsed.toFixed(1)} s · {demo.samples} received</Text>
        {demo.history.length === 0 && <Text style={styles.empty}>Your movement will appear here.</Text>}
        <View style={styles.separator} />
        <Text style={styles.label}>RECENT GESTURES</Text>
        {demo.gestures.length === 0 ? <Text style={styles.empty}>Try a tap, hold or horizontal swipe.</Text>
          : demo.gestures.map(({ sample, sequence }) => <View key={sequence} style={styles.eventRow}>
            <Text style={styles.eventName}>{touchGestureLabel(sample.gesture)}</Text>
            <Text style={styles.eventTime}>{(sample.timestampUs / 1000n).toString()} ms</Text>
          </View>)}
      </View>

      <View style={styles.diagnostics}>
        <Text style={styles.label}>FRAME DIAGNOSTICS</Text>
        <Text testID="touch-diagnostics" style={styles.diagnosticText}>
          {raw ? `Firmware touched: ${raw.touched ? 'yes' : 'no'}  ·  Raw status: 0x${raw.touchState.toString(16).padStart(2, '0')}  ·  Y: ${raw.y} (reserved)` : 'Waiting for a raw frame.'}
        </Text>
        <Text style={styles.caption}>Firmware touch detection uses all 15 electrodes. A clear hardware TCH bit does not mean the strip is untouched.</Text>
        {raw && <Text style={styles.timestamp}>Last raw timestamp: {raw.timestampUs.toString()} µs</Text>}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EB' },
  content: { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 36, maxWidth: 700, width: '100%', alignSelf: 'center' },
  hero: { padding: 22, borderRadius: 26 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  right: { textAlign: 'right', alignItems: 'flex-end' },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF18', alignItems: 'center', justifyContent: 'center' },
  heroTag: { color: '#C4D9CB', fontSize: 10, letterSpacing: 1.3, fontWeight: '700' },
  heroTitle: { color: '#FFF9EF', fontSize: 35, lineHeight: 39, fontWeight: '800', marginTop: 20 },
  heroCaption: { color: '#D5E2D8', fontSize: 14, lineHeight: 21, marginTop: 13 },
  pills: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 20 },
  heroPill: { color: '#E4EFE4', backgroundColor: '#FFFFFF15', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 7, fontSize: 11, fontWeight: '600' },
  controlCard: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 16, padding: 17, backgroundColor: '#E4ECE3', borderRadius: 20 },
  label: { color: '#678070', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  controlTitle: { color: '#1D382B', fontSize: 17, fontWeight: '700', marginTop: 3 },
  caption: { color: '#617065', fontSize: 12, lineHeight: 18, marginTop: 7 },
  notice: { color: '#506557', padding: 15, lineHeight: 20, fontSize: 13 },
  errorCard: { marginTop: 12, borderRadius: 16, padding: 15, backgroundColor: '#FBE6DB' },
  errorText: { color: '#8D3D23', fontSize: 13, lineHeight: 19, marginTop: 8 },
  smallButton: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, backgroundColor: '#1B513C', borderRadius: 10 },
  buttonText: { color: '#FFF9EF', fontWeight: '700' },
  card: { marginTop: 16, padding: 18, borderRadius: 22, backgroundColor: '#FFFDF7', borderWidth: 1, borderColor: '#E4E4D8' },
  sectionTitle: { color: '#1E3A2B', fontSize: 18, fontWeight: '700', flexShrink: 1 },
  badge: { color: '#346849', backgroundColor: '#E8EFE3', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 6 },
  readout: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22, marginBottom: 22, gap: 8 },
  position: { color: '#193D2A', fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { color: '#7B897E', fontSize: 13, fontWeight: '500' },
  distance: { color: '#274F38', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  electrodes: { flexDirection: 'row', gap: 3 },
  electrode: { flex: 1, height: 52, borderRadius: 5, backgroundColor: '#E5EDDF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D3DFC9' },
  electrodeActive: { backgroundColor: '#2C7853', borderColor: '#1F5B3C' },
  padNumber: { color: '#67815A', fontSize: 8, fontWeight: '700' },
  padNumberActive: { color: '#FFFFFF' },
  track: { height: 3, backgroundColor: '#D9E4D3', marginTop: 11, marginBottom: 12, marginHorizontal: 7 },
  marker: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#C38747', marginLeft: -4.5, top: -3 },
  axisLabel: { color: '#6A776A', fontSize: 10, lineHeight: 15 },
  link: { color: '#347555', fontSize: 12, fontWeight: '700', paddingVertical: 5 },
  disabled: { opacity: 0.4 },
  sandboxTiles: { flexDirection: 'row', gap: 8, marginTop: 17, marginBottom: 14 },
  sandboxTile: { flex: 1, height: 48, borderRadius: 11, backgroundColor: '#F0F1E8', borderWidth: 2, borderColor: '#F0F1E8', justifyContent: 'center', alignItems: 'center' },
  selectedTile: { borderColor: '#32734E', backgroundColor: '#E7EEDB' },
  litTile: { backgroundColor: '#F2D17E', borderColor: '#A78228' },
  tileText: { color: '#9BA48D', fontSize: 16, fontWeight: '700' },
  selectedTileText: { color: '#315632' },
  levelTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E7ECDF', marginTop: 15 },
  levelFill: { height: '100%', backgroundColor: '#85AA66' },
  gestureHighlight: { backgroundColor: '#F2F2E8', padding: 14, borderRadius: 13, marginTop: 17 },
  gestureTitle: { color: '#31513A', fontSize: 18, fontWeight: '700', marginTop: 7 },
  waveform: { flexDirection: 'row', marginTop: 13 },
  chartLabels: { width: 30, justifyContent: 'space-between', paddingTop: 6, paddingBottom: 6 },
  empty: { color: '#84917E', fontSize: 12, paddingVertical: 12 },
  separator: { height: 1, backgroundColor: '#E9ECE1', marginVertical: 17 },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F0F1E9', paddingVertical: 11 },
  eventName: { color: '#3E6046', fontSize: 12, flex: 1 },
  eventTime: { color: '#89927C', fontSize: 9, fontVariant: ['tabular-nums'] },
  diagnostics: { padding: 18, marginTop: 5 },
  diagnosticText: { color: '#68776A', fontSize: 11, lineHeight: 19, marginTop: 9 },
  timestamp: { color: '#869280', fontSize: 10, lineHeight: 16, marginTop: 8 },
})
