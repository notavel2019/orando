import fs from "fs";
import path from "path";

const versionCode = Number(process.env.ANDROID_VERSION_CODE || "1");
const versionName = String(process.env.ANDROID_VERSION_NAME || "1.0.0").replace(/[^0-9A-Za-z._-]/g, "");
const hasKeystore = Boolean(process.env.ORATORIO_KEYSTORE_PATH && fs.existsSync(process.env.ORATORIO_KEYSTORE_PATH));

const buildGradlePath = path.resolve("android", "app", "build.gradle");
const manifestPath = path.resolve("android", "app", "src", "main", "AndroidManifest.xml");

if (!fs.existsSync(buildGradlePath)) {
  console.error("android/app/build.gradle not found. Run `npx cap add android` first.");
  process.exit(1);
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
console.log(
  `Configured Android Gradle: versionName=${versionName}, versionCode=${versionCode}, signedRelease=${hasKeystore}`
);

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf8");
  if (!manifest.includes("android.permission.REQUEST_INSTALL_PACKAGES")) {
    manifest = manifest.replace(
      /<manifest([^>]*)>/,
      `<manifest$1>\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />`
    );
    fs.writeFileSync(manifestPath, manifest, "utf8");
    console.log("Added REQUEST_INSTALL_PACKAGES permission to AndroidManifest.xml");
  }
}
