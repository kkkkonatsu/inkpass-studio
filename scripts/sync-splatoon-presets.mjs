import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Fetches official Splatoon 3 multilingual strings (JPja, USen, CNzh, TWzh)
 * from Leanny/splat3 (https://github.com/Leanny/splat3) and regenerates:
 *   - src/presets/salmon-run-ranks.json
 *   - src/presets/splashtag-titles.json
 *
 * Usage: node scripts/sync-splatoon-presets.mjs
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const presetsDir = path.resolve(__dirname, '../src/presets')

const BASE_URL = 'https://raw.githubusercontent.com/Leanny/splat3/main/data/language'
const LANG_FILES = {
  ja: 'JPja.json',
  en: 'USen.json',
  'zh-Hans': 'CNzh.json',
  'zh-Hant': 'TWzh.json',
}

/** Strips Splatoon 3 internal control tags like `[group=0001 ...]` from localized strings. */
function cleanGameString(raw) {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\[[^\]]*\]/g, '').trim()
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.json()
}

function buildLocalizedEntry(key, dicts) {
  const ja = cleanGameString(dicts.ja[key])
  if (!ja) return null

  const label = {}
  for (const locale of ['en', 'zh-Hans', 'zh-Hant']) {
    const val = cleanGameString(dicts[locale][key])
    if (val && val !== ja) {
      label[locale] = val
    }
  }

  return Object.keys(label).length > 0 ? { value: ja, label } : { value: ja }
}

async function main() {
  console.log('[sync-presets] Fetching Splatoon 3 language dictionaries from Leanny/splat3...')
  const loaded = {}
  for (const [locale, file] of Object.entries(LANG_FILES)) {
    loaded[locale] = await fetchJson(`${BASE_URL}/${file}`)
  }

  // 1. Salmon Run 称号 (CommonMsg/Coop/CoopGrade -> Grade_00 .. Grade_08)
  const gradeDicts = Object.fromEntries(
    Object.entries(loaded).map(([locale, data]) => [locale, data['CommonMsg/Coop/CoopGrade'] ?? {}])
  )

  const gradeKeys = Object.keys(gradeDicts.ja)
    .filter((k) => /^Grade_\d+$/.test(k))
    .sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]))

  const rankOptions = gradeKeys.map((key) => buildLocalizedEntry(key, gradeDicts)).filter(Boolean)

  // 2. Splatoon 3 二つ名 (CommonMsg/Byname/BynameAdjective & BynameSubject)
  const adjDicts = Object.fromEntries(
    Object.entries(loaded).map(([locale, data]) => [
      locale,
      data['CommonMsg/Byname/BynameAdjective'] ?? {},
    ])
  )
  const subjDicts = Object.fromEntries(
    Object.entries(loaded).map(([locale, data]) => [
      locale,
      data['CommonMsg/Byname/BynameSubject'] ?? {},
    ])
  )

  const seenAdj = new Set()
  const adjectives = []
  for (const key of Object.keys(adjDicts.ja).sort()) {
    const entry = buildLocalizedEntry(key, adjDicts)
    if (!entry || seenAdj.has(entry.value)) continue
    seenAdj.add(entry.value)
    adjectives.push(entry)
  }

  const seenSubj = new Set()
  const subjects = []
  // BynameSubject has `_0` (default) and `_1` (gendered alt in European languages); `_0` is canonical in JP/EN/ZH.
  for (const key of Object.keys(subjDicts.ja).sort()) {
    if (key.endsWith('_1')) continue
    const entry = buildLocalizedEntry(key, subjDicts)
    if (!entry || seenSubj.has(entry.value)) continue
    seenSubj.add(entry.value)
    subjects.push(entry)
  }

  const ranksOutput = {
    id: 'salmon-run-ranks',
    language: 'ja',
    source: 'https://github.com/Leanny/splat3 (CommonMsg/Coop/CoopGrade)',
    options: rankOptions,
  }

  const titlesOutput = {
    id: 'splashtag-titles',
    language: 'ja',
    source: 'https://github.com/Leanny/splat3 (CommonMsg/Byname)',
    adjectives,
    subjects,
  }

  writeFileSync(
    path.join(presetsDir, 'salmon-run-ranks.json'),
    `${JSON.stringify(ranksOutput, null, 2)}\n`,
    'utf8'
  )
  writeFileSync(
    path.join(presetsDir, 'splashtag-titles.json'),
    `${JSON.stringify(titlesOutput, null, 2)}\n`,
    'utf8'
  )

  console.log(
    `[sync-presets] Wrote ${rankOptions.length} Salmon Run ranks, ${adjectives.length} adjectives, and ${subjects.length} subjects.`
  )
}

main().catch((err) => {
  console.error('[sync-presets] Failed:', err)
  process.exit(1)
})
