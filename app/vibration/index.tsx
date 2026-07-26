import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { HapticPattern } from 'senswear';
import {
  HAPTIC_PREVIEW_FRAME_MS,
  buildHapticPattern,
} from '@/ble/hapticPatterns';
import { useBle } from '@/hooks/BleSessionProvider';

type DemoMode = 'Pulse' | 'Pattern';
type PatternSource = 'Preset' | 'Morse';

type Preset = {
  id: string;
  name: string;
  family: DemoMode;
  description: string;
  amplitudes: number[];
};

const MORSE_UNIT_FRAMES = 1;
const MORSE_DASH_FRAMES = MORSE_UNIT_FRAMES * 3;
const MORSE_SYMBOL_GAP_FRAMES = MORSE_UNIT_FRAMES;
const MORSE_LETTER_GAP_FRAMES = MORSE_UNIT_FRAMES * 3;
const MORSE_MAX_WORD_LENGTH = 3;

const PRESETS: Preset[] = [
  {
    id: 'strong-click',
    name: 'Strong Pulse',
    family: 'Pulse',
    description: 'One 160 ms vibration sent with the SDK vibrate API.',
    amplitudes: [1, 1],
  },
  {
    id: 'soft-pulse',
    name: 'Soft Pulse',
    family: 'Pulse',
    description: 'One gentle 240 ms vibration sent with the SDK vibrate API.',
    amplitudes: [0.55, 0.55, 0.55],
  },
  {
    id: 'ramp-up',
    name: 'Ramp Up',
    family: 'Pattern',
    description: 'Multi-frame RTP amplitude sweep from subtle to assertive.',
    amplitudes: [0.12, 0.2, 0.32, 0.46, 0.58, 0.72, 0.86, 1],
  },
  {
    id: 'heartbeat',
    name: 'Heartbeat',
    family: 'Pattern',
    description: 'Two-beat RTP frame pattern useful for alerts and guided routines.',
    amplitudes: [0.68, 0.68, 0, 0, 0.92, 0.92, 0.42, 0],
  },
  {
    id: 'buzz-alert',
    name: 'Buzz Alert',
    family: 'Pattern',
    description: 'Repeated RTP pulses for attention-grabbing notifications.',
    amplitudes: [0.56, 0.56, 0, 0.56, 0.56, 0, 0.56, 0.56],
  },
];

const INTENSITY_LEVELS = [0.25, 0.5, 0.75, 1];

const MODE_COPY: Record<DemoMode, { title: string; subtitle: string }> = {
  Pulse: {
    title: 'Single Pulse',
    subtitle: 'Send one duration and intensity through the SDK haptic.vibrate API.',
  },
  Pattern: {
    title: 'RTP Pattern',
    subtitle: 'Send a firmware-compatible multi-frame pattern through the SDK haptic.play API.',
  },
};

const MORSE_CODE_MAP: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
};

function buildMorseFrames(word: string) {
  const symbols = word
    .split('')
    .map((character) => MORSE_CODE_MAP[character])
    .filter(Boolean);

  if (symbols.length === 0) {
    return { frames: [] as number[], morseText: '' };
  }

  const frames: number[] = [];

  symbols.forEach((pattern, letterIndex) => {
    pattern.split('').forEach((symbol, symbolIndex) => {
      const activeFrames = symbol === '-' ? MORSE_DASH_FRAMES : MORSE_UNIT_FRAMES;
      frames.push(...Array.from({ length: activeFrames }, () => 1));

      if (symbolIndex < pattern.length - 1) {
        frames.push(...Array.from({ length: MORSE_SYMBOL_GAP_FRAMES }, () => 0));
      }
    });

    if (letterIndex < symbols.length - 1) {
      frames.push(...Array.from({ length: MORSE_LETTER_GAP_FRAMES }, () => 0));
    }
  });

  return {
    frames,
    morseText: symbols.join(' '),
  };
}

export default function VibrationScreen() {
  const { isConnected, client } = useBle();
  const router = useRouter();
  const [mode, setMode] = useState<DemoMode>('Pulse');
  const [patternSource, setPatternSource] = useState<PatternSource>('Preset');
  const [selectedPresetId, setSelectedPresetId] = useState('strong-click');
  const [morseWord, setMorseWord] = useState('');
  const [intensity, setIntensity] = useState(0.75);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const availablePresets = useMemo(() => PRESETS.filter((preset) => preset.family === mode), [mode]);

  const selectedPreset = useMemo(() => {
    return availablePresets.find((preset) => preset.id === selectedPresetId) ?? availablePresets[0] ?? PRESETS[0];
  }, [availablePresets, selectedPresetId]);

  const normalizedMorseWord = useMemo(
    () => morseWord.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MORSE_MAX_WORD_LENGTH),
    [morseWord]
  );

  const morsePattern = useMemo(() => buildMorseFrames(normalizedMorseWord), [normalizedMorseWord]);

  const playbackFrames = useMemo(
    () =>
      (patternSource === 'Morse' ? morsePattern.frames : selectedPreset.amplitudes).map((value) =>
        Math.min(1, value * intensity)
      ),
    [intensity, morsePattern.frames, patternSource, selectedPreset]
  );

  const hapticPattern = useMemo<HapticPattern | null>(
    () => buildHapticPattern(playbackFrames, 1),
    [playbackFrames]
  );
  const controlsLocked = isPlaying || isSending;

  const activeFrameIndex = Math.min(
    playbackFrames.length - 1,
    Math.floor(elapsedMs / HAPTIC_PREVIEW_FRAME_MS)
  );

  useEffect(() => {
    setSelectedPresetId((current) => {
      if (availablePresets.some((preset) => preset.id === current)) {
        return current;
      }
      return availablePresets[0]?.id ?? current;
    });
    if (mode === 'Pulse') setPatternSource('Preset');
    setIsPlaying(false);
    setElapsedMs(0);
  }, [availablePresets, mode]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const totalDuration = hapticPattern?.totalDurationMs ?? 0;
    const interval = setInterval(() => {
      setElapsedMs((current) => {
        const next = current + HAPTIC_PREVIEW_FRAME_MS;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
    }, HAPTIC_PREVIEW_FRAME_MS);

    return () => clearInterval(interval);
  }, [hapticPattern, isPlaying]);

  useEffect(() => {
    if (isConnected) {
      return;
    }
    setIsPlaying(false);
    setElapsedMs(0);
  }, [isConnected]);

  useEffect(() => {
    setElapsedMs(0);
    setIsPlaying(false);
    setSendError(null);
  }, [normalizedMorseWord, patternSource]);

  const startPreview = async () => {
    if (!isConnected || !client || controlsLocked || !hapticPattern) {
      return;
    }

    setSendError(null);
    setIsSending(true);

    try {
      if (mode === 'Pulse' && hapticPattern.frames.length === 1) {
        const [frame] = hapticPattern.frames;
        await client.haptic.vibrate(frame.durationMs, frame.intensity);
      } else {
        await client.haptic.play(hapticPattern);
      }
      setElapsedMs(0);
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      setElapsedMs(0);
      setSendError(error instanceof Error ? error.message : 'Failed to send haptic pattern.');
    } finally {
      setIsSending(false);
    }
  };

  const resetPreview = () => {
    setElapsedMs(0);
    setIsPlaying(false);
  };

  const sourceTitle = patternSource === 'Morse' ? (normalizedMorseWord || 'Waiting for word') : selectedPreset.name;
  const sourceDetail =
    patternSource === 'Morse'
      ? normalizedMorseWord
        ? `${normalizedMorseWord.length} characters, ${hapticPattern?.totalDurationMs ?? 0} ms total duration.`
        : 'Enter one word to generate a Morse envelope.'
      : `${hapticPattern?.totalDurationMs ?? 0} ms total duration.`;
  const envelopeCaption = 'Frame-by-frame amplitude preview for the active pattern and intensity.';
  const envelopeDescription =
    patternSource === 'Morse'
      ? normalizedMorseWord
        ? `Generated from "${normalizedMorseWord}" as a Morse-timed frame envelope with ${playbackFrames.length} bars.`
        : 'Enter a single word using letters and numbers to build a Morse frame envelope.'
      : selectedPreset.description;
  const envelopeSourceLabel = patternSource === 'Morse' ? 'Generated word' : 'Active preset';
  const envelopeSourceValue = patternSource === 'Morse' ? normalizedMorseWord || 'Waiting for word' : selectedPreset.name;
  const isDenseEnvelope = playbackFrames.length > 18;
  const presetCaption =
    patternSource === 'Morse'
      ? 'Preset selection stays available, but the active envelope is generated from your Morse word.'
      : 'Pick a firmware-compatible preset for the selected SDK operation.';

  const transportStatus = !isConnected
    ? 'Connect to a paired device to send the active pattern.'
    : patternSource === 'Morse' && playbackFrames.length === 0
      ? 'Enter a single word to build the Morse payload before sending.'
      : sendError
        ? sendError
        : isSending
          ? 'Writing the SDK-encoded haptic payload over BLE.'
          : isPlaying
            ? 'Playback is active. Wait for it to finish before sending another command.'
            : mode === 'Pulse'
              ? 'Ready to send one pulse with haptic.vibrate().'
              : 'Ready to send a protocol-v1 RTP pattern with haptic.play().';

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
            <Text style={styles.metaPillText}>Pattern encoder</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="radio-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>{isConnected ? 'BLE connected' : 'BLE disconnected'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{patternSource === 'Morse' ? 'Pattern source' : 'Selected preset'}</Text>
          <Text style={styles.summaryValue}>{sourceTitle}</Text>
          <Text style={styles.summaryHint}>{sourceDetail}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Drive level</Text>
          <Text style={styles.summaryValue}>{Math.round(intensity * 100)}%</Text>
          <Text style={styles.summaryHint}>
            {isSending ? 'Sending pattern' : isPlaying ? 'Playback mirrored locally' : 'Ready to send'}
          </Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Playback controls</Text>
            <Text style={styles.sectionCaption}>
              Send the active envelope to the BLE haptic service and mirror progress in the preview below.
            </Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{mode.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.modeRow}>
          {(['Pulse', 'Pattern'] as DemoMode[]).map((item) => {
            const selected = item === mode;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.modeChip,
                  selected && styles.modeChipSelected,
                  controlsLocked && styles.controlDisabled,
                ]}
                disabled={controlsLocked}
                onPress={() => {
                  setMode(item);
                  if (item === 'Pulse') setPatternSource('Preset');
                }}>
                <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {mode === 'Pattern' && <View style={styles.sourceRow}>
          {(['Preset', 'Morse'] as PatternSource[]).map((item) => {
            const selected = item === patternSource;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.sourceChip,
                  selected && styles.sourceChipSelected,
                  controlsLocked && styles.controlDisabled,
                ]}
                disabled={controlsLocked}
                onPress={() => setPatternSource(item)}>
                <Text style={[styles.sourceChipText, selected && styles.sourceChipTextSelected]}>{item}</Text>
              </TouchableOpacity>
            );
          })}
        </View>}

        {patternSource === 'Morse' ? (
          <View style={styles.morseInputCard}>
            <Text style={styles.morseInputLabel}>Single word</Text>
            <TextInput
              value={normalizedMorseWord}
              onChangeText={(value) => setMorseWord(value)}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!controlsLocked}
              maxLength={MORSE_MAX_WORD_LENGTH}
              placeholder="SOS"
              placeholderTextColor="#91A095"
              style={styles.morseInput}
            />
            <Text style={styles.morseHint}>Letters and numbers only. The frame bars below update from your word.</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, (!isConnected || controlsLocked || !hapticPattern) && styles.primaryButtonDisabled]}
            disabled={!isConnected || controlsLocked || !hapticPattern}
            onPress={startPreview}>
            <Ionicons name="play" size={16} color="#F7F0E8" />
            <Text style={styles.primaryButtonText}>
              {isSending ? 'Sending...' : isPlaying ? 'Playing...' : 'Send Effect'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, controlsLocked && styles.controlDisabled]}
            disabled={controlsLocked}
            onPress={resetPreview}>
            <Text style={styles.secondaryButtonText}>Reset Preview</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.transportText, !!sendError && styles.transportTextError]}>{transportStatus}</Text>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Effect envelope</Text>
            <Text style={styles.sectionCaption}>{envelopeCaption}</Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>
              {playbackFrames.length === 0 ? '0/0' : `${activeFrameIndex + 1}/${playbackFrames.length}`}
            </Text>
          </View>
        </View>

        <View style={styles.waveCard}>
          <View style={styles.waveMetaRow}>
            <Text style={styles.waveMetaLabel}>{envelopeSourceLabel}</Text>
            <Text style={styles.waveMetaValue}>{envelopeSourceValue}</Text>
          </View>

          <ScrollView
            horizontal={isDenseEnvelope}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.waveBars, isDenseEnvelope && styles.waveBarsDense]}>
            {playbackFrames.map((value, index) => {
              const highlighted = isPlaying && index <= activeFrameIndex;
              const silentFrame = value <= 0.01;
              return (
                <View
                  key={`${patternSource === 'Morse' ? normalizedMorseWord || 'morse' : selectedPreset.id}-${index}`}
                  style={[
                    styles.waveBar,
                    isDenseEnvelope && styles.waveBarDense,
                    {
                      height: silentFrame ? 10 : 24 + value * 90,
                      opacity: highlighted ? 1 : silentFrame ? 0.22 : 0.45,
                      backgroundColor: highlighted ? '#153B2E' : silentFrame ? '#D6CCC0' : '#AAB8AE',
                    },
                  ]}
                />
              );
            })}
          </ScrollView>
          <Text style={styles.waveDescription}>{envelopeDescription}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Presets</Text>
            <Text style={styles.sectionCaption}>{presetCaption}</Text>
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
                style={[
                  styles.presetCard,
                  selected && styles.presetCardSelected,
                  patternSource === 'Morse' && styles.presetCardMuted,
                  controlsLocked && styles.controlDisabled,
                ]}
                disabled={controlsLocked}
                onPress={() => {
                  setSelectedPresetId(preset.id);
                  setElapsedMs(0);
                  setIsPlaying(false);
                }}>
                <View style={styles.presetHeaderRow}>
                  <Text style={[styles.presetName, selected && styles.presetNameSelected]}>{preset.name}</Text>
                  <Text style={[styles.presetDuration, selected && styles.presetDurationSelected]}>
                    {preset.amplitudes.length * HAPTIC_PREVIEW_FRAME_MS} ms
                  </Text>
                </View>
                <Text style={[styles.presetDescription, selected && styles.presetDescriptionSelected]}>
                  {preset.description}
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
            <Text style={styles.sectionCaption}>
              Adjust the intensity byte that gets encoded into each outgoing frame.
            </Text>
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
                style={[
                  styles.intensityButton,
                  selected && styles.intensityButtonSelected,
                  controlsLocked && styles.controlDisabled,
                ]}
                disabled={controlsLocked}
                onPress={() => setIntensity(level)}>
                <Text style={[styles.intensityText, selected && styles.intensityTextSelected]}>
                  {Math.round(level * 100)}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  controlDisabled: {
    opacity: 0.5,
  },
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
  sourceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  sourceChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8C8B9',
    backgroundColor: '#FFF3E7',
    alignItems: 'center',
  },
  sourceChipSelected: {
    backgroundColor: '#2F5B4B',
    borderColor: '#2F5B4B',
  },
  sourceChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14251F',
  },
  sourceChipTextSelected: {
    color: '#F7F0E8',
  },
  morseInputCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1D5C9',
    backgroundColor: '#F7EFE6',
    padding: 14,
  },
  morseInputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#355345',
  },
  morseInput: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8C8B9',
    backgroundColor: '#FFF9F2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#14251F',
  },
  morseHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: '#5F6B65',
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
  primaryButtonDisabled: {
    backgroundColor: '#6F857A',
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
  transportText: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 19,
    color: '#5F6B65',
  },
  transportTextError: {
    color: '#B4473B',
  },
  waveCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#F7EFE6',
  },
  waveMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  waveMetaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#68736D',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  waveMetaValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '800',
    color: '#153B2E',
  },
  waveBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    height: 130,
  },
  waveBarsDense: {
    justifyContent: 'flex-start',
    gap: 4,
    minWidth: '100%',
  },
  waveBar: {
    flex: 1,
    borderRadius: 999,
  },
  waveBarDense: {
    flexGrow: 0,
    flexShrink: 0,
    width: 8,
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
  presetCardMuted: {
    opacity: 0.6,
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
});
