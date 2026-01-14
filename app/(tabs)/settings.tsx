import { Alert, StyleSheet, Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ExternalLink } from '@/components/ExternalLink';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useBle } from '@/hooks/BleSessionProvider';

export default function TabTwoScreen() {
  const router = useRouter();
  const { forget } = useBle();

  const settingsItems = [
    { label: 'Charging status', value: 'Connected to charger' },
    { label: 'Battery health', value: 'Good' },
    { label: 'Battery percentage', value: '78%' },
    { label: 'Connected daughter boards', value: 'IMU, GPS, Temp' },
    { label: 'Firmware version', value: 'v1.2.3' },
    { label: 'Mobile app version', value: 'v0.9.0' },
  ];

  const handleUnpairPress = () => {
    Alert.alert(
      'Unpair device',
      'Are you sure you want to unpair this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            await forget();
            router.replace('/');
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <Image
          source={require('@/assets/images/setting-header.png')}
          style={styles.headerImage}
          resizeMode="contain"
        />
      }>
      <ThemedView style={styles.list}>
        {settingsItems.map((item) => (
          <View key={item.label} style={styles.listRow}>
            <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
            <ThemedText style={styles.valueText}>{item.value}</ThemedText>
          </View>
        ))}
        <View style={[styles.listRow, styles.listRowLast]}>
          <ThemedText type="defaultSemiBold">Website</ThemedText>
          <ExternalLink href="http://sens-wear.com/">
            <ThemedText type="link">sens-wear.com</ThemedText>
          </ExternalLink>
        </View>
      </ThemedView>
      <ThemedView style={styles.actions}>
        <Pressable style={[styles.actionButton, styles.logoutButton]} onPress={handleUnpairPress}>
          <ThemedText type="defaultSemiBold">Unpair device</ThemedText>
        </Pressable>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    bottom: -20,
    left: '55%',
    position: 'absolute',
    width: 150,
    height: 250,
    transform: [{ translateX: -100 }],
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  list: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  listRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  valueText: {
    marginTop: 4,
    color: '#444',
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#efefef',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#ff7b73',
  },
});
