# BOX — Android APK build

This project wraps the current BOX web prototype in a native Android WebView app.

## Build without Android Studio
1. Create a GitHub repository (private is fine).
2. Upload the entire contents of this folder.
3. Open **Actions** → **Build BOX APK**.
4. Run the workflow with **Run workflow**.
5. When it finishes, open the run and download **BOX-debug-apk** from Artifacts.
6. Unzip it and install `app-debug.apk` on Android.

The app currently works fully offline because the prototype is bundled inside the APK. No API keys are stored in the app.
