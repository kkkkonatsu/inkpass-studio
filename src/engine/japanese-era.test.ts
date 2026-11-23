import { describe, expect, it } from 'vitest'
import {
  formatJapaneseEraKanji,
  gregorianToJapaneseEra,
  japaneseEraToGregorian,
  parseJapaneseEraString,
} from './japanese-era'
import { formatDateString } from './text-layout'

describe('Japanese era (日本年号 / 和暦) converter', () => {
  it('converts Gregorian ISO dates to exact Japanese eras across transition boundaries', () => {
    expect(gregorianToJapaneseEra('2026-04-01')).toEqual({
      era: 'reiwa',
      kanji: '令和',
      short: 'R',
      year: 8,
      month: 4,
      day: 1,
    })

    // Heisei -> Reiwa boundary
    expect(gregorianToJapaneseEra('2019-04-30')?.kanji).toBe('平成')
    expect(gregorianToJapaneseEra('2019-04-30')?.year).toBe(31)
    expect(gregorianToJapaneseEra('2019-05-01')?.kanji).toBe('令和')
    expect(gregorianToJapaneseEra('2019-05-01')?.year).toBe(1)

    // Showa -> Heisei boundary
    expect(gregorianToJapaneseEra('1989-01-07')?.kanji).toBe('昭和')
    expect(gregorianToJapaneseEra('1989-01-07')?.year).toBe(64)
    expect(gregorianToJapaneseEra('1989-01-08')?.kanji).toBe('平成')
    expect(gregorianToJapaneseEra('1989-01-08')?.year).toBe(1)

    // Meiji boundary & out-of-range
    expect(gregorianToJapaneseEra('1868-01-25')?.kanji).toBe('明治')
    expect(gregorianToJapaneseEra('1867-12-31')).toBeNull()
  })

  it('converts Japanese era fields back to Gregorian ISO dates and validates calendar dates', () => {
    expect(japaneseEraToGregorian('reiwa', 8, 4, 1)).toBe('2026-04-01')
    expect(japaneseEraToGregorian('令和', 1, 5, 1)).toBe('2019-05-01')
    expect(japaneseEraToGregorian('H', 12, 3, 15)).toBe('2000-03-15')
    expect(japaneseEraToGregorian('昭和', 64, 1, 7)).toBe('1989-01-07')
    // Invalid calendar date (Feb 30)
    expect(japaneseEraToGregorian('reiwa', 8, 2, 30)).toBeNull()
  })

  it('parses kanji, 元年, full-width digits, and shorthand era strings', () => {
    expect(parseJapaneseEraString('令和8年4月1日')).toBe('2026-04-01')
    expect(parseJapaneseEraString('令和元年5月1日')).toBe('2019-05-01')
    expect(parseJapaneseEraString('平成３１年４月３０日')).toBe('2019-04-30')
    expect(parseJapaneseEraString('R8.4.1')).toBe('2026-04-01')
    expect(parseJapaneseEraString('H12/03/15')).toBe('2000-03-15')
    expect(parseJapaneseEraString('not a date')).toBeNull()
  })

  it('formats dates cleanly in Japanese era & Western formats without token collisions', () => {
    expect(formatDateString('2026-04-01', 'GGGEEE年M月D日')).toBe('令和8年4月1日')
    expect(formatDateString('2019-05-01', 'GGGEEE年M月D日')).toBe('令和元年5月1日')
    expect(formatDateString('2019-05-01', 'GGGE年M月D日')).toBe('令和1年5月1日')
    expect(formatDateString('2026-04-01', 'GEE.MM.DD')).toBe('R08.04.01')
    // Meiji short code "M" must NOT collide with the month token "M"
    expect(formatDateString('1900-07-09', 'GEE.MM.DD')).toBe('M33.07.09')
    // Input as Japanese era -> formatted as Western!
    expect(formatDateString('令和8年4月1日', 'YYYY.MM.DD')).toBe('2026.04.01')

    const era = gregorianToJapaneseEra('2019-05-01')
    expect(era && formatJapaneseEraKanji(era)).toBe('令和元年5月1日')
  })
})
