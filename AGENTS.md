# AGENTS.md

## Project overview

This is the SensWear Expo/React Native mobile application. It uses Expo Router, strict
TypeScript, React Native BLE PLX, and the official SensWear TypeScript SDK from npm. It supports
device pairing, live IMU/PPG/temperature/touch views, battery/power status, RGB LED control,
haptic patterns, and PPG CSV export.

Use a native development build; BLE does not work in Expo Go.

## Repository map

- `app/`: Expo Router screens and layouts.
- `hooks/useBleSession.ts`: the single `SenswearClient` lifecycle owner.
- `hooks/BleSessionProvider.tsx`: application-wide BLE session context.
- `ble/bleManager.ts`: the single native `BleManager` passed to the SDK.
- `components/`: shared presentation components.
- `constants/`: UI and capability constants.
- `assets/`: images and fonts.
- `android/`: generated/customized Android native project.
- `package.json` and `package-lock.json`: pinned npm dependencies, including the SensWear SDK.

## Setup and commands

```sh
npm ci
npx tsc --noEmit
npm run lint
npx jest --runInBand
```

Run native development builds:

```sh
npm run android
npm run ios
```

Validate Metro production bundling:

```sh
npx expo export --platform android --output-dir dist-validation
```

`dist-validation/` is temporary generated output; remove it after validation. Do not run
dependency audit fixes with `--force` or perform Expo/React Native upgrades unless requested.

## Architecture rules

- `useBleSession` owns discovery, connection, persistence, disconnect handling, and the active
  `SenswearClient`.
- Screens consume typed SDK modules through `useBle()`.
- Do not add screen-level UUID tables, base64 conversion, `DataView` payload parsers, or direct
  `monitor/read/writeCharacteristic*` calls.
- The only direct BLE object should be the shared manager required by the SDK lifecycle.
- Start subscriptions in `useFocusEffect` and unsubscribe every characteristic on cleanup.
- Guard asynchronous callbacks with an active flag so unfocused screens do not update state.
- Do not create multiple managers or clients per screen.
- Handle disconnected/no-client states without crashing or leaving spinners indefinitely.

## SDK dependency workflow

`package.json` references the official `senswear` package published on npm. Keep the dependency
at an exact version so `package.json` and `package-lock.json` produce reproducible installs.

To upgrade after a new SDK version is published:

```sh
npm install senswear@<version> --save-exact
```

Update the version in the README when it explicitly names a release. Verify that the lockfile
resolves `senswear` from `https://registry.npmjs.org/`, not from a local file or filesystem
junction.

## TypeScript and React conventions

- Keep strict TypeScript and typed component state; avoid `any` except for unavoidable
  third-party ref types.
- Use functional components and hooks.
- Follow existing single-quote/no-semicolon style.
- Include hook dependencies; use refs for high-rate sample buffers to avoid per-notification
  rendering.
- Batch high-rate chart updates and cap retained samples.
- Keep raw 64-bit SDK timestamps as `bigint`; convert them to strings before JSON/CSV when
  necessary.
- Make units visible in names and UI. PPG values are raw ADC samples, acceleration is in g,
  and touch coordinates are controller coordinates, not pixels.
- Maintain Expo Router typed paths and platform-specific icon compatibility.

## Hardware-screen behavior

- IMU: enable physical streams, configure drain latency deliberately, and clean up each stream.
- PPG: sampling/IRQ configuration ordering must follow SDK/firmware constraints; exported CSV
  timestamps must not lose integer precision.
- Temperature: the measurement is indicated, not read; a zero interval disables scheduling.
- Touch: use normalized SDK gestures for application logic and retain raw codes only for
  diagnostics.
- LED: use SDK RGB encoding; the current interface is not RGBW.
- Haptics: firmware accepts at most 32 frames and rejects overlap while busy. Compact adjacent
  equal frames or constrain UI patterns.

## Testing

- Add/update component tests for UI state and interaction changes.
- Mock `useBle()` or the SDK module boundary; tests must not require native BLE or hardware.
- For session changes, test success, connection failure, disconnect, persisted auto-connect,
  and cleanup behavior.
- For streaming screens, test typed callback-to-UI transformations and unsubscribe cleanup.
- Always run typecheck, lint, Jest, and at least one Metro export after SDK/package changes.
- State explicitly that physical-device behavior remains unverified when no hardware test ran.

## Native and security considerations

- Keep Bluetooth permissions in `app.json` and native manifests aligned with supported Android
  and iOS versions.
- Do not commit signing keys, provisioning profiles, `.env` secrets, device identifiers, or
  sensitive recorded health data.
- Do not edit generated native or Expo files without understanding whether prebuild will
  overwrite them.
- PPG and temperature displays are sensor data, not medical diagnoses; do not add unsupported
  health claims.

## Completion checklist

- No direct protocol parsing or UUID duplication was introduced outside the SDK.
- Subscriptions and resources are cleaned up.
- `npx tsc --noEmit`, `npm run lint`, and `npx jest --runInBand` pass.
- Metro export succeeds after SDK/dependency changes.
- The SDK version and npm registry resolution are synchronized in the package files.
- UI text accurately describes units, raw/derived data, and limitations.
