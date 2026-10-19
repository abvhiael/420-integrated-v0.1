# LIFTd Mobile — MBL-1

Shared TypeScript React Native / Expo scaffold for Android and iOS. This is **not an authenticated production client**, rider-booking app or driver-dispatch app. The rider/driver role screens are locally isolated previews and deliberately have no network, payment, location, account or trip authority.

## Local checks

With Node 22 or later: `npm install --ignore-scripts` then `npm run check`. Android debug: `npx expo prebuild --platform android --non-interactive` then `cd android && ./gradlew :app:assembleDebug`. iOS simulator: on macOS with Xcode, `npx expo prebuild --platform ios --non-interactive` then build the generated workspace in Debug for an iOS Simulator destination.

The scoped CI workflow publishes an unsigned/nonproduction Android debug APK if its build succeeds; it does not publish to Google Play or TestFlight. iOS compilation requires macOS/Xcode and cannot be certified from Linux. Signing, device testing, external Identity, Location, Wallet, Pay, eligibility, and operator approval remain in TN-MBL testnet gates.

No production endpoints or secrets may be introduced in MBL-1. Do not enable any real booking merely by deploying this shell.
