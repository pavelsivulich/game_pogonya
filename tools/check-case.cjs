#!/usr/bin/env node
/**
 * Проверка регистра путей (защита от битых ссылок на Linux-сервере/GitHub Pages).
 *
 * Собирает из исходников все ссылки на файлы и сверяет каждый путь с
 * реальным именем файла на диске — побайтово, с учётом регистра.
 *
 * Правила разрешения путей:
 *   HTML src=/href=, CSS url()      — относительно файла;
 *   JS import/export from            — относительно файла (ES-модули);
 *   JS img.src=, fetch(), new Audio  — браузерные URL от корня проекта.
 *
 * Запуск:  node tools/check-case.cjs
 * Выход:   0 — всё ок; 1 — найдены расхождения.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_EXT = ['.html', '.css', '.js'];

/** Все исходники проекта (без node_modules, tools). */
function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'tools') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (SRC_EXT.includes(path.extname(name))) acc.push(p);
  }
  return acc;
}

/** Внешние/специальные ссылки, которые не проверяем. */
function skipRef(ref) {
  return /^(https?:|data:|#|\/\/|node:|npm:)/.test(ref) || !ref;
}

/** Пути, на которые ссылается файл: [{abs, kind}]. */
function extractRefs(file, src) {
  const refs = [];
  const dir = path.dirname(file);
  const isCss = file.endsWith('.css');
  const isHtml = file.endsWith('.html');
  const clean = (r) => r.trim().split('?')[0].split('#')[0];

  if (isCss) {
    for (const m of src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      const ref = clean(m[1]);
      if (!skipRef(ref)) refs.push(path.normalize(path.join(dir, ref)));
    }
    return refs;
  }

  // HTML-атрибуты и в HTML, и в JS (строковые шаблоны) — от корня для JS,
  // от файла для HTML.
  if (isHtml) {
    for (const m of src.matchAll(/(?:src|href)\s*=\s*['"]([^'"]+)['"]/g)) {
      const ref = clean(m[1]);
      if (!skipRef(ref)) refs.push(path.normalize(path.join(dir, ref)));
    }
    return refs;
  }

  // JS: import/export from — относительно файла; резолвим только относительные
  // пути ('./', '../'), голые спецификаторы (node:, npm:, библиотеки) пропускаем.
  for (const m of src.matchAll(/(?:import|export)\s+[^'"]*?from\s*['"]([^'"]+)['"]/g)) {
    const ref = clean(m[1]);
    if (skipRef(ref) || !ref.startsWith('.')) continue;
    refs.push(path.normalize(path.join(dir, ref)));
  }
  for (const m of src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const ref = clean(m[1]);
    if (skipRef(ref) || !ref.startsWith('.')) continue;
    refs.push(path.normalize(path.join(dir, ref)));
  }
  // JS: браузерные URL — img.src=, fetch(), new Audio() — от корня проекта.
  const urlPatterns = [
    /\.src\s*=\s*['"]([^'"]+)['"]/g,
    /fetch\s*\(\s*['"]([^'"]+)['"]/g,
    /new\s+Audio\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of urlPatterns) {
    for (const m of src.matchAll(re)) {
      const ref = clean(m[1]);
      if (skipRef(ref)) continue;
      refs.push(path.normalize(path.join(ROOT, ref)));
    }
  }
  return refs;
}

/** Побайтовая сверка пути с диском (регистр каждого сегмента). */
function checkCase(absPath) {
  const rel = path.relative(ROOT, absPath);
  if (rel.startsWith('..')) return null;                   // вне проекта
  let cur = ROOT;
  for (const part of rel.split(path.sep)) {
    cur = path.join(cur, part);
    if (!fs.existsSync(cur)) {
      const parent = path.dirname(cur);
      const want = path.basename(cur);
      const siblings = fs.existsSync(parent) ? fs.readdirSync(parent) : [];
      const match = siblings.find((s) => s.toLowerCase() === want.toLowerCase());
      return match === undefined
        ? { type: 'missing', path: rel }                   // файла нет вообще
        : { type: 'case', path: rel, actual: match };      // есть, но другой регистр
    }
  }
  return null;
}

const problems = [];
const checked = new Set();

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const ref of extractRefs(file, src)) {
    if (checked.has(ref)) continue;
    checked.add(ref);
    const p = checkCase(ref);
    if (p) problems.push({ ...p, from: path.relative(ROOT, file) });
  }
}

if (!problems.length) {
  console.log(`OK: проверено ссылок — ${checked.size}, расхождений регистра нет.`);
  process.exit(0);
}

console.error(`НАЙДЕНО ПРОБЛЕМ: ${problems.length}\n`);
for (const p of problems) {
  if (p.type === 'case') {
    console.error(`  РЕГИСТ: "${p.path}" (в ${p.from})`);
    console.error(`          на диске: "${p.actual}"\n`);
  } else {
    console.error(`  НЕТ ФАЙЛА: "${p.path}" (в ${p.from})\n`);
  }
}
process.exit(1);
