import { describe, expect, it } from 'vitest'
import {
  computeFittedFontSize,
  formatDateString,
  generateRandomPattern,
  toFullWidth,
  wrapTextLines,
} from './text-layout'

// Deterministic width estimator: 1 char = 0.6 * fontSize px
const mockMeasure = (text: string, fontSize: number) => Array.from(text).length * fontSize * 0.6

describe('text-layout helpers', () => {
  it('formats ISO and Japanese era dates, and passes through free text untouched', () => {
    expect(formatDateString('2026-04-01', 'YYYY.MM.DD')).toBe('2026.04.01')
    expect(formatDateString('2026-04-01', 'YYYY年M月D日')).toBe('2026年4月1日')
    expect(formatDateString('令和8年4月1日', 'YYYY.MM.DD')).toBe('2026.04.01')
    expect(formatDateString('卒業予定', 'YYYY.MM.DD')).toBe('卒業予定')
  })

  it('supports full-width (全角) date output for Japanese and Western formats', () => {
    expect(toFullWidth('2026.04.01 R8')).toBe('２０２６．０４．０１\u3000Ｒ８')
    expect(formatDateString('2026-04-01', 'GGGEEE年M月D日', { fullWidth: true })).toBe(
      '令和８年４月１日'
    )
    expect(formatDateString('2019-05-01', 'GGGEEE年M月D日', { fullWidth: true })).toBe(
      '令和元年５月１日'
    )
    expect(formatDateString('2026-04-01', 'GEE.MM.DD', { fullWidth: true })).toBe('Ｒ０８．０４．０１')
    expect(formatDateString('2026-04-01', 'YYYY.MM.DD', { fullWidth: true })).toBe(
      '２０２６．０４．０１'
    )
  })

  it('generates IDs matching # (digit) and @ (letter) patterns without touching literal prefixes', () => {
    const id = generateRandomPattern('GRZ-@@-####', () => 0.5)
    expect(id).toBe('GRZ-NN-5555')
    expect(generateRandomPattern('AMA-####')).toMatch(/^AMA-\d{4}$/)
  })

  it('shrinks font size smoothly down to minFontSize when text exceeds maxWidth', () => {
    expect(computeFittedFontSize(mockMeasure, 'Short', 30, 14, 200)).toBe(30)
    const fitted = computeFittedFontSize(mockMeasure, 'Very Long Inkling Name Here', 30, 14, 220)
    expect(fitted).toBe(14)
  })

  it('wraps both English words and CJK characters without spaces', () => {
    const enLines = wrapTextLines(mockMeasure, 'Inkblot Art Academy', 20, 120)
    expect(enLines).toEqual(['Inkblot', 'Art', 'Academy'])

    const jaLines = wrapTextLines(mockMeasure, '海女美術大学学生証明書', 20, 60)
    expect(jaLines).toEqual(['海女美術大', '学学生証明', '書'])
  })
})
