// نقطة دخول متوافقة مع الأمر: node server.js
//
// package.json يحدد "type": "module"، لذلك يُعامل هذا الملف كوحدة ESM
// ولا تتوفر فيه الدالة require. الاستيراد الساكن يعمل مع ملفات CommonJS،
// و server.cjs يبدأ الخادم عند تحميله.
import './server.cjs';
