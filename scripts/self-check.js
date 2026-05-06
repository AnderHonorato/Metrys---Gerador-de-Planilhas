const fs = require('fs');
const path = require('path');

const checks = [
  ['electron', () => require.resolve('electron')],
  ['pdfjs-dist', () => require.resolve('pdfjs-dist/package.json')],
  ['@napi-rs/canvas', () => require.resolve('@napi-rs/canvas')],
  ['sharp', () => require.resolve('sharp')],
  ['tesseract.js', () => require.resolve('tesseract.js')],
  ['exceljs', () => require.resolve('exceljs')],
];

let failed = false;
for (const [name, check] of checks) {
  try {
    check();
    console.log(`[OK] ${name}`);
  } catch (error) {
    failed = true;
    console.error(`[ERRO] ${name}: ${error.message}`);
  }
}

const langCandidates = [
  path.join(process.cwd(), 'tessdata'),
  path.join(process.cwd(), 'node_modules', '@tesseract.js-data', 'por'),
  path.join(process.cwd(), 'node_modules', '@tesseract.js-data', 'eng'),
];

const hasLang = langCandidates.some((candidate) => fs.existsSync(candidate));
if (hasLang) console.log('[OK] dados de idioma OCR locais encontrados');
else console.warn('[ALERTA] dados de idioma OCR nao encontrados em tessdata/node_modules');

if (failed) process.exit(1);
