# Sens Wear Mobile App

Mobile app for the Sens Wear platform. This Expo app powers onboarding, device pairing, live sensor views, and insights for wearable data.

## Features

- Secure sign in and profile management
- Device pairing and connection status
- Live sensor dashboards and history
- Alerts and notifications
- Account and device settings

## Tech stack

- Expo + React Native
- TypeScript
- File-based routing via Expo Router

## Requirements

- Node.js 18+
- npm 9+
- Expo CLI (via `npx`)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npx expo start
   ```

3. Open the app using:
   - Expo Go on a device, or
   - Android emulator, or
   - iOS simulator

## Environment variables

Create a `.env` file in the project root (if required by your setup):

```bash
# Example
SENSWEAR_API_BASE_URL=https://api.sens-wear.com
```

## Project structure

- `app/` - Screens and routes
- `components/` - Shared UI components
- `assets/` - Images, fonts, and icons

## Common scripts

- `npm run start` - Start Expo
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web

## Notes

- Update API endpoints and secrets in `.env` as needed.
- If you add native modules, use a development build instead of Expo Go.

## Contributing

1. Create a feature branch.
2. Make changes and add tests if needed.
3. Open a pull request with a clear description.