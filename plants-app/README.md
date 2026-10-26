# 🪴 הג'ונגל שלי

אפליקציית PWA בעברית (RTL) לניהול צמחי בית: זיהוי צמח מתמונה, אבחון מצב לפי תמונה ו/או תיאור מילולי, מאגר אישי, תזכורות השקיה והזנה, המלצות לפי תנאי הבית ויומן צמיחה.

- **זיהוי ואבחון:** Claude Vision דרך שרת ביניים. אין אימון מודל: הפרומפטים מחזירים JSON מובנה (`output_config.format`), מאומת ב-zod, בתוספת מאגר ידע מקומי (`server/src/knowledge/plants.json`) שמשלים רעילות כשהמודל לא בטוח.
- **המפתח לא באפליקציה.** `ANTHROPIC_API_KEY` נשאר בשרת בלבד.
- **ללא מפתחות הכול רץ:** בלי `ANTHROPIC_API_KEY` נעשה שימוש במודל מדומה, ובלי `DATABASE_URL` ב-SQLite מקומי.

## הרצה מקומית
```bash
cd plants-app
npm install
npm run dev          # שרת :8787 + Vite :5173 (פרוקסי ל-/api)
npm test             # בדיקות יחידה ו-API
npm run typecheck
```
פתחו http://localhost:5173, הירשמו (אימייל וסיסמה) והתחילו לסרוק.

## משתני סביבה (`.env.example`)
| משתנה | תיאור |
|---|---|
| `ANTHROPIC_API_KEY` | מפתח Anthropic. בלעדיו: מודל מדומה |
| `MODEL_ID` | ברירת מחדל `claude-opus-5-5`. לחיסכון בעלות אפשר `claude-sonnet-5-5` |
| `DATABASE_URL` | חיבור Postgres בענן (Supabase/Neon). בלעדיו SQLite ב-`./data` |
| `JWT_SECRET` | חובה בפרודקשן. מחרוזת אקראית ארוכה |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | התראות Push. ליצירה: `npx web-push generate-vapid-keys` |

## פריסה לענן
1. צרו מסד Postgres ב-Supabase או Neon והעתיקו את מחרוזת החיבור ל-`DATABASE_URL`. הטבלאות נוצרות אוטומטית בעליית השרת.
2. `npm run build` בונה את ה-PWA ל-`dist/`, והשרת מגיש אותו בעצמו. אפשר לפרוס שירות Node יחיד (Render, Fly.io, Railway) עם `npm start`.
3. הגדירו את משתני הסביבה בשירות. **חובה HTTPS** כדי שהתקנת PWA והתראות יעבדו.
4. באייפון התראות Push עובדות רק אחרי "הוסף למסך הבית" (iOS 16.4 ומעלה).

## ארכיטקטורה
```
shared/   סכמות zod, חישובי טיפול (adjustInterval), טקסטים
server/   Fastify: auth (scrypt + JWT), plants, identify/diagnose, tasks, push, jobs
web/      PWA בלי ספריות: Vite + TypeScript, manifest, service worker
tests/    Vitest: יחידה ו-API (כולל בידוד בין משתמשים)
```
תמונות נשמרות במסד (base64, מכווצות ל-1600px בצד הלקוח) ומוגשות רק למשתמש הבעלים, כך שהכול עובד על שירות אחד בלי אחסון קבצים נפרד.

## עלות משוערת
בקשת זיהוי או אבחון עם תמונה מכווצת היא בסדר גודל של אלפי טוקנים. ב-`claude-opus-5-5` ($4/$20 למיליון טוקנים) זה כמה אגורות לבקשה, וב-`claude-sonnet-5-5` ($2/$10) כמחצית. יש הגבלת קצב לכל משתמש, והפרומפט הסטטי נשמר ב-cache.

## אזהרה
זה מידע כללי בלבד, ולא ייעוץ וטרינרי או רפואי. במקרה של הרעלה פנו לווטרינר או למרכז הרעלות.

## מה נבדק ומה לא
נבדקו אוטומטית: לוגיקה, API, בידוד בין משתמשים, וזרימת דפדפן מלאה (Chromium) עם מודל מדומה. **לא נבדקו בסביבת הפיתוח** ודורשים בדיקה ידנית שלכם: זיהוי אמיתי עם מפתח Anthropic, Postgres בענן, והתראת Push אמיתית בטלפון.
