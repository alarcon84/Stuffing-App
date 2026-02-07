# Stuffing Calculator - Android App

This is the Android version of the Stuffing Calculator, built with Capacitor, React, and Vite.

## Prerequisites

- Node.js
- Android Studio
- Java JDK (usually bundled with Android Studio)

## Setup

1.  Install dependencies (from monorepo root):
    ```bash
    npm install
    ```

2.  Build the web assets:
    ```bash
    npm run build --filter=mobile
    # OR
    cd apps/mobile && npm run build
    ```

3.  Sync with Android project:
    ```bash
    cd apps/mobile
    npx cap sync
    ```

## Building the APK

1.  Open the Android project in Android Studio:
    ```bash
    npx cap open android
    ```
    Or manually open the `apps/mobile/android` folder in Android Studio.

2.  In Android Studio:
    *   Wait for Gradle sync to complete.
    *   Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.

3.  Locate the APK:
    *   The APK will be generated in: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
    *   Click "locate" in the notification popup in Android Studio.

4.  Install on Device:
    *   Transfer the APK to your Android device via USB.
    *   Enable "Install unknown apps" if prompted.
    *   Install and run.

## Development Workflow

1.  Make changes to `apps/mobile/src` or shared packages.
2.  Rebuild web assets: `npm run build` (in `apps/mobile`).
3.  Sync changes: `npx cap sync`.
4.  Run on device/emulator via Android Studio.

## Troubleshooting

*   **Missing Styles:** Ensure `tailwind.config.js` includes the shared UI package paths.
*   **White Screen:** Check Logcat in Android Studio for JavaScript errors.
