#!/usr/bin/env node
// check-parity.mjs — the bilingual documentation gate.
//
// The model this script protects:
//   facts    → openapi.yaml / openapi-partner.yaml (verbatim mirrors of the API contract)
//   prose    → docs/ru/
//   English  → docs/en/, derived from docs/ru/
//
// Why four checks rather than one. Comparing the two locales against each other is not
// enough: chapters can be wrong in agreement — both locales may name a field the contract
// does not have, or one that belongs to a different endpoint. Locale parity sails past
// that; only the comparison against the contract catches it.
//
// ⛔ What the gate does NOT catch, and does not pretend to: an identifier that exists in
// the contract but is applied to the wrong endpoint — the lookup is a substring match over
// the whole contract. Against that, only reading the chapter next to the contract helps.
//
// No dependencies on purpose: this repository has no package.json and does not need one
// for a gate. Plain Node is enough.
//
// Modes:
//   node scripts/check-parity.mjs              — full run, exit 1 on findings
//   node scripts/check-parity.mjs --staged     — plus co-change over staged files
//   node scripts/check-parity.mjs --base <ref> — plus co-change against a branch (CI)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RU = path.join(ROOT, 'docs/ru')
const EN = path.join(ROOT, 'docs/en')
const CONTRACT_FILES = ['openapi.yaml', 'openapi-partner.yaml', 'llms.txt']
const ALLOW_PATH = path.join(ROOT, 'scripts/parity-allow.json')

const argv = process.argv.slice(2)
const STAGED = argv.includes('--staged')
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : null

const problems = []
const read = (p) => fs.readFileSync(p, 'utf-8')

/** Fenced blocks are stripped: they hold example values, not contract terms. */
function stripFences(src) {
  return src.replace(/^```[\s\S]*?^```/gm, '\n')
}

/**
 * The shape of a document: the sequence of heading levels, the number of fenced blocks and
 * the number of table rows. Comparing heading TEXT is useless — the two locales are in
 * different languages and a plain diff reports the whole file as changed. Shape is not.
 *
 * ⚠️ Headings and table rows are counted with fenced blocks removed. A shell example is
 * full of `# step one` comments, and counting those as level-1 headings makes the check
 * both noisy and misleading: dropping a comment from an example would fail the gate with
 * «heading structure diverges at #7», pointing nowhere near the cause. Fences themselves
 * are counted on the original text, before they are stripped.
 */
function shape(src) {
  const prose = stripFences(src)
  return {
    levels: (prose.match(/^#{1,6}(?= )/gm) || []).map((h) => h.length),
    fences: (src.match(/^```/gm) || []).length / 2,
    tableRows: (prose.match(/^\|/gm) || []).length,
  }
}

/**
 * Machine identifiers: `snake_case` inside backticks, and `METHOD /path`. Single words
 * (`amount`, `status`) are left out — they are ordinary prose, and the noise would drown
 * the signal.
 *
 * ⚠️ Quotes inside backticks are trimmed: one locale writes `partially_refunded`, the other
 * `"partially_refunded"`. Same term; a difference in markup must not read as a difference
 * in the contract.
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

// The table of contents and the landing page are not chapters: the two locales are allowed
// to build them differently (the Russian summary links to its own example pages, the
// English one links out to GitHub). Listed ahead of time so that, should the summary and
// the landing page ever move inside docs/ru and docs/en, the gate does not start demanding
// line-by-line parity from them.
const NOT_CHAPTERS = new Set(['SUMMARY', 'README'])

// Walks the whole space, not just its top level: each space also holds subdirectories
// (code examples, reference pages), and a page that lives one level down needs its
// counterpart just as much as a chapter does. Names are returned relative to the space,
// e.g. `code-examples/curl`.
function chapters(dir = RU, prefix = '') {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (e.isDirectory()) {
      out.push(...chapters(path.join(dir, e.name), rel))
    } else if (e.name.endsWith('.md')) {
      const name = rel.replace(/\.md$/, '')
      if (!NOT_CHAPTERS.has(path.basename(name))) out.push(name)
    }
  }
  return out.sort()
}

// ── 1. Structural parity ru ↔ en ──────────────────────────────────────────────
// The walk starts from docs/ru because Russian is the source — but a page that exists
// only in English is just as broken, and walking one side alone would let it through in
// silence. Hence the reverse pass.
function checkOrphans(list) {
  const ru = new Set(list)
  for (const ch of chapters(EN)) {
    if (!ru.has(ch)) problems.push(`${ch}: exists in docs/en but not in docs/ru`)
  }
}

function checkShape(list, allow) {
  for (const ch of list) {
    if (allow.shape_skip.includes(ch)) continue
    const enPath = path.join(EN, `${ch}.md`)
    if (!fs.existsSync(enPath)) {
      problems.push(`${ch}: no English version at docs/en/${ch}.md`)
      continue
    }
    const a = shape(read(path.join(RU, `${ch}.md`)))
    const b = shape(read(enPath))
    const notes = []
    if (a.levels.join(',') !== b.levels.join(',')) {
      const i = a.levels.findIndex((v, k) => v !== b.levels[k])
      const at = i === -1 ? Math.min(a.levels.length, b.levels.length) : i
      notes.push(
        `heading structure diverges at #${at + 1} (ru ${a.levels.length}, en ${b.levels.length})`
      )
    }
    if (a.fences !== b.fences) notes.push(`code blocks: ru ${a.fences}, en ${b.fences}`)
    if (a.tableRows !== b.tableRows) {
      notes.push(`table rows: ru ${a.tableRows}, en ${b.tableRows}`)
    }
    if (notes.length) problems.push(`${ch}: ${notes.join('; ')}`)
  }
}

// ── 2. Identifier sets ru ↔ en ────────────────────────────────────────────────
function checkIdentifierParity(list) {
  for (const ch of list) {
    const enPath = path.join(EN, `${ch}.md`)
    if (!fs.existsSync(enPath)) continue
    const a = identifiers(read(path.join(RU, `${ch}.md`)))
    const b = identifiers(read(enPath))
    const onlyRu = [...a].filter((x) => !b.has(x)).sort()
    const onlyEn = [...b].filter((x) => !a.has(x)).sort()
    if (onlyRu.length) problems.push(`${ch}: only in ru — ${onlyRu.join(', ')}`)
    if (onlyEn.length) problems.push(`${ch}: only in en — ${onlyEn.join(', ')}`)
  }
}

// ── 3. Comparison against the contract ────────────────────────────────────────
// The contract lives in this very repository: its three files are placed here verbatim by
// the sync. The gate needs no access to the backend repository — it works in CI as is.
function checkAgainstContract(list, allow) {
  const contract = CONTRACT_FILES.filter((f) => fs.existsSync(path.join(ROOT, f)))
    .map((f) => read(path.join(ROOT, f)))
    .join('\n')
  if (!contract) {
    problems.push('contract files not found — cannot verify terms against the contract')
    return
  }
  const unknown = new Map()
  for (const ch of list) {
    for (const loc of ['ru', 'en']) {
      const p = path.join(ROOT, `docs/${loc}/${ch}.md`)
      if (!fs.existsSync(p)) continue
      for (const id of identifiers(read(p))) {
        if (id.includes(' ')) continue // METHOD /path — its own format, checked separately
        if (allow.unknown_identifiers.includes(id)) continue
        if (contract.includes(id)) continue
        if (!unknown.has(id)) unknown.set(id, new Set())
        unknown.get(id).add(`${loc}/${ch}`)
      }
    }
  }
  for (const [id, where] of [...unknown].sort()) {
    problems.push(`${id}: not in the contract — appears in ${[...where].sort().join(', ')}`)
  }
}

// ── 4. Co-change: a Russian edit must carry its English counterpart ───────────
function checkCoChange() {
  let changed = []
  try {
    const args = STAGED
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
      : ['diff', '--name-only', '--diff-filter=ACMR', `${BASE}...HEAD`]
    changed = execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8' }).split('\n').filter(Boolean)
  } catch {
    return // not a git environment, or the base is missing — skip silently
  }
  // ⚠️ Compared by path relative to the space, not by basename: two spaces hold a
  // `curl.md` each in different subdirectories, and collapsing to the file name would let
  // an edit to one be "covered" by an edit to an unrelated namesake.
  const touched = (dir) =>
    new Set(
      changed
        .filter((f) => f.startsWith(`docs/${dir}/`) && f.endsWith('.md'))
        .map((f) => f.slice(`docs/${dir}/`.length).replace(/\.md$/, ''))
    )
  const ru = touched('ru')
  const en = touched('en')
  for (const ch of ru) {
    if (!en.has(ch)) problems.push(`${ch}: docs/ru/${ch}.md was touched, docs/en/${ch}.md was not`)
  }
  for (const ch of en) {
    if (!ru.has(ch)) problems.push(`${ch}: docs/en/${ch}.md was touched, docs/ru/${ch}.md was not`)
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────
const allow = loadAllow()
const list = chapters()
if (!list.length) {
  console.error('docs/ru is missing or empty — nothing to check')
  process.exit(1)
}

checkOrphans(list)
checkShape(list, allow)
checkIdentifierParity(list)
checkAgainstContract(list, allow)
if (STAGED || BASE) checkCoChange()

if (problems.length) {
  console.error(`\n❌ Documentation parity broken (${problems.length}):\n`)
  for (const p of problems) console.error(`  • ${p}`)
  console.error(
    '\nProse is sourced from docs/ru/ and English is derived from it; facts come from' +
      '\nopenapi.yaml and openapi-partner.yaml. If a term is legitimate, add it verbatim' +
      `\nwith a reason to ${path.relative(ROOT, ALLOW_PATH)}.\n`
  )
  process.exit(1)
}

console.log(`✅ Documentation parity: ${list.length} chapters, ru ↔ en ↔ contract.`)
