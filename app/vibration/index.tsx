import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type DemoMode = 'Library' | 'RTP' | 'Sequence';

type Preset = {
  id: string;
  name: string;
  family: DemoMode;
  effectId: number | null;
  durationMs: number;
  description: string;
  amplitudes: number[];
};

const FRAME_MS = 80;

const PRESETS: Preset[] = [
  {
    id: 'strong-click',
    name: 'Strong Click',
    family: 'Library',
    effectId: 1,
    durationMs: 160,
    description: 'Short confirmation pulse with a crisp leading edge.',
    amplitudes: [0.18, 0.95, 0.52, 0.12],
  },
  {
    id: 'double-click',
    name: 'Double Click',
    family: 'Library',
    effectId: 10,
    durationMs: 260,
    description: 'Two separated impulses for call-to-action feedback.',
    amplitudes: [0.14, 0.9, 0.18, 0.1, 0.12, 0.82, 0.2],
  },
  {
    id: 'ramp-up',
    name: 'Ramp Up',
    family: 'RTP',
    effectId: null,
    durationMs: 480,
    description: 'Real-time amplitude sweep from subtle to assertive.',
    amplitudes: [0.12, 0.2, 0.32, 0.46, 0.58, 0.72, 0.86, 1],
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    family: 'Sequence',
    effectId: null,
    durationMs: 640,
    description: 'Two-beat sequence useful for alarms or guided routines.',
    amplitudes: [0.12, 0.68, 0.14, 0.08, 0.1, 0.92, 0.42, 0.14],
  },
  {
    id: 'buzz-alert',
    name: 'Buzz Alert',
    family: 'Sequence',
    effectId: null,
    durationMs: 720,
    description: 'Repeated medium pulses for attention-grabbing notifications.',
    amplitudes: [0.42, 0.52, 0.44, 0.54, 0.48, 0.56, 0.42, 0.5],
  },
];

const INTENSITY_LEVELS = [0.25, 0.5, 0.75, 1];

const MODE_COPY: Record<DemoMode, { title: string; subtitle: string }> = {
  Library: {
    title: 'Library Playback',
    subtitle: 'Show pre-baked DRV2605 effects by ID with fast event-style feedback.',
  },
  RTP: {
    title: 'Real-Time Amplitude',
    subtitle: 'Expose strength control for variable drive without changing the BLE contract yet.',
  },
  Sequence: {
    title: 'Sequence Builder',
    subtitle: 'Chain multiple effects into a richer actuator story for alerts and coaching cues.',
  },
};

export default function VibrationScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<DemoMode>('Library');
  const [selectedPresetId, setSelectedPresetId] = useState('strong-click');
  const [intensity, setIntensity] = useState(0.75);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const availablePresets = useMemo(() => PRESETS.filter((preset) => preset.family === mode), [mode]);

  const selectedPreset = useMemo(() => {
    return availablePresets.find((preset) => preset.id === selectedPresetId) ?? availablePresets[0] ?? PRESETS[0];
  }, [availablePresets, selectedPresetId]);

  const playbackFrames = useMemo(
    () => selectedPreset.amplitudes.map((value) => Math.min(1, value * intensity)),
    [intensity, selectedPreset]
  );

  const activeFrameIndex = Math.min(playbackFrames.length - 1, Math.floor(elapsedMs / FRAME_MS));

  const sequencePreview = useMemo(() => {
    return [
      PRESETS.find((preset) => preset.id === 'strong-click'),
      PRESETS.find((preset) => preset.id === 'heartbeat'),
      PRESETS.find((preset) => preset.id === 'buzz-alert'),
    ].filter(Boolean) as Preset[];
  }, []);

  useEffect(() => {
    setSelectedPresetId((current) => {
      if (availablePresets.some((preset) => preset.id === current)) {
        return current;
      }
      return availablePresets[0]?.id ?? current;
    });
    setIsPlaying(false);
    setElapsedMs(0);
  }, [availablePresets]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const totalDuration = playbackFrames.length * FRAME_MS;
    const interval = setInterval(() => {
      setElapsedMs((current) => {
        const next = current + FRAME_MS;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
    }, FRAME_MS);

    return () => clearInterval(interval);
  }, [isPlaying, playbackFrames.length]);

  const startPreview = () => {
    setElapsedMs(0);
    setIsPlaying(true);
  };

  const stopPreview = () => {
    setIsPlaying(false);
    setElapsedMs(0);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={['#153B2E', '#356B59', '#D7C1A6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={20} color="#F7F0E8" />
          </TouchableOpacity>

          <View style={styles.heroIconWrap}>
            <Ionicons name="pulse-outline" size={20} color="#153B2E" />
          </View>
        </View>

        <Text style={styles.eyebrow}>Vibration demo</Text>
        <Text style={styles.heroTitle}>{MODE_COPY[mode].title}</Text>
        <Text style={styles.heroSubtitle}>{MODE_COPY[mode].subtitle}</Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="hardware-chip-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>DRV2605 preview</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="radio-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>BLE pending</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Selected preset</Text>
          <Text style={styles.summaryValue}>{selectedPreset.name}</Text>
          <Text style={styles.summaryHint}>{selectedPreset.durationMs} ms total duration.</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Drive level</Text>
          <Text style={styles.summaryValue}>{Math.round(intensity * 100)}%</Text>
          <Text style={styles.summaryHint}>{isPlaying ? 'Preview playing' : 'Ready to preview'}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Playback controls</Text>
            <Text style={styles.sectionCaption}>Start or stop the local preview without changing any BLE wiring.</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{mode.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.modeRow}>
          {(['Library', 'RTP', 'Sequence'] as DemoMode[]).map((item) => {
            const selected = item === mode;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.modeChip, selected && styles.modeChipSelected]}
                onPress={() => setMode(item)}>
                <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={startPreview}>
            <Ionicons name="play" size={16} color="#F7F0E8" />
            <Text style={styles.primaryButtonText}>{isPlaying ? 'Restart Preview' : 'Preview Effect'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={stopPreview}>
            <Text style={styles.secondaryButtonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Effect envelope</Text>
            <Text style={styles.sectionCaption}>
              Frame-by-frame amplitude preview for the active preset and intensity.
            </Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>
              {playbackFrames.length === 0 ? '0/0' : `${activeFrameIndex + 1}/${playbackFrames.length}`}
            </Text>
          </View>
        </View>

        <View style={styles.waveCard}>
          <View style={styles.waveBars}>
            {playbackFrames.map((value, index) => {
              const highlighted = isPlaying && index <= activeFrameIndex;
              return (
                <View
                  key={`${selectedPreset.id}-${index}`}
                  style={[
                    styles.waveBar,
                    {
                      height: 24 + value * 90,
                      opacity: highlighted ? 1 : 0.45,
                      backgroundColor: highlighted ? '#153B2E' : '#AAB8AE',
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.waveDescription}>{selectedPreset.description}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Presets</Text>
            <Text style={styles.sectionCaption}>Pick a demo preset from the currently selected mode family.</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{availablePresets.length} OPTIONS</Text>
          </View>
        </View>

        <View style={styles.presetList}>
          {availablePresets.map((preset) => {
            const selected = preset.id === selectedPreset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetCard, selected && styles.presetCardSelected]}
                onPress={() => {
                  setSelectedPresetId(preset.id);
                  setElapsedMs(0);
                  setIsPlaying(false);
                }}>
                <View style={styles.presetHeaderRow}>
                  <Text style={[styles.presetName, selected && styles.presetNameSelected]}>{preset.name}</Text>
                  <Text style={[styles.presetDuration, selected && styles.presetDurationSelected]}>
                    {preset.durationMs} ms
                  </Text>
                </View>
                <Text style={[styles.presetDescription, selected && styles.presetDescriptionSelected]}>
                  {preset.effectId === null ? 'Custom envelope' : `Effect ID ${preset.effectId}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Drive level</Text>
            <Text style={styles.sectionCaption}>Adjust the preview strength applied to the active envelope.</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>INTENSITY</Text>
          </View>
        </View>

        <View style={styles.intensityRow}>
          {INTENSITY_LEVELS.map((level) => {
            const selected = level === intensity;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.intensityButton, selected && styles.intensityButtonSelected]}
                onPress={() => setIntensity(level)}>
                <Text style={[styles.intensityText, selected && styles.intensityTextSelected]}>
                  {Math.round(level * 100)}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Sequence example</Text>
            <Text style={styles.sectionCaption}>Reference chain showing how richer routines can be composed later.</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>3 STEP</Text>
          </View>
        </View>

        <View style={styles.sequenceCard}>
          {sequencePreview.map((preset, index) => (
            <View key={preset.id} style={styles.sequenceStep}>
              <Text style={styles.sequenceIndex}>{index + 1}</Text>
              <View style={styles.sequenceTextWrap}>
                <Text style={styles.sequenceName}>{preset.name}</Text>
                <Text style={styles.sequenceMeta}>{preset.durationMs} ms</Text>
              </View>
            </View>
          ))}
          <Text style={styles.sequenceFootnote}>
            This page is local-only. Once BLE is wired, the same preset model can map to DRV2605 library IDs, RTP
            values, or sequencer slots.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EFE8',
  },
  content: {
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    shadowColor: '#153B2E',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E3D2',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F6ECE0',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '800',
    color: '#FDF9F4',
    lineHeight: 34,
  },
  heroSubtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#F3E8DD',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1E3D2',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  metaPillText: {
    color: '#153B2E',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF9F2',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9DACC',
    padding: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#68736D',
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 19,
    fontWeight: '800',
    color: '#14251F',
  },
  summaryHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F6B65',
  },
  sectionCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#FFF9F2',
    borderWidth: 1,
    borderColor: '#E9DACC',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14251F',
  },
  sectionCaption: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: '#5F6B65',
    maxWidth: 240,
  },
  sectionBadge: {
    backgroundColor: '#E6F0EA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionBadgeText: {
    color: '#153B2E',
    fontSize: 12,
    fontWeight: '800',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1D5C9',
    backgroundColor: '#F7EFE6',
    alignItems: 'center',
  },
  modeChipSelected: {
    backgroundColor: '#153B2E',
    borderColor: '#153B2E',
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14251F',
  },
  modeChipTextSelected: {
    color: '#F7F0E8',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#153B2E',
    borderRadius: 999,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#F7F0E8',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8C8B9',
    backgroundColor: '#F7EFE6',
  },
  secondaryButtonText: {
    color: '#14251F',
    fontSize: 14,
    fontWeight: '700',
  },
  waveCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#F7EFE6',
  },
  waveBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 130,
  },
  waveBar: {
    flex: 1,
    borderRadius: 999,
  },
  waveDescription: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    color: '#5F6B65',
  },
  presetList: {
    gap: 12,
    marginTop: 18,
  },
  presetCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#F7EFE6',
    borderWidth: 1,
    borderColor: '#E1D5C9',
  },
  presetCardSelected: {
    backgroundColor: '#153B2E',
    borderColor: '#153B2E',
  },
  presetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presetName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#14251F',
  },
  presetNameSelected: {
    color: '#F7F0E8',
  },
  presetDuration: {
    fontSize: 13,
    color: '#5F6B65',
  },
  presetDurationSelected: {
    color: '#D8E1DB',
  },
  presetDescription: {
    marginTop: 8,
    fontSize: 14,
    color: '#5F6B65',
  },
  presetDescriptionSelected: {
    color: '#D8E1DB',
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  intensityButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F7EFE6',
    alignItems: 'center',
  },
  intensityButtonSelected: {
    backgroundColor: '#153B2E',
  },
  intensityText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#14251F',
  },
  intensityTextSelected: {
    color: '#F7F0E8',
  },
  sequenceCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#F7EFE6',
    gap: 12,
  },
  sequenceStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  sequenceIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    textAlignVertical: 'center',
    backgroundColor: '#153B2E',
    color: '#F7F0E8',
    fontWeight: '800',
    overflow: 'hidden',
  },
  sequenceTextWrap: {
    flex: 1,
  },
  sequenceName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14251F',
  },
  sequenceMeta: {
    marginTop: 2,
    fontSize: 13,
    color: '#5F6B65',
  },
  sequenceFootnote: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#5F6B65',
  },
});
