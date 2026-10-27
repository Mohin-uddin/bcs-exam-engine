# সোনার হরিণ (Sonar Horin) Android App: APK build guide (Banglish)

Ei Android app ta **Capacitor** diye banano. App er vitore amader web app (`src/web`) load hoy,
tai practice, model test, live exam, OMR scanner, merit list sob kichu web er motoi kaj kore,
ar ekbar web e kono change deploy korle app update na korleo user notun version pay.

**Keno Capacitor?** Amader puro UI already HTML/JS e lekha. Kotlin/Flutter e abar notun kore
likhle 2 ta alada codebase maintain korte hoto. Capacitor ekta real native Android project
(`android/` folder) banay, splash screen, app icon, camera permission, back button sob native,
ar Play Store e normal app er motoi publish kora jay.

## Payment niye important (Google Play policy)

App er vitore **kono bKash/Nagad payment UI thakbe na**. App shudhu login kore ar user unlocked
kina seta dekhay. Payment hobe website e (browser e). Web page e payment er button/modal/section e
`data-payment` attribute (ba `class="payment-only"`) dile app e eta automatic hide hoye jabe
(`src/web/public/native-app.js` eta kore). App e dekhanor jonno ekta lekha rakhte chaile
`class="app-unlock-note"` diye rakhun, jemon: "Unlock korte website e login korun".

## Ekbar setup (prothom bar)

1. **Android Studio** install korun (latest version): https://developer.android.com/studio
   Install er shomoy Android SDK, Platform 36 ar build-tools auto install hobe.
2. **JDK 21** lage. Android Studio er sathe built-in JDK ashe, alada install na korleo cholbe.
3. **Node.js 22+** lage (`node -v` diye check korun).
4. Project folder e terminal khule:
   ```bash
   cd ~/Documents/antigravity/adventurous-archimedes
   npm install
   ```

## App kon website load korbe seta set korun

Web app ta age kothao deploy korte hobe (https sho). Tarpor:

```bash
npm run app:url -- https://apnar-domain.com
npx cap sync android
```

Local test (emulator theke laptop er server): age `npm start` chalan, tarpor
```bash
npm run app:url -- http://10.0.2.2:3000
npx cap sync android
```
(Real phone e test korle `10.0.2.2` er jaygay laptop er Wi-Fi IP din, jemon `http://192.168.0.105:3000`.
Phone ar laptop eki Wi-Fi te thakte hobe.) Play Store e dewar age obossoi abar https URL set korben.

## Debug APK banano (nijer phone e test korar jonno)

**Option A: Android Studio diye (shohoj)**
```bash
npx cap open android
```
Android Studio khulle Gradle sync shesh howa porjonto opekkha korun. Tarpor menu theke
**Build > Build App Bundle(s) / APK(s) > Build APK(s)**. Shesh hole "locate" e click korle APK
paben: `android/app/build/outputs/apk/debug/app-debug.apk`.
Phone USB diye lagiye (Developer options > USB debugging on) green ▶ Run button chaplei
direct phone e install hobe.

**Option B: Terminal diye**
```bash
npm run android:apk
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Eta WhatsApp/Drive diye phone e
pathiye install korte parben ("Install unknown apps" allow korte hobe).

## Release build (Play Store er jonno)

1. Ekbar ekta signing key banan (eta **kokhono haraben na**, backup rakhun):
   ```bash
   keytool -genkey -v -keystore sonarhorin-release.jks -alias sonarhorin -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Android Studio te **Build > Generate Signed App Bundle / APK > Android App Bundle**,
   `sonarhorin-release.jks` select korun, password din, **release** choose korun.
3. Output: `android/app/release/app-release.aab`. Play Console e eta upload korben.
4. Notun version dile `android/app/build.gradle` e `versionCode` 1 barate hobe
   (ar `versionName` jemon "1.0.1").

Play Store listing er jonno chobi `branding/` folder e ache:
`play-store-icon-512.png`, `play-feature-graphic-1024x500.png`.

## Splash screen, icon, naam kothay change korben

| Ki | Kothay |
|---|---|
| App er naam (icon er niche) | `android/app/src/main/res/values/strings.xml` (`app_name`) |
| Package id (`com.sonarhorin.app`) | `capacitor.config.json` `appId` + `android/app/build.gradle` (Play Store e upload er por ar change kora jay na) |
| Splash kotokkhon thakbe | `capacitor.config.json` > `plugins.SplashScreen.launchShowDuration` (ms) |
| Splash chobi (Android 7–11) | `android/app/src/main/res/drawable*/splash.png` |
| Splash icon (Android 12+) | `android/app/src/main/res/drawable-*/splash_icon.png`, background color `values/colors.xml` er `brandPaper` |
| App icon | `android/app/src/main/res/mipmap-*/` (master SVG: `branding/logo-mark.svg`) |
| Internet na thakle page | `mobile/www/offline.html` |

`capacitor.config.json` ba `mobile/www` change korar por protibar `npx cap sync android` chalaben.

## Common problem

- **App sada/blank ba "internet nei" dekhay:** `npm run app:url` e dewa URL phone er browser e
  khule dekhun khole kina. Local http URL hole `npx cap sync android` abar chalan.
- **OMR scanner camera khule na:** prothom bar app camera permission chaibe, Allow din.
  Camera shudhu https URL (ba localhost) e kaj kore.
- **`SDK location not found`:** Android Studio diye ekbar `android/` folder ta open korun,
  o nije `local.properties` banabe.
- **Gradle error "Unsupported Java":** Android Studio > Settings > Build Tools > Gradle >
  Gradle JDK te built-in JDK 21 select korun.
