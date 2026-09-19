// مؤقّت: يتحقّق أن ملفات JSX المعدّلة تُحلَّل بنجاح باستخدام esbuild المرفق مع vite.
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const files = [
  'src/api.js',
  'src/AuthScreen.jsx',
  'src/CustomerRegister.jsx',
  'src/PharmacyRegister.jsx',
  'src/pages/LandingPage.jsx',
  'src/pages/ExplorePage.jsx',
  'src/App.jsx',
];

let failed = 0;
for (const file of files) {
  try {
    await transform(readFileSync(file, 'utf8'), {
      loader: file.endsWith('.jsx') ? 'jsx' : 'js',
      jsx: 'automatic',
      sourcefile: file,
    });
    console.log(`PARSE OK   ${file}`);
  } catch (error) {
    failed += 1;
    console.log(`PARSE FAIL ${file}`);
    for (const e of error.errors || []) {
      console.log(`   ${e.location?.line}:${e.location?.column} ${e.text}`);
    }
  }
}
console.log(failed ? `\n${failed} file(s) failed to parse` : '\nAll files parsed successfully');
process.exit(failed ? 1 : 0);
