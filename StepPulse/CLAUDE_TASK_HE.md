# משימה ל-Claude — בניית StepPulse ל-APK

קיבלת פרויקט Android Native מלא בשם **StepPulse**.

## המטרה

1. לפתוח ולבדוק את כל הפרויקט.
2. לבצע Gradle Sync ולפתור כל שגיאת קומפילציה שקיימת.
3. לשמור על האפליקציה כ־Android Native ב־Kotlin ו־Jetpack Compose — אין להפוך אותה ל־WebView, אתר או PWA.
4. לשמור על העיצוב הכהה, האנימציות, הממשק העברי ו־RTL.
5. לוודא שספירת הצעדים עובדת דרך Health Connect, עם גיבוי דרך TYPE_STEP_COUNTER והרשאת ACTIVITY_RECOGNITION.
6. לוודא שאין ספירה כפולה של צעדים ושאין פתיחה של כמה מאזיני חיישן במקביל.
7. לבנות APK אמיתי שניתן להתקין באנדרואיד.
8. להחזיר לי את קובץ ה־APK עצמו, ולא רק הוראות.

## דרישות בנייה

- applicationId: `com.nevo.steppulse`
- minSdk: 26
- targetSdk: 35
- compileSdk: 35
- Java/JVM: 17
- Build variant מועדף לבדיקה: `debug`
- פלט צפוי: `app/build/outputs/apk/debug/app-debug.apk`

## בדיקות שחייבים לבצע

- האפליקציה נפתחת בלי קריסה.
- מסך הבית מוצג בעברית ובכיוון RTL.
- לחצן הרשאת הכושר מפעיל את Health Connect כאשר הוא זמין.
- במכשיר ללא Health Connect, האפליקציה יכולה להשתמש בחיישן הצעדים המקומי.
- טבעת ההתקדמות והמספרים מונפשים.
- שינוי יעד הצעדים נשמר לאחר סגירה ופתיחה.
- הגרף השבועי נטען.
- אין הרשאת אינטרנט ואין שליחת מידע לשרת.

## פקודת בנייה

נסה קודם:

```bash
./gradlew :app:assembleDebug
```

אם אין Gradle Wrapper, השתמש ב־Gradle 8.10.2:

```bash
gradle :app:assembleDebug
```

ב־Windows אפשר גם להפעיל:

```text
BUILD_APK_WINDOWS.bat
```

## כלל חשוב

אל תסתפק בהסבר. בצע את הבנייה בפועל והחזר את ה־APK. אם סביבת העבודה שלך חסרה Android SDK, התקן או הגדר את SDK הנדרש אם הדבר מותר; אחרת החזר פירוט מדויק של החסם, אבל אל תציג קובץ מזויף כ־APK.
