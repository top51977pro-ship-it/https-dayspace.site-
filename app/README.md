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

## מצב הדגמה מול מצב ענן

האפליקציה עובדת **מיד אחרי ההתקנה**, בלי שרת ובלי הרשמה:

* **מצב הדגמה (ברירת מחדל)** — הנתונים נשמרים במכשיר בלבד, ועל המפה מופיעים שלושה
  בני משפחה מדומים שמסתובבים סביבכם. מצוין כדי לראות איך הכל נראה ועובד.
* **מצב ענן** — שיתוף מיקום אמיתי בזמן אמת בין מכשירים שונים. דורש פרויקט Firebase
  משלכם (חינמי), כמתואר למטה.

באפליקציה מופיעה כותרת צהובה כשהיא במצב הדגמה, וגם בהגדרות → "על האפליקציה".

---

## איך עוברים ממשפחה מדומה למשפחה אמיתית (Firebase)

זה השלב היחיד שדורש חשבון חיצוני, והוא חינמי לחלוטין בהיקף של משפחה.
**רק אדם אחד במשפחה עושה את זה** — כל השאר פשוט מתקינים את האפליקציה.

### שלב א׳ — פרויקט Firebase (כ-5 דקות)

1. נכנסים ל-[console.firebase.google.com](https://console.firebase.google.com) עם חשבון גוגל
   ולוחצים **Add project**. נותנים שם (למשל `family-map`) ומדלגים על Google Analytics.
2. בתפריט הצד: **Build → Authentication → Get started → Sign-in method**,
   בוחרים **Anonymous** ומפעילים (Enable → Save).
3. בתפריט הצד: **Build → Realtime Database → Create Database**
   (⚠️ **Realtime Database**, לא Firestore). בוחרים אזור, ואז **Start in locked mode**.
4. עוברים ללשונית **Rules** בתוך ה-Database, מוחקים את מה שיש ומדביקים את הכללים
   מהסעיף הבא, ולוחצים **Publish**.
5. חוזרים ל-**Project settings** (גלגל השיניים למעלה) → גוללים ל-**Your apps** →
   לוחצים על אייקון ה-**Web** (`</>`) → נותנים כינוי → **Register app**.
   מופיע בלוק קוד עם `firebaseConfig` — משאירים אותו פתוח, צריך אותו בשלב הבא.

### שלב ב׳ — מחברים את האפליקציה (כ-2 דקות)

בגיטהאב: **Settings → Secrets and variables → Actions → New repository secret**.
מוסיפים חמישה סודות, כשהערכים מגיעים מה-`firebaseConfig` שראיתם:

| שם הסוד | מאיפה לוקחים |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

> אם `databaseURL` לא מופיע ב-`firebaseConfig`, מעתיקים אותו מראש עמוד ה-Realtime
> Database. הוא נראה כמו `https://<project>-default-rtdb.firebaseio.com`.

### שלב ג׳ — בונים מחדש ומתקינים

1. **Actions → Build Android APK → Run workflow**
2. מחכים ~3 דקות. באותו קישור הורדה כבר יושבת הגרסה החדשה.
3. כל בני המשפחה מורידים ומתקינים מהקישור הזה.
4. אחד יוצר משפחה ושולח את קוד ההזמנה, השאר בוחרים **"יש לי קוד הזמנה"**.

**איך יודעים שזה עבד:** הכותרת הצהובה "מצב הדגמה" נעלמת, אין יותר נועה/איתי/סבתא רות
על המפה, ובהגדרות → "על האפליקציה" כתוב **מצב סנכרון: ענן (זמן אמת)**.

אם היה לכם קודם משפחת הדגמה על המכשיר, האפליקציה תזהה את המעבר, תמחק אותה ותציג
הודעה שמבקשת ליצור משפחה חדשה — זה תקין ומכוון.

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
│   │   ├── index.js            בחירה בין demo ל-firebase
│   │   ├── demo.js             backend מקומי + סימולציית בני משפחה
│   │   └── firebase.js         Realtime Database + anonymous auth
│   ├── lib/                    geo, geocode, routing, location, notify, storage, device
│   └── components/             MapView, SearchBar, FamilyDock, ה-sheets והרכיבים
├── tools/make-icons.mjs        מחולל אייקוני האפליקציה (PNG ללא כלים חיצוניים)
└── android/                    פרויקט Capacitor / Gradle
```

## שירותים חיצוניים

הכל ללא מפתח API וללא עלות:

* **מפות** — OpenStreetMap, CARTO, Esri World Imagery
* **חיפוש כתובות** — Nominatim (מוגבל לבקשה אחת לשנייה, עם cache מקומי)
* **מסלולים** — OSRM demo server (בכשל — חוזר לחישוב קו אווירי מסומן כ"הערכה")

לשימוש בהיקף גדול כדאי להחליף אותם בשירותים בתשלום או ב-instance עצמאי.
