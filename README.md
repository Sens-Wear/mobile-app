# SensWear Mobile App

![SensWear mobile app screens](assets/images/senswear-mobile-app-screenshots.jpg)

Expo/React Native application for pairing with a SensWear device, inspecting live sensor
data, and controlling its LED and haptic outputs.

## Hardware features

- Battery percentage and charging state
- Quaternion and gravity-including accelerometer charts
- Red, infrared, and green raw PPG charts
- Bluetooth Health Thermometer indications
- A 15-pad linear touch demo with live position, nominal distance, horizontal gestures and streaming diagnostics
- RGB LED color control
- Haptic presets, intensity control, sequences, and compact Morse patterns
- Firmware version and compiled shield/capability information in Settings
- CSV export for IMU, PPG, temperature, touch, LED, vibration, and Settings power readings

All Bluetooth protocol access goes through the SensWear TypeScript SDK. Screens consume typed
SDK models and do not decode base64 values or maintain UUIDs themselves.

## Requirements

- Node.js 18+
- npm
- Android Studio or Xcode for a native development build
- A SensWear device running the current firmware

`react-native-ble-plx` requires native code, so use an Expo development build rather than
Expo Go.

## Getting started

```bash
npm install
npm run android
```

For iOS:

```bash
npm run ios
```

The pairing screen requests the appropriate platform permissions and discovers devices whose
name begins with `Sens Wear` or `SensWear`.

## SDK dependency

This checkout uses **SensWear SDK 0.4.0**, packed from the accompanying TypeScript
SDK into `vendor/senswear-0.4.0.tgz`. Both package files pin that local archive so
`npm ci` installs the exact firmware-aligned SDK without an external junction.
This local package has not been published.

To regenerate the archive after changing the SDK, run in the TypeScript SDK repository:

```powershell
npm.cmd run build
npm.cmd pack . --pack-destination C:\SenswearMobileApp\vendor
```

Then run in this app:

```powershell
npm.cmd install ./vendor/senswear-0.4.0.tgz --save-exact
```

Once the matching release is published, the dependency can return to the official
registry with `npm install senswear@0.4.0 --save-exact`. Publishing is a separate
release action.

## Linear touch demonstration

The page follows the current touch firmware: 15 electrodes, X from **0 to 896**
increasing from connector to tip, and no Y axis. Pad centers are 64 coordinate
units apart at a 3 mm pitch. The displayed millimeters are a nominal conversion
from the first pad center, not calibrated physical accuracy.

Live touch state controls the position marker. The controller's diagnostic TCH
bit may disagree with host-decoded contact on this linear board; it does not
control the UI. The raw characteristic carries decoded position and status,
not 15 separate electrode ADC readings. Existing 13/10/16-byte state, gesture
and raw payload layouts are unchanged.

Use the strip and position history for slides, and the gesture demonstration for
taps, double taps, holds and left/right swipes, including swipe-and-hold. A single
tap is delayed by the firmware's double-tap window. Vertical gestures are not
produced by this firmware. Streaming is best-effort, and a quiet untouched strip
normally stops producing notifications; idle time alone is not evidence of a stall.

The controller demo maps position to a level, a tap to its light, a hold to a
level lock, and swipes to tile selection. Double tap resets the demo. These are
on-screen controls and do not change the device LED or haptic output.

For a physical check with the current firmware:

1. Sweep all 15 pads from connector to tip and back. Confirm X spans the strip,
   the nearest pad follows the finger, and release clears the active marker.
2. Try taps, double taps, holds and both swipe directions, including swipe-and-hold.
   Compare the gesture label and demo action with the movement trace.
3. Pause/resume acquisition, leave/reopen the page, and disconnect/reconnect.
   Confirm live events resume and leaving restores the prior sampling setting.
4. Stream gestures and position for at least 30 minutes. The page retains only
   180 position frames and eight gestures and updates the display at 10 Hz.

## Architecture

- `hooks/useBleSession.ts` owns the shared `SenswearClient`, connection state, discovery,
  persistence, and disconnect handling.
- `hooks/BleSessionProvider.tsx` exposes the session to every route.
- `app/(tabs)/sensors.tsx` shows battery/power state and routes to each hardware module.
- `app/imu`, `app/ppg`, `app/temperature`, and `app/touch` subscribe through SDK modules.
- `app/led` and `app/vibration` use SDK validation and binary encoders for writes.
- `ble/bleManager.ts` contains the one native `BleManager` passed into the SDK.

The session reads the firmware's Device Information revision and versioned capability record
through `client.deviceInfo`. Settings shows the fixed catalog of available daughter boards
separately from the shields compiled into the connected firmware. These flags describe firmware
support, not physical attachment detection or a sensor health test. PPG firmware can enable
both PPG and temperature shields.

Dashboard cards and direct feature routes require a reported feature flag and, for daughter
modules, the corresponding shield flag. Missing, unsupported, or unreadable metadata keeps
modules disabled and offers a refresh action; older firmware needs the new metadata service.
Capabilities are cleared on disconnect and read again on every connection. No existing sensor
payload UUIDs/layouts were changed by this additive metadata interface.

The mobile version label uses the installed native application version via `expo-application`,
with the Expo config version as a development/web fallback. The current configured app version
is 1.0.0. Rebuild the native app after installing this new native module.

## CSV exports

Use the share icon on each feature page, or **Export power readings** in Settings. Capture data
or perform an interaction first. Each CSV has a header, a monotonically increasing record number,
and phone receipt time in UTC. Device timestamps retain their full integer precision; column
names identify device timestamp units and sensor units. Touch includes state, gestures, raw
diagnostics and acquisition controls. LED and vibration record command outcomes; a successful
BLE write is not proof of physical light/motor operation. Failed writes are marked as errors.

Exports retain the latest 20,000 records per feature visit in memory. Feature logs survive a
temporary disconnect or metadata refresh while the route remains open, and are cleared when
leaving the route. Charts may display a smaller window. Export uses the platform share sheet
and reports missing data, unavailable sharing, and file/share errors. The app reuses one cache
file per feature rather than accumulating exports.

## Validation

```bash
npx tsc --noEmit
npm run lint
npx jest --runInBand
npx expo export --platform android --output-dir dist-validation
```

Remove `dist-validation` after a local bundle check.

Physical validation after rebuilding the app and programming the intended firmware separately:

1. Connect base, haptic, PPG+temperature, temperature, and touch firmware builds in turn. Verify
   Settings matches each build's `VERSION` and shields and only supported dashboard cards open.
2. Open an unsupported feature via a deep link; confirm its controls/streams never start. With
   older firmware, confirm metadata is unavailable and no feature is incorrectly enabled.
3. Disconnect/reconnect and refresh metadata; check capability state never carries over from a
   previous device. Confirm an open feature's recording remains exportable after reconnection.
4. Capture every stream and perform LED/vibration/touch interactions. Share each CSV, check
   headers, exact timestamps, units and write outcomes in a CSV reader, and exercise no-data
   and failed-sharing paths. Verify power export from Settings as well.

Automated tests and bundling do not substitute for these physical-device checks.
