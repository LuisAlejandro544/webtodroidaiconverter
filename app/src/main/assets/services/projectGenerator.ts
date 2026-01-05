import { AppConfig, AndroidPermissions } from "../types";

// Plantilla básica de AndroidManifest
const generateManifest = (config: AppConfig, perms: AndroidPermissions) => `
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${config.packageName}">

    <uses-permission android:name="android.permission.INTERNET" />
    ${perms.usesCamera ? '<uses-permission android:name="android.permission.CAMERA" />' : ''}
    ${perms.usesLocation ? '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />' : ''}
    ${perms.usesMicrophone ? '<uses-permission android:name="android.permission.RECORD_AUDIO" />' : ''}
    ${perms.usesStorage ? '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />' : ''}
    ${perms.customPermissions.map(p => `<uses-permission android:name="${p}" />`).join('\n    ')}

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${config.appName}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`;

// Plantilla de MainActivity (Java)
const generateMainActivity = (config: AppConfig, perms: AndroidPermissions) => `
package ${config.packageName};

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView myWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        myWebView = findViewById(R.id.webview);
        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        
        ${perms.usesLocation ? 'webSettings.setGeolocationEnabled(true);' : ''}
        
        myWebView.setWebViewClient(new WebViewClient());
        
        // Load the local asset file (index.html)
        myWebView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (myWebView.canGoBack()) {
            myWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
`;

// Plantilla de Layout
const generateLayout = () => `
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</androidx.constraintlayout.widget.ConstraintLayout>
`;

// Plantilla Gradle (Nivel App)
const generateBuildGradle = (config: AppConfig) => `
plugins {
    id 'com.android.application'
}

android {
    namespace '${config.packageName}'
    compileSdk 33

    defaultConfig {
        applicationId "${config.packageName}"
        minSdk 24
        targetSdk 33
        versionCode 1
        versionName "${config.versionName}"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}
`;

// Plantilla GitHub Actions (CI/CD)
const generateGithubWorkflow = (config: AppConfig) => `
name: Build Android APK

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
        cache: gradle

    - name: Setup Gradle
      uses: gradle/gradle-build-action@v2
    
    # Dado que no incluimos el wrapper en el zip generado por JS, usamos gradle directamente
    - name: Build Debug APK
      run: gradle app:assembleDebug

    - name: Upload APK
      uses: actions/upload-artifact@v3
      with:
        name: ${config.appName}-debug-apk
        path: app/build/outputs/apk/debug/app-debug.apk
`;

/**
 * Función principal para crear el ZIP
 */
export const generateProjectZip = async (config: AppConfig, perms: AndroidPermissions) => {
    if (!window.JSZip) {
        throw new Error("JSZip library not loaded");
    }

    const zip = new window.JSZip();
    const folderName = config.appName.replace(/\s+/g, '_');
    const root = zip.folder(folderName);

    // 1. Android App Structure
    const app = root.folder("app");
    const src = app.folder("src");
    const main = src.folder("main");

    // AndroidManifest.xml
    main.file("AndroidManifest.xml", generateManifest(config, perms));

    // Java Code
    const javaPath = config.packageName.replace(/\./g, "/");
    const javaFolder = main.folder(`java/${javaPath}`);
    javaFolder.file("MainActivity.java", generateMainActivity(config, perms));

    // Res (Layout)
    const res = main.folder("res");
    const layout = res.folder("layout");
    layout.file("activity_main.xml", generateLayout());

    // Assets (The User's Web App)
    const assets = main.folder("assets");

    // LÓGICA DE ASSETS: HTML Simple vs ZIP Completo
    if (config.zipFile) {
        // Si el usuario subió un ZIP, extraemos TODO su contenido en assets/
        try {
            const uploadedZip = await new window.JSZip().loadAsync(config.zipFile);
            const files = uploadedZip.files;
            
            // Iteramos sobre cada archivo en el zip subido
            const promises = Object.keys(files).map(async (filename) => {
                const file = files[filename];
                if (!file.dir) { // Ignorar carpetas vacías, JSZip las crea auto si hay archivos
                    const content = await file.async("blob");
                    assets.file(filename, content);
                }
            });
            await Promise.all(promises);

        } catch (e) {
            console.error("Error injectando ZIP assets", e);
            // Fallback si falla
            assets.file("index.html", config.htmlContent || "<h1>Error loading assets</h1>");
        }
    } else {
        // Modo simple: Solo un archivo HTML
        assets.file("index.html", config.htmlContent);
    }

    // Build Files
    app.file("build.gradle", generateBuildGradle(config));
    
    // Icon (Si existe)
    if (config.iconUrl && config.iconUrl.startsWith('data:image')) {
        // Convertir base64 a blob para el zip
        const base64Data = config.iconUrl.split(',')[1];
        const mipmap = res.folder("mipmap-xxhdpi"); // Simplificación: solo una densidad
        mipmap.file("ic_launcher.png", base64Data, {base64: true});
        mipmap.file("ic_launcher_round.png", base64Data, {base64: true});
    }

    // --- MAGIA DE GITHUB ACTIONS ---
    // Añadimos la carpeta .github/workflows para que GitHub compile la app automáticamente
    const github = root.folder(".github");
    const workflows = github.folder("workflows");
    workflows.file("build_apk.yml", generateGithubWorkflow(config));

    // Generar archivo
    const content = await zip.generateAsync({type:"blob"});
    window.saveAs(content, `${folderName}_AndroidProject.zip`);
};