import { gregorianToJapaneseEra, parseJapaneseEraString } from './japanese-era'

/**
 * Pure text formatting & layout utilities used by the Canvas 2D renderer.
 * Kept free of DOM/Canvas globals so they are trivial to read and unit-test.
 */

export type MeasureTextWidth = (text: string, fontSize: number) => number

export interface FormatDateOptions {
  /** Convert ASCII digits, letters, spaces, and punctuation to full-width (全角) */
  fullWidth?: boolean
}

/**
 * Converts half-width ASCII characters (digits, letters, punctuation, spaces)
 * into their full-width (全角) Unicode equivalents while leaving CJK characters untouched.
 */
export function toFullWidth(text: string): string {
  return text
    .replace(/[!-~]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0))
    .replace(/ /g, '\u3000')
}

/**
 * Formats an ISO date ("2026-04-01") or Japanese era string ("令和8年4月1日" / "R8.4.1")
 * using single-pass tokens so Western & Japanese Era tokens never collide:
 * - Western: `YYYY`, `YY`, `MM`, `M`, `DD`, `D`
 * - Japanese Era (和暦): `GGG` (令和), `G` (R), `EEE` (元 for year 1 else number), `EE` (08), `E` (8)
 *
 * If the input isn't a recognized date (e.g. user typed free text), returns it unchanged
 * (or converted to full-width if `options.fullWidth` is enabled).
 */
export function formatDateString(
  rawValue: string,
  format = 'YYYY.MM.DD',
  options: FormatDateOptions = {}
): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const applyWidth = (value: string) => (options.fullWidth ? toFullWidth(value) : value)

  const normalizedIso = parseJapaneseEraString(trimmed) ?? trimmed
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalizedIso)
  if (!match) return applyWidth(trimmed)

  const year = match[1]
  const monthNum = Number(match[2])
  const dayNum = Number(match[3])
  const monthPadded = String(monthNum).padStart(2, '0')
  const dayPadded = String(dayNum).padStart(2, '0')
  const era = gregorianToJapaneseEra(`${year}-${monthPadded}-${dayPadded}`)

  // If the template asks for era tokens but the date predates Meiji, fall back cleanly to Western YYYY.MM.DD.
  if (!era && /G|E/.test(format)) {
    return applyWidth(`${year}.${monthPadded}.${dayPadded}`)
  }

  const formatted = format.replace(/YYYY|YY|GGG|G|EEE|EE|E|MM|M|DD|D/g, (token) => {
    switch (token) {
      case 'YYYY':
        return year
      case 'YY':
        return year.slice(-2)
      case 'MM':
        return monthPadded
      case 'M':
        return String(monthNum)
      case 'DD':
        return dayPadded
      case 'D':
        return String(dayNum)
      case 'GGG':
        return era?.kanji ?? ''
      case 'G':
        return era?.short ?? ''
      case 'EEE':
        return era ? (era.year === 1 ? '元' : String(era.year)) : ''
      case 'EE':
        return era ? String(era.year).padStart(2, '0') : ''
      case 'E':
        return era ? String(era.year) : ''
      default:
        return token
    }
  })

  return applyWidth(formatted)
}

/**
 * Generates a random ID matching a simple pattern:
 * - `#` -> random digit 0-9
 * - `@` -> random uppercase letter A-Z
 * All other characters (prefixes like "AMA-" or "GRZ-", dashes, digits) are kept verbatim.
 */
export function generateRandomPattern(pattern: string, rng: () => number = Math.random): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let out = ''
  for (const ch of pattern) {
    if (ch === '#') {
      out += String(Math.floor(rng() * 10))
    } else if (ch === '@') {
      out += letters[Math.floor(rng() * letters.length)]
    } else {
      out += ch
    }
  }
  return out
}

/**
 * Computes the largest font size (between `minFontSize` and `baseFontSize`)
 * at which `text` fits inside `maxWidth`.
 */
export function computeFittedFontSize(
  measureWidth: MeasureTextWidth,
  text: string,
  baseFontSize: number,
  minFontSize: number | undefined,
  maxWidth: number
): number {
  if (!text || maxWidth <= 0) return baseFontSize
  const floorSize = Math.max(6, Math.min(minFontSize ?? baseFontSize, baseFontSize))

  if (measureWidth(text, baseFontSize) <= maxWidth) {
    return baseFontSize
  }

  let size = baseFontSize
  while (size > floorSize && measureWidth(text, size) > maxWidth) {
    size = Math.max(floorSize, size - 1)
  }
  return size
}

/**
 * Wraps text into lines that fit within `maxWidth`, supporting explicit newlines
 * as well as both space-delimited Latin text and CJK text without spaces.
 */
export function wrapTextLines(
  measureWidth: MeasureTextWidth,
  text: string,
  fontSize: number,
  maxWidth: number
): string[] {
  if (!text) return []
  if (maxWidth <= 0) return [text]

  const paragraphs = text.split(/\r?\n/)
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('')
      continue
    }

    // Split into word tokens (keeping spaces) while letting long CJK runs split character-by-character.
    let currentLine = ''
    for (const char of Array.from(paragraph)) {
      const candidate = currentLine + char
      if (currentLine && measureWidth(candidate, fontSize) > maxWidth) {
        // If we are inside an English word (no CJK) and there is a space earlier in the line, wrap at that space.
        const lastSpace = currentLine.lastIndexOf(' ')
        if (lastSpace > 0 && !/\s/.test(char) && !isCjkChar(char)) {
          lines.push(currentLine.slice(0, lastSpace).trimEnd())
          currentLine = currentLine.slice(lastSpace + 1) + char
        } else {
          lines.push(currentLine.trimEnd())
          currentLine = char.trimStart()
        }
      } else {
        currentLine = candidate
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }
  }

  return lines
}

function isCjkChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return (
    (code >= 0x3000 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef)
  )
}
