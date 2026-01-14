import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSharedValue } from 'react-native-reanimated';
import type { ColorFormatsObject } from 'reanimated-color-picker';
import ColorPicker, { colorKit, HueSlider, OpacitySlider, Panel3 } from 'reanimated-color-picker';
import { colorPickerStyle } from '@/components/ColorPickerStyle';
import { encode as b64encode } from 'base-64';
import { LED_UUIDS } from '@/ble/bleConstants';
import { useBle } from '@/hooks/BleSessionProvider';

export default function LEDScreen() {
  const { writeWithResponse } = useBle();
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const router = useRouter();
  const [resultColor, setResultColor] = useState('#0000ff');
  const currentColor = useSharedValue('#0000ff');
  const [isLEDOn, setIsLEDOn] = useState(false);

  function colorHexToRGBWUint32LE(hex: string, white = 0) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const w = white & 0xff;

    // little-endian byte order: R, G, B, W
    const bytes = Uint8Array.from([r, g, b, w]);

    return b64encode(String.fromCharCode(...bytes));
  }

  const turnOnOff = async () => {
    if (isLEDOn) {
      const base64Color = colorHexToRGBWUint32LE('#000000');
      await writeWithResponse(
        LED_UUIDS.SERVICE_UUID,
        LED_UUIDS.COLOR_CHAR,
        base64Color
      );
      setIsLEDOn(false);
    } else {
      const base64Color = colorHexToRGBWUint32LE(currentColor.value);
      await writeWithResponse(
        LED_UUIDS.SERVICE_UUID,
        LED_UUIDS.COLOR_CHAR,
        base64Color
      );
      setIsLEDOn(true);
    }
  };

  // runs on the ui thread on color change
  const onColorChange = (color: ColorFormatsObject) => {
    'worklet';
    currentColor.value = color.hex;
  };

  // runs on the js thread on color pick
  const onColorPick = async (color: ColorFormatsObject) => {
    setResultColor(color.hex);
    if (!isLEDOn) {
      return;
    }
    const base64Color = colorHexToRGBWUint32LE(color.hex);
    await writeWithResponse(
      LED_UUIDS.SERVICE_UUID,
      LED_UUIDS.COLOR_CHAR,
      base64Color
    );
  };


  useEffect(() => {
    let isMounted = true;
    // Turn off the LED before clearing the loading state.
    (async () => {
      try {
        const base64Color = colorHexToRGBWUint32LE('#000000');
        await writeWithResponse(
          LED_UUIDS.SERVICE_UUID,
          LED_UUIDS.COLOR_CHAR,
          base64Color
        );
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
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>LED</Text>
        </View>

        <View style={styles.headerRight}>
          {/* <Image source={require('@/assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" /> */}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : (
        <View style={colorPickerStyle.pickerContainer}>
          <ColorPicker
            value={resultColor}
            sliderThickness={25}
            thumbSize={24}
            thumbShape='circle'
            onChange={onColorChange}
            onCompleteJS={onColorPick}
            style={colorPickerStyle.picker}
            adaptSpectrum
          >
            <Panel3 style={colorPickerStyle.panelStyle} />
            <HueSlider style={colorPickerStyle.sliderStyle} />
            <OpacitySlider style={colorPickerStyle.sliderStyle} />
            <Button
              title={isLEDOn ? 'Turn Off' : 'Turn On'}
              color="#000"
              onPress={turnOnOff}
            />
          </ColorPicker>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  mainContainer: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerLeft: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  dividerLeftSideLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'black'
  },
  dividerRightSideLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'black'
  },
  dividerText: {
    width: 100,
    textAlign: 'center',
    fontSize: 15
  }
});
