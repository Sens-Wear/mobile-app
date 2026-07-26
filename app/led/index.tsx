import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSharedValue } from 'react-native-reanimated';
import type { ColorFormatsObject } from 'reanimated-color-picker';
import ColorPicker, { HueSlider, OpacitySlider, Panel3 } from 'reanimated-color-picker';
import { colorPickerStyle } from '@/components/ColorPickerStyle';
import { useBle } from '@/hooks/BleSessionProvider';

export default function LEDScreen() {
  const { client, isConnected } = useBle();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [resultColor, setResultColor] = useState('#0000ff');
  const currentColor = useSharedValue('#0000ff');
  const [isLEDOn, setIsLEDOn] = useState(false);

  const turnOnOff = async () => {
    if (!client) return;
    if (isLEDOn) {
      await client.led.off();
      setIsLEDOn(false);
    } else {
      await client.led.set(currentColor.value);
      setIsLEDOn(true);
    }
  };

  const onColorChange = (color: ColorFormatsObject) => {
    'worklet';
    currentColor.value = color.hex;
  };

  const onColorPick = async (color: ColorFormatsObject) => {
    setResultColor(color.hex);
    if (!isLEDOn) {
      return;
    }
    await client?.led.set(color.hex);
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (client && isConnected) await client.led.off();
      } finally {
        if (isMounted) {
          setIsLEDOn(false);
          setLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [client, isConnected]);

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
            <Ionicons name="bulb-outline" size={20} color="#153B2E" />
          </View>
        </View>

        <Text style={styles.eyebrow}>LED control</Text>
        <Text style={styles.heroTitle}>Choose a color and push it directly to the device.</Text>
        <Text style={styles.heroSubtitle}>
          Use the live picker to preview hue and opacity, then toggle the onboard LED without
          changing the existing control flow.
        </Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="color-palette-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>RGB output</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="radio-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>{isLEDOn ? 'LED on' : 'LED off'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Selected color</Text>
          <View style={styles.colorPreviewRow}>
            <View style={[styles.colorSwatch, { backgroundColor: resultColor }]} />
            <Text style={styles.summaryValue}>{resultColor.toUpperCase()}</Text>
          </View>
          <Text style={styles.summaryHint}>Updated when the picker selection completes.</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Power state</Text>
          <Text style={styles.summaryValue}>{isLEDOn ? 'Active' : 'Standby'}</Text>
          <Text style={styles.summaryHint}>Toggling sends either the chosen color or black.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#153B2E" />
          <Text style={styles.loadingTitle}>Preparing LED control</Text>
          <Text style={styles.loadingText}>The screen waits until the onboard LED is reset.</Text>
        </View>
      ) : (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Color picker</Text>
              <Text style={styles.sectionCaption}>
                Adjust panel, hue and opacity sliders, then apply the current selection.
              </Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{isLEDOn ? 'LIVE' : 'READY'}</Text>
            </View>
          </View>

          <View style={styles.pickerCard}>
            <ColorPicker
              value={resultColor}
              sliderThickness={25}
              thumbSize={24}
              thumbShape="circle"
              onChange={onColorChange}
              onCompleteJS={onColorPick}
              style={colorPickerStyle.picker}
              adaptSpectrum>
              <Panel3 style={colorPickerStyle.panelStyle} />
              <HueSlider style={colorPickerStyle.sliderStyle} />
              <OpacitySlider style={colorPickerStyle.sliderStyle} />
            </ColorPicker>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, isLEDOn ? styles.actionButtonOff : styles.actionButtonOn]}
            onPress={turnOnOff}>
            <Ionicons
              name={isLEDOn ? 'power-outline' : 'flash-outline'}
              size={18}
              color={isLEDOn ? '#FFF4F1' : '#F7F0E8'}
            />
            <Text style={styles.actionButtonText}>{isLEDOn ? 'Turn Off' : 'Turn On'}</Text>
          </TouchableOpacity>
        </View>
      )}
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
    color: '#F6ECE0',
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FDF9F4',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    maxWidth: '92%',
    marginTop: 8,
  },
  heroSubtitle: {
    color: '#F3E8DD',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: '92%',
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
    justifyContent: 'space-between',
    marginTop: 18,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#FFF9F2',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9DACC',
    padding: 16,
  },
  summaryLabel: {
    color: '#68736D',
    fontSize: 12,
  },
  colorPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D6C5B4',
  },
  summaryValue: {
    color: '#14251F',
    fontSize: 19,
    fontWeight: '800',
  },
  summaryHint: {
    color: '#5F6B65',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  loadingCard: {
    marginTop: 18,
    backgroundColor: '#FFF9F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9DACC',
    paddingHorizontal: 18,
    paddingVertical: 26,
    alignItems: 'center',
  },
  loadingTitle: {
    color: '#14251F',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  loadingText: {
    color: '#5F6B65',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  sectionCard: {
    marginTop: 18,
    backgroundColor: '#FFF9F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9DACC',
    padding: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionTitle: {
    color: '#14251F',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionCaption: {
    color: '#5F6B65',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
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
  pickerCard: {
    overflow: 'hidden',
    paddingVertical: 10,
  },
  actionButton: {
    marginTop: 18,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonOn: {
    backgroundColor: '#153B2E',
  },
  actionButtonOff: {
    backgroundColor: '#B4473B',
  },
  actionButtonText: {
    color: '#F7F0E8',
    fontSize: 14,
    fontWeight: '800',
  },
});
