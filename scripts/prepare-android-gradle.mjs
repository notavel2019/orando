import fs from "fs";
import path from "path";

const versionCode = Number(process.env.ANDROID_VERSION_CODE || "100");
const versionName = String(process.env.ANDROID_VERSION_NAME || "1.0.0").replace(
  /[^0-9A-Za-z._-]/g,
  ""
);
const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
const hasKeystore = Boolean(
  process.env.ORATORIO_KEYSTORE_PATH && fs.existsSync(process.env.ORATORIO_KEYSTORE_PATH)
);

const androidDir = path.resolve("android");
const appDir = path.resolve(androidDir, "app");
const buildGradlePath = path.resolve(appDir, "build.gradle");
const manifestPath = path.resolve(appDir, "src", "main", "AndroidManifest.xml");
const mainActivityPath = path.resolve(
  appDir,
  "src",
  "main",
  "java",
  "com",
  "oratorio",
  "app",
  "MainActivity.java"
);
const resDir = path.resolve(appDir, "src", "main", "res");
const localPropsPath = path.resolve(androidDir, "local.properties");

if (!fs.existsSync(buildGradlePath)) {
  console.error("android/app/build.gradle not found. Run `npx cap add android` first.");
  process.exit(1);
}

// Write local.properties so Gradle explicitly resolves the pre-installed Android SDK
if (sdkDir) {
  const escapedSdkDir = sdkDir.replace(/\\/g, "\\\\");
  fs.writeFileSync(localPropsPath, `sdk.dir=${escapedSdkDir}\n`, "utf8");
}

let gradle = fs.readFileSync(buildGradlePath, "utf8");

// Ensure strictly increasing versionCode and matching versionName so Android upgrades in place
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

if (hasKeystore && !gradle.includes("signingConfigs")) {
  const signingBlock = `
    signingConfigs {
        release {
            storeFile file(System.getenv("ORATORIO_KEYSTORE_PATH"))
            storePassword System.getenv("ORATORIO_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ORATORIO_KEY_ALIAS")
            keyPassword System.getenv("ORATORIO_KEY_PASSWORD")
        }
    }
    buildTypes {`;

  gradle = gradle.replace(/buildTypes\s*\{/, signingBlock);
  gradle = gradle.replace(
    /release\s*\{/,
    `release {\n            signingConfig signingConfigs.release`
  );
}

fs.writeFileSync(buildGradlePath, gradle, "utf8");

// Keep AndroidManifest permissions minimal (no REQUEST_INSTALL_PACKAGES, which triggers
// Google Play Protect warnings on sideloaded APKs) and declare RECOGNIZE_SPEECH query
// so Android 11+ devices resolve the native Google voice recognition activity cleanly.
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf8");
  manifest = manifest.replace(
    /\s*<uses-permission\s+android:name="android\.permission\.REQUEST_INSTALL_PACKAGES"\s*\/>/g,
    ""
  );
  if (!manifest.includes("android.speech.action.RECOGNIZE_SPEECH")) {
    const queryBlock = `
    <queries>
        <intent>
            <action android:name="android.speech.action.RECOGNIZE_SPEECH" />
        </intent>
    </queries>
</manifest>`;
    manifest = manifest.replace(/<\/manifest>\s*$/, queryBlock);
  }
  if (!manifest.includes("android:allowBackup")) {
    manifest = manifest.replace(
      /<application([^>]*)>/,
      `<application$1 android:allowBackup="true">`
    );
  }
  fs.writeFileSync(manifestPath, manifest, "utf8");
}

// Install native Android Speech-to-Text JavascriptInterface bridge inside MainActivity.java
// Uses Android's built-in RecognizerIntent.ACTION_RECOGNIZE_SPEECH (zero third-party plugins,
// zero extra risky permissions, full Brazilian Portuguese voice dictation).
fs.mkdirSync(path.dirname(mainActivityPath), { recursive: true });
fs.writeFileSync(
  mainActivityPath,
  `package com.oratorio.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private ActivityResultLauncher<Intent> speechLauncher;
    private boolean speechInterfaceAttached = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        speechLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    ArrayList<String> matches = result.getData()
                        .getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                    if (matches != null && !matches.isEmpty()) {
                        sendSpeechResult(matches.get(0), null);
                        return;
                    }
                }
                sendSpeechResult(null, "cancelled");
            }
        );

        attachSpeechInterface();
    }

    @Override
    public void onStart() {
        super.onStart();
        attachSpeechInterface();
    }

    private void attachSpeechInterface() {
        if (speechInterfaceAttached) return;
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.addJavascriptInterface(new SpeechBridge(), "OratorioAndroidSpeech");
            speechInterfaceAttached = true;
        }
    }

    private void sendSpeechResult(String text, String error) {
        runOnUiThread(() -> {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView == null) return;
            String jsText = text != null ? JSONObject.quote(text) : "null";
            String jsErr = error != null ? JSONObject.quote(error) : "null";
            webView.evaluateJavascript(
                "window.__oratorioSpeechCallback && window.__oratorioSpeechCallback(" + jsText + "," + jsErr + ");",
                null
            );
        });
    }

    public class SpeechBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public void startSpeech(String language, String prompt) {
            runOnUiThread(() -> {
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(
                    RecognizerIntent.EXTRA_LANGUAGE,
                    (language != null && !language.isEmpty()) ? language : "pt-BR"
                );
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR");
                intent.putExtra(
                    RecognizerIntent.EXTRA_PROMPT,
                    (prompt != null && !prompt.isEmpty()) ? prompt : "Fale o que esta no seu coracao..."
                );
                try {
                    speechLauncher.launch(intent);
                } catch (ActivityNotFoundException e) {
                    sendSpeechResult(null, "unavailable");
                } catch (Exception e) {
                    sendSpeechResult(null, "failed");
                }
            });
        }
    }
}
`,
  "utf8"
);

// Configure a clean custom Oratório adaptive launcher icon (replaces default Capacitor icon)
const valuesDir = path.join(resDir, "values");
const drawableDir = path.join(resDir, "drawable");
const anydpiDir = path.join(resDir, "mipmap-anydpi-v26");

fs.mkdirSync(valuesDir, { recursive: true });
fs.mkdirSync(drawableDir, { recursive: true });
fs.mkdirSync(anydpiDir, { recursive: true });

fs.writeFileSync(
  path.join(valuesDir, "oratorio_launcher_colors.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="oratorio_launcher_bg">#0F3D34</color>
</resources>
`,
  "utf8"
);

fs.writeFileSync(
  path.join(drawableDir, "oratorio_launcher_fg.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#00000000"
        android:strokeColor="#E5E1D8"
        android:strokeWidth="1.8"
        android:strokeAlpha="0.45"
        android:pathData="M54,24 A30,30 0 1,0 54,84 A30,30 0 1,0 54,24 Z" />
    <path
        android:fillColor="#F9F8F4"
        android:pathData="M51.5,33 L56.5,33 L56.5,75 L51.5,75 Z" />
    <path
        android:fillColor="#F9F8F4"
        android:pathData="M39,45.5 L69,45.5 L69,50.5 L39,50.5 Z" />
</vector>
`,
  "utf8"
);

const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/oratorio_launcher_bg" />
    <foreground android:drawable="@drawable/oratorio_launcher_fg" />
</adaptive-icon>
`;

fs.writeFileSync(path.join(anydpiDir, "ic_launcher.xml"), adaptiveIconXml, "utf8");
fs.writeFileSync(path.join(anydpiDir, "ic_launcher_round.xml"), adaptiveIconXml, "utf8");

console.log(
  `Configured Android Gradle + Native Speech Bridge: versionName=${versionName}, versionCode=${versionCode}, signedRelease=${hasKeystore}, sdkDir=${sdkDir || "(env)"}`
);
