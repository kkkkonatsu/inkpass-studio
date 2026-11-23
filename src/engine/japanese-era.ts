/**
 * Bidirectional Gregorian (西暦 YYYY-MM-DD) <-> Japanese Era (和暦 / 日本年号) converter.
 * Pure TypeScript with zero dependencies so both the Canvas renderer and UI form can share it.
 */

export type JapaneseEraId = 'reiwa' | 'heisei' | 'showa' | 'taisho' | 'meiji'

export interface JapaneseEraDefinition {
  id: JapaneseEraId
  kanji: string
  short: 'R' | 'H' | 'S' | 'T' | 'M'
  romaji: string
  /** First Gregorian date of this era (inclusive), as [year, month, day] */
  start: readonly [number, number, number]
  /** Gregorian year = baseYear + eraYear (e.g. Reiwa 1 = 2018 + 1 = 2019) */
  baseYear: number
}

export const JAPANESE_ERAS: readonly JapaneseEraDefinition[] = [
  { id: 'reiwa', kanji: '令和', short: 'R', romaji: 'Reiwa', start: [2019, 5, 1], baseYear: 2018 },
  { id: 'heisei', kanji: '平成', short: 'H', romaji: 'Heisei', start: [1989, 1, 8], baseYear: 1988 },
  { id: 'showa', kanji: '昭和', short: 'S', romaji: 'Showa', start: [1926, 12, 25], baseYear: 1925 },
  { id: 'taisho', kanji: '大正', short: 'T', romaji: 'Taisho', start: [1912, 7, 30], baseYear: 1911 },
  { id: 'meiji', kanji: '明治', short: 'M', romaji: 'Meiji', start: [1868, 1, 25], baseYear: 1867 },
] as const

export interface JapaneseEraDate {
  era: JapaneseEraId
  kanji: string
  short: 'R' | 'H' | 'S' | 'T' | 'M'
  year: number
  month: number
  day: number
}

function compareYmd(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
): number {
  if (a[0] !== b[0]) return a[0] - b[0]
  if (a[1] !== b[1]) return a[1] - b[1]
  return a[2] - b[2]
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Normalizes full-width Japanese/Chinese digits & letters (e.g. "令和８年" -> "令和8年"). */
function normalizeFullWidth(input: string): string {
  return input.replace(/[０-９Ａ-Ｚａ-ｚ．／－]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  )
}

export function findJapaneseEra(key: string): JapaneseEraDefinition | undefined {
  const normalized = normalizeFullWidth(key).trim().toLowerCase()
  return JAPANESE_ERAS.find(
    (era) =>
      era.id === normalized ||
      era.kanji === key.trim() ||
      era.short.toLowerCase() === normalized ||
      era.romaji.toLowerCase() === normalized
  )
}

/**
 * Converts a Gregorian ISO date ("2026-04-01") into a Japanese era date.
 * Returns `null` if the date is invalid or earlier than Meiji 1 (1868-01-25).
 */
export function gregorianToJapaneseEra(isoDate: string): JapaneseEraDate | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(isoDate.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!isValidCalendarDate(year, month, day)) return null

  const target: readonly [number, number, number] = [year, month, day]
  for (const era of JAPANESE_ERAS) {
    if (compareYmd(target, era.start) >= 0) {
      return {
        era: era.id,
        kanji: era.kanji,
        short: era.short,
        year: year - era.baseYear,
        month,
        day,
      }
    }
  }

  return null
}

/**
 * Converts a Japanese era date (e.g. `('reiwa', 8, 4, 1)` or `('令和', 1, 5, 1)`)
 * into a Gregorian ISO date string ("2026-04-01").
 */
export function japaneseEraToGregorian(
  eraKey: string,
  eraYear: number,
  month: number,
  day: number
): string | null {
  const era = findJapaneseEra(eraKey)
  if (!era || !Number.isInteger(eraYear) || eraYear < 1) return null

  const gregorianYear = era.baseYear + eraYear
  if (!isValidCalendarDate(gregorianYear, month, day)) return null

  const yyyy = String(gregorianYear).padStart(4, '0')
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Parses common Japanese era text inputs into Gregorian ISO format ("YYYY-MM-DD").
 * Supports:
 * - "令和8年4月1日", "令和元年5月1日", "平成３１年４月３０日"
 * - "R8.4.1", "R08/04/01", "H12-03-15", "S64.1.7"
 */
export function parseJapaneseEraString(rawInput: string): string | null {
  const text = normalizeFullWidth(rawInput).trim()
  if (!text) return null

  // Kanji form: 令和8年4月1日 or 令和元年5月1日
  const kanjiMatch = /^(令和|平成|昭和|大正|明治)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/.exec(
    text
  )
  if (kanjiMatch) {
    const eraYear = kanjiMatch[2] === '元' ? 1 : Number(kanjiMatch[2])
    return japaneseEraToGregorian(kanjiMatch[1], eraYear, Number(kanjiMatch[3]), Number(kanjiMatch[4]))
  }

  // Shorthand form: R8.4.1, R08/04/01, H31-4-30
  const shortMatch = /^([RHSTM])\s*(\d{1,2})[./-](\d{1,2})[./-](\d{1,2})$/i.exec(text)
  if (shortMatch) {
    return japaneseEraToGregorian(
      shortMatch[1],
      Number(shortMatch[2]),
      Number(shortMatch[3]),
      Number(shortMatch[4])
    )
  }

  return null
}

/** Formats a JapaneseEraDate into readable kanji (e.g. "令和8年4月1日" or "令和元年5月1日"). */
export function formatJapaneseEraKanji(
  eraDate: JapaneseEraDate,
  options: { useGannen?: boolean } = {}
): string {
  const useGannen = options.useGannen ?? true
  const yearLabel = useGannen && eraDate.year === 1 ? '元' : String(eraDate.year)
  return `${eraDate.kanji}${yearLabel}年${eraDate.month}月${eraDate.day}日`
}
