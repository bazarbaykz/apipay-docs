#!/usr/bin/env node
// check-parity.mjs — гейт двуязычной документации.
//
// Модель источников, которую этот скрипт защищает:
//   факты      → openapi.yaml / openapi-partner.yaml (зеркала канона бэкенда)
//   проза      → docs/ru/
//   английский → docs/en/, производное от docs/ru/
//
// Почему проверок четыре, а не одна. Сверки ru↔en НЕДОСТАТОЧНО: главы умеют врать
// согласованно — обе локали могут называть поле, которого в контракте нет либо которое
// принадлежит другой ручке. Паритет языков это пропускает, ловит только сверка с каноном.
//
// ⛔ Чего гейт НЕ ловит и не притворяется, что ловит: идентификатор, который в каноне
// есть, но применён не к той ручке — сверка идёт подстрокой по всему контракту. Против
// этого работает чтение главы рядом с каноном, а не регулярное выражение.
//
// Зависимостей нет намеренно: в репозитории нет package.json, и заводить его ради
// гейта не нужно. Всё на голом node.
//
// Режимы:
//   node scripts/check-parity.mjs              — полный прогон, exit 1 при находках
//   node scripts/check-parity.mjs --staged     — плюс co-change по застейдженному
//   node scripts/check-parity.mjs --base <ref> — плюс co-change против ветки (для CI)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RU = path.join(ROOT, 'docs/ru')
const EN = path.join(ROOT, 'docs/en')
const CANON_FILES = ['openapi.yaml', 'openapi-partner.yaml', 'llms.txt']
const ALLOW_PATH = path.join(ROOT, 'scripts/parity-allow.json')

const argv = process.argv.slice(2)
const STAGED = argv.includes('--staged')
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : null

const problems = []
const read = (p) => fs.readFileSync(p, 'utf-8')

/** Блоки кода вырезаем: внутри них живут значения примеров, а не термины контракта. */
function stripFences(src) {
  return src.replace(/^```[\s\S]*?^```/gm, '\n')
}

/**
 * Форма документа: последовательность уровней заголовков, число блоков кода и строк
 * таблиц. Сравнивать ТЕКСТ заголовков бесполезно — они на разных языках, и `diff`
 * показывает файл целиком изменённым. Форма же языко-независима.
 */
function shape(src) {
  return {
    levels: (src.match(/^#{1,6}(?= )/gm) || []).map((h) => h.length),
    fences: (src.match(/^```/gm) || []).length / 2,
    tableRows: (src.match(/^\|/gm) || []).length,
  }
}

/**
 * Машинные идентификаторы: `snake_case` в бэктиках и `METHOD /path`. Слова из одного
 * корня (`amount`, `status`) не берём — они и есть обычный текст, шум перевесил бы сигнал.
 *
 * ⚠️ Кавычки внутри бэктиков снимаем: одна локаль пишет `partially_refunded`, другая
 * `"partially_refunded"` — это один и тот же термин, и различие разметки не должно
 * выглядеть как расхождение контракта.
 */
function identifiers(src) {
  const body = stripFences(src)
  const ids = new Set()
  for (const m of body.matchAll(/`"?([a-z][a-z0-9]*(?:_[a-z0-9]+)+)"?`/g)) ids.add(m[1])
  for (const m of body.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[a-z0-9{}\/_-]+)/gi)) {
    ids.add(`${m[1].toUpperCase()} ${m[2]}`)
  }
  return ids
}

function loadAllow() {
  if (!fs.existsSync(ALLOW_PATH)) return { unknown_identifiers: [], shape_skip: [] }
  const raw = JSON.parse(read(ALLOW_PATH))
  return {
    unknown_identifiers: (raw.unknown_identifiers || []).map((e) => e.id),
    shape_skip: (raw.shape_skip || []).map((e) => e.chapter),
  }
}

// Оглавление и витрина — не главы: у двух локалей они законно устроены по-разному
// (русское оглавление ведёт на свои страницы примеров, английское — наружу на GitHub).
// Имена перечислены заранее: если оглавление и витрина однажды окажутся внутри docs/ru
// и docs/en, без этого списка гейт начал бы требовать от них построчного паритета.
const NOT_CHAPTERS = new Set(['SUMMARY', 'README'])

function chapters() {
  if (!fs.existsSync(RU)) return []
  return fs
    .readdirSync(RU)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .filter((f) => !NOT_CHAPTERS.has(f))
    .sort()
}

// ── 1. Структурный паритет ru↔en ──────────────────────────────────────────────
function checkShape(list, allow) {
  for (const ch of list) {
    if (allow.shape_skip.includes(ch)) continue
    const enPath = path.join(EN, `${ch}.md`)
    if (!fs.existsSync(enPath)) {
      problems.push(`${ch}: нет английской версии docs/en/${ch}.md`)
      continue
    }
    const a = shape(read(path.join(RU, `${ch}.md`)))
    const b = shape(read(enPath))
    const notes = []
    if (a.levels.join(',') !== b.levels.join(',')) {
      const i = a.levels.findIndex((v, k) => v !== b.levels[k])
      const at = i === -1 ? Math.min(a.levels.length, b.levels.length) : i
      notes.push(
        `структура заголовков расходится с ${at + 1}-го (ru ${a.levels.length}, en ${b.levels.length})`
      )
    }
    if (a.fences !== b.fences) notes.push(`блоков кода: ru ${a.fences}, en ${b.fences}`)
    if (a.tableRows !== b.tableRows) {
      notes.push(`строк таблиц: ru ${a.tableRows}, en ${b.tableRows}`)
    }
    if (notes.length) problems.push(`${ch}: ${notes.join('; ')}`)
  }
}

// ── 2. Множества идентификаторов ru↔en ────────────────────────────────────────
function checkIdentifierParity(list) {
  for (const ch of list) {
    const enPath = path.join(EN, `${ch}.md`)
    if (!fs.existsSync(enPath)) continue
    const a = identifiers(read(path.join(RU, `${ch}.md`)))
    const b = identifiers(read(enPath))
    const onlyRu = [...a].filter((x) => !b.has(x)).sort()
    const onlyEn = [...b].filter((x) => !a.has(x)).sort()
    if (onlyRu.length) problems.push(`${ch}: только в ru — ${onlyRu.join(', ')}`)
    if (onlyEn.length) problems.push(`${ch}: только в en — ${onlyEn.join(', ')}`)
  }
}

// ── 3. Сверка с каноном ───────────────────────────────────────────────────────
// Контракт лежит в этом же репозитории: три его файла кладёт сюда синхронизация,
// дословно. Доступ к репозиторию бэкенда гейту не нужен — он работает и в CI.
function checkAgainstCanon(list, allow) {
  const canon = CANON_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)))
    .map((f) => read(path.join(ROOT, f)))
    .join('\n')
  if (!canon) {
    problems.push('канонные файлы не найдены — сверка с контрактом невозможна')
    return
  }
  const unknown = new Map()
  for (const ch of list) {
    for (const loc of ['ru', 'en']) {
      const p = path.join(ROOT, `docs/${loc}/${ch}.md`)
      if (!fs.existsSync(p)) continue
      for (const id of identifiers(read(p))) {
        if (id.includes(' ')) continue // METHOD /path — свой формат, проверяется отдельно
        if (allow.unknown_identifiers.includes(id)) continue
        if (canon.includes(id)) continue
        if (!unknown.has(id)) unknown.set(id, new Set())
        unknown.get(id).add(`${loc}/${ch}`)
      }
    }
  }
  for (const [id, where] of [...unknown].sort()) {
    problems.push(`${id}: нет в каноне — встречается в ${[...where].sort().join(', ')}`)
  }
}

// ── 4. Co-change: правка русского обязана нести английский ────────────────────
function checkCoChange() {
  let changed = []
  try {
    const args = STAGED
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
      : ['diff', '--name-only', '--diff-filter=ACMR', `${BASE}...HEAD`]
    changed = execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8' }).split('\n').filter(Boolean)
  } catch {
    return // не git-окружение или нет базы — молча пропускаем
  }
  const touched = (dir) =>
    new Set(
      changed
        .filter((f) => f.startsWith(`docs/${dir}/`) && f.endsWith('.md'))
        .map((f) => path.basename(f, '.md'))
    )
  const ru = touched('ru')
  const en = touched('en')
  for (const ch of ru) {
    if (!en.has(ch)) problems.push(`${ch}: тронут docs/ru/${ch}.md, но не docs/en/${ch}.md`)
  }
  for (const ch of en) {
    if (!ru.has(ch)) problems.push(`${ch}: тронут docs/en/${ch}.md, но не docs/ru/${ch}.md`)
  }
}

// ── Прогон ────────────────────────────────────────────────────────────────────
const allow = loadAllow()
const list = chapters()
if (!list.length) {
  console.error('docs/ru не найден или пуст — проверять нечего')
  process.exit(1)
}

checkShape(list, allow)
checkIdentifierParity(list)
checkAgainstCanon(list, allow)
if (STAGED || BASE) checkCoChange()

if (problems.length) {
  console.error(`\n❌ Паритет документации нарушен (${problems.length}):\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error(
    '\nИсточник прозы — docs/ru/, английский производен от него; факты берутся из' +
      '\nopenapi.yaml и openapi-partner.yaml. Если формулировка законна, добавьте её' +
      `\nточной строкой с причиной в ${path.relative(ROOT, ALLOW_PATH)}.\n`
  )
  process.exit(1)
}

console.log(`✅ Паритет документации: ${list.length} глав, ru ↔ en ↔ канон.`)
