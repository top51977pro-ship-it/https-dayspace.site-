# מפת משפחה (FamilyMap) — אפליקציית מפה ומיקום למשפחה

אפליקציית אנדרואיד (APK) שמציגה את כל בני המשפחה על מפה חיה אחת — בסגנון Google Maps,
בעברית מלאה (RTL), בעיצוב כהה ומודרני.

מי שמקבל הזמנה (קוד בן 6 תווים / קישור / QR) מצטרף למשפחה ומופיע על המפה של כולם.

---

## מה יש באפליקציה

| | |
|---|---|
| 🗺️ **מפה מלאה** | 4 סגנונות מפה (מפה, לילה, לוויין, קלאסי), זום, סרגל קנה מידה, מיקום עצמי עם עיגול דיוק ומחוג כיוון |
| 🔎 **חיפוש** | חיפוש כתובות ומקומות (OpenStreetMap / Nominatim) + חיפוש בני משפחה |
| 🧭 **מסלולים** | חישוב מסלול נסיעה / הליכה / אופניים עם זמן ומרחק (OSRM), או פתיחה בניווט חיצוני |
| 👨‍👩‍👧‍👦 **מפת משפחה** | סמן לכל בן משפחה עם אווטאר, שם, מרחק ממך, כיוון, מהירות, מצב סוללה וזמן עדכון אחרון |
| ✉️ **הזמנות** | קוד הצטרפות, קישור, קוד QR ושיתוף ישיר לוואטסאפ |
| 🏠 **מקומות** | שמירת בית / בית ספר / עבודה עם רדיוס, והתראות מערכת בהגעה וביציאה |
| 🔔 **פעילות** | יומן הגעות, יציאות, הצטרפויות וקריאות מצוקה, מקובץ לפי יום |
| 🆘 **מצוקה** | שליחת מיקום דחוף לכל המשפחה בלחיצה + אישור |
| 👻 **פרטיות** | כיבוי שיתוף מיקום, מצב רפאים, ומסלול תנועה שנשמר רק במכשיר |

הכל בעברית, עם תמיכה מלאה ב-RTL, אזורים בטוחים (notch), ורטט/haptics.

---

## איך מקבלים את קובץ ה-APK

### דרך 1 — קישור הורדה ישיר (הכי פשוט)

כל בנייה מוצלחת מעדכנת אוטומטית את ה-release בשם `apk-latest`, ולכן הקישור הזה
תמיד מצביע על הגרסה האחרונה ואפשר לפתוח אותו ישירות מהטלפון, בלי להתחבר לגיטהאב:

```
https://github.com/top51977pro-ship-it/https-dayspace.site-/releases/download/apk-latest/familymap.apk
```

(הקישור הישן `dayspace-family.apk` ממשיך לעבוד ומצביע על אותו קובץ.)

פותחים בטלפון → הקובץ יורד → מאשרים "התקנה ממקור לא ידוע" → מתקינים.

אפשר גם להוריד את הארטיפקט **familymap-apk** מלשונית **Actions** (דורש
התחברות לגיטהאב), או להריץ את ה-workflow ידנית דרך **Run workflow**.
ה-workflow רץ אוטומטית בכל push שנוגע בתיקיית `app/`.

### דרך 2 — בנייה מקומית

צריך Node 20+, JDK 21 ו-Android SDK (הכי קל דרך Android Studio).

```bash
cd app
npm install
npm run build          # בניית ה-web bundle
npx cap sync android   # העתקה לפרויקט האנדרואיד
cd android
./gradlew assembleDebug
```

ה-APK ייווצר ב-`app/android/app/build/outputs/apk/debug/app-debug.apk`.

לפיתוח בדפדפן: `npm run dev` (הכל עובד חוץ מהתראות מערכת ורטט).

---

## איך המשפחה רואה אחד את השני

**זה עובד מיד אחרי ההתקנה, בלי הרשמה, בלי שרת ובלי הגדרות.**

1. אחד מבני המשפחה פותח את האפליקציה ולוחץ **"יוצרים משפחה"**
2. הוא מקבל קוד הזמנה בן 10 תווים, קישור וקוד QR — ושולח אותם בוואטסאפ
3. השאר מתקינים את אותו APK ובוחרים **"יש לי קוד הזמנה"**
4. מרגע זה כולם רואים אחד את השני על המפה, בזמן אמת

### איך זה עובד מתחת למכסה המנוע

אין לנו שרת. במקום זה האפליקציה מדברת עם **ברוקר MQTT ציבורי** (EMQX, ובגיבוי
HiveMQ) — שירות חינמי שמקבל חיבורים אנונימיים.

* **קוד ההזמנה הוא המפתח.** ממנו נגזרים גם הערוץ שהמשפחה מדברת עליו וגם מפתח
  הצפנה (PBKDF2 → AES-GCM 256).
* **כל הודעה מוצפנת מקצה לקצה.** מפעיל הברוקר, או מישהו שיאזין לכל הערוצים, יראה
  רק ג׳יבריש. בלי קוד ההזמנה אין שום דרך לקרוא מיקומים.
* **הודעות retained.** הברוקר שומר את הערך האחרון של כל נושא, ולכן מי שמצטרף מאוחר
  מקבל מיד את המיקום הנוכחי של כולם ואת כל המקומות השמורים.
* **10 תווים** מתוך אלפבית בן 32 = כ-50 ביט. ניחוש של קוד משפחה אינו מעשי.

### המחיר של הנוחות

הברוקר הציבורי הוא שירות חינמי במאמץ מיטבי (best effort). הוא בדרך כלל זמין, אבל
אף אחד לא מתחייב עליו. אם הוא לא זמין רגעית — האפליקציה מציגה "אין חיבור" וממשיכה
לנסות, והמיקומים מתעדכנים כשהחיבור חוזר.

מי שרוצה תשתית פרטית ומובטחת לחלוטין יכול להעביר את האפליקציה ל-Firebase לפי
ההוראות למטה. **זה לא חובה** — זו שדרוג, לא דרישה.

### מצב הדגמה (רשות)

לבנייה עם בני משפחה מדומים לצורך הדגמה בלבד:
`VITE_BACKEND=demo` לפני `npm run build`.

---

## שדרוג לתשתית פרטית: Firebase (רשות)

אם תעדיפו מסד נתונים פרטי משלכם במקום הברוקר הציבורי:

### שלב א׳ — פרויקט Firebase (כ-5 דקות)

1. נכנסים ל-[console.firebase.google.com](https://console.firebase.google.com) עם חשבון גוגל
   ולוחצים **Add project**. נותנים שם ומדלגים על Google Analytics.
2. **Build → Authentication → Get started → Sign-in method** → **Anonymous** → Enable → Save.
3. **Build → Realtime Database → Create Database**
   (⚠️ **Realtime Database**, לא Firestore) → בוחרים אזור → **Start in locked mode**.
4. לשונית **Rules** בתוך ה-Database → מדביקים את הכללים מהסעיף הבא → **Publish**.
5. **Project settings** → **Your apps** → אייקון **Web** (`</>`) → **Register app** →
   מקבלים בלוק `firebaseConfig`.

### שלב ב׳ — מחברים

בגיטהאב: **Settings → Secrets and variables → Actions → New repository secret**:

| שם הסוד | מאיפה לוקחים |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

ואז **Actions → Build Android APK → Run workflow**. אם הסודות קיימים, ה-APK נבנה
אוטומטית מול Firebase במקום הברוקר הציבורי.

בהגדרות → "על האפליקציה" רואים באיזה מצב סנכרון האפליקציה נמצאת. משפחה שנוצרה
בתשתית אחת לא קיימת בשנייה, ולכן אחרי מעבר האפליקציה מוחקת את המשפחה הישנה
ומבקשת ליצור אחת חדשה — זה מכוון.

לפיתוח מקומי במקום סודות בגיטהאב: יוצרים `app/.env` לפי `app/.env.example`.

### כללי אבטחה ל-Realtime Database

מזהה בן המשפחה הוא ה-`auth.uid` של ההתחברות האנונימית, כך שאפשר לאכוף שכל אחד כותב
רק את המיקום של עצמו, ורק חברי המשפחה קוראים אותה:

```json
{
  "rules": {
    "codes": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null && !data.exists()"
      }
    },
    "circles": {
      "$circleId": {
        ".read": "auth != null && data.child('members').child(auth.uid).exists()",
        "meta": {
          ".write": "auth != null && (!data.exists() || data.parent().child('members').child(auth.uid).exists())"
        },
        "members": {
          "$uid": {
            ".write": "auth != null && $uid === auth.uid"
          }
        },
        "places": {
          ".write": "auth != null && root.child('circles').child($circleId).child('members').child(auth.uid).exists()"
        },
        "events": {
          ".write": "auth != null && root.child('circles').child($circleId).child('members').child(auth.uid).exists()"
        }
      }
    }
  }
}
```

הזרימה שהכללים מאפשרים: מצטרף חדש קורא את `codes/<CODE>` → מקבל `circleId` → כותב את
רשומת החבר של עצמו → ומאותו רגע רשאי לקרוא את המשפחה.

---

## חתימת גרסת Release (רשות)

`assembleDebug` מספיק להתקנה ידנית. לחנות Google Play צריך APK/AAB חתום:

```bash
keytool -genkey -v -keystore familymap.keystore -alias familymap \
        -keyalg RSA -keysize 2048 -validity 10000

cd app/android
./gradlew assembleRelease \
  -PDAYSPACE_STORE_FILE=/path/to/familymap.keystore \
  -PDAYSPACE_STORE_PASSWORD=... \
  -PDAYSPACE_KEY_ALIAS=familymap \
  -PDAYSPACE_KEY_PASSWORD=...
```

ב-GitHub Actions: מגדירים את הסודות `ANDROID_KEYSTORE_BASE64` (הקובץ ב-base64),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, ומריצים את
ה-workflow ידנית עם `build_type = release`.

---

## מגבלה חשובה: מיקום ברקע

שיתוף המיקום פועל כשהאפליקציה **פתוחה או ברקע הקרוב**. אנדרואיד עוצר עדכוני מיקום
לאפליקציות שנסגרו לגמרי, ולכן המיקום של מי שסגר את האפליקציה יוצג כ"לא עודכן לאחרונה"
(הסמן מאפיר).

לשיתוף רציף גם כשהאפליקציה סגורה צריך foreground service עם התראה קבועה והרשאת
`ACCESS_BACKGROUND_LOCATION` — תוספת שדורשת קוד אנדרואיד נייטיב ואישור מיוחד מגוגל
לפרסום בחנות. האפליקציה מוכנה לכך מבחינת מבנה, אבל התוספת הזו לא נכללת בגרסה הזו.

---

## מבנה הקוד

```
app/
├── src/
│   ├── App.jsx                 מסך המפה הראשי וכל ניהול המצב של המסך
│   ├── main.jsx                נקודת כניסה, status bar, splash, deep links
│   ├── state/AppContext.jsx    מצב גלובלי: פרופיל, משפחה, מיקום, geofences, אירועים
│   ├── sync/                   שכבת backend מתחלפת
│   │   ├── index.js            בחירת ה-backend
│   │   ├── mqtt.js             ברירת המחדל: ברוקר ציבורי + הצפנה מקצה לקצה
│   │   ├── firebase.js         שדרוג פרטי: Realtime Database + anonymous auth
│   │   └── demo.js             backend מקומי + סימולציית בני משפחה
│   ├── lib/                    geo, geocode, routing, location, crypto, notify, storage
│   └── components/             MapView, SearchBar, FamilyDock, ה-sheets והרכיבים
├── tools/make-icons.mjs        מחולל אייקוני האפליקציה (PNG ללא כלים חיצוניים)
└── android/                    פרויקט Capacitor / Gradle
```

## שירותים חיצוניים

הכל ללא מפתח API וללא עלות:

* **סנכרון** — ברוקר MQTT ציבורי (EMQX / HiveMQ), עם הצפנת AES-GCM מקצה לקצה
* **מפות** — OpenStreetMap, CARTO, Esri World Imagery
* **חיפוש כתובות** — Nominatim (מוגבל לבקשה אחת לשנייה, עם cache מקומי)
* **מסלולים** — OSRM demo server (בכשל — חוזר לחישוב קו אווירי מסומן כ"הערכה")

לשימוש בהיקף גדול כדאי להחליף אותם בשירותים בתשלום או ב-instance עצמאי.
