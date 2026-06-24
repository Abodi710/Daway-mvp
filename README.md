# نظام «دواي» (Daway MVP)

مشروع SaaS مصغر لإدارة الصيدليات، مبني بواجهة عربية RTL ولوحة تحكم لإدارة الأدوية والتنبيهات والحسابات بشكل محمي.

## التقنيات المستخدمة
- Node.js
- Express
- SQLite3
- React عبر CDN
- Tailwind CSS عبر CDN

## طريقة التشغيل السريعة
1. تثبيت الاعتمادات:
   ```bash
   npm install
   ```
2. تشغيل الخادم محلياً:
   ```bash
   node server.js
   ```
3. أو باستخدام سكربت التشغيل:
   ```bash
   npm start
   ```

## ملاحظات التشغيل
- ملف الإعدادات `.env` يجب أن يحتوي على `PORT` و `JWT_SECRET`.
- قاعدة البيانات المحلية تُنشأ تلقائياً في الملف `daway.db`.
- يتم إنشاء نسخ احتياطية تلقائياً داخل مجلد `backups`.

## APIs الأساسية
### المصادقة
- `POST /api/register`
- `POST /api/login`
- `POST /api/change-password` (محمي)

### الأدوية
- `GET /api/medicines` (محمي)
- `POST /api/medicines` (محمي)
- `PUT /api/medicines/:id` (محمي)
- `DELETE /api/medicines/:id` (محمي)
- `GET /api/medicines/expiry-alerts` (محمي)
- `GET /api/medicines/low-stock` (محمي)

## مبدأ الأمان
- كل طلب محمي يحتاج إلى:
  ```http
  Authorization: Bearer <token>
  ```
- كل مستخدم يرى بياناته فقط عبر `user_id` المرتبط بالتوكن.
