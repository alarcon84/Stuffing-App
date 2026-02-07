# Rebuild APK Instructions

To rebuild the Android APK with the latest changes:

1.  **Build the Mobile Web App:**
    ```bash
    cd apps/mobile
    npm run build
    ```

2.  **Sync with Capacitor:**
    This copies the built web assets and any new public assets (like `stacking-options.png`) to the Android project.
    ```bash
    npx cap sync
    ```

3.  **Open Android Studio:**
    ```bash
    npx cap open android
    ```

4.  **Build APK:**
    - In Android Studio, go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
    - Locate the APK in `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## Notes
- Ensure you have copied any new assets to `apps/mobile/public/` before building.
- If you changed native configuration, you might need to run `npx cap update`.
