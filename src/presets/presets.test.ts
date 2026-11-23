import { describe, expect, it } from 'vitest'
import {
  formatPresetOptionLabel,
  loadSalmonRunRanks,
  loadSplashtagTitles,
  matchesPresetQuery,
  pickRandomSplashtag,
  splitSplashtagValue,
} from './index'

describe('Splatoon 3 official Japanese preset catalogs with translations', () => {
  it('contains all 9 official Salmon Run 称号 with EN/SC/TC translations', async () => {
    const ranks = await loadSalmonRunRanks()
    const values = ranks.map((r) => r.value)

    expect(values).toEqual([
      'かけだし',
      'はんにんまえ',
      'いちにんまえ',
      'じゅくれん',
      'たつじん',
      'たつじん＋１',
      'たつじん＋２',
      'たつじん＋３',
      'でんせつ',
    ])

    const evp = ranks[ranks.length - 1]
    expect(formatPresetOptionLabel(evp, 'ja')).toBe('でんせつ')
    expect(formatPresetOptionLabel(evp, 'en')).toBe('でんせつ (Eggsecutive VP)')
    expect(formatPresetOptionLabel(evp, 'zh-Hans')).toBe('でんせつ (传说)')
    expect(formatPresetOptionLabel(evp, 'zh-Hant')).toBe('でんせつ (傳說)')
  })

  it('loads 1,000+ official 二つ名 with multilingual search, display formatting, and split helpers', async () => {
    const catalog = await loadSplashtagTitles()
    expect(catalog.language).toBe('ja')
    expect(catalog.adjectives.length).toBeGreaterThan(1000)
    expect(catalog.subjects.length).toBeGreaterThan(1000)

    const picked = pickRandomSplashtag(catalog, '', () => 0)
    expect(picked.combined).toBe(`${catalog.adjectives[0].value}${catalog.subjects[0].value}`)

    expect(splitSplashtagValue('海女美術大学のアーティスト', catalog)).toEqual({
      adjective: '海女美術大学の',
      subject: 'アーティスト',
    })
    expect(splitSplashtagValue('クマサン商会のアルバイター', catalog)).toEqual({
      adjective: 'クマサン商会の',
      subject: 'アルバイター',
    })
    expect(splitSplashtagValue('完全オリジナル称号', catalog)).toBeNull()

    const inkblotAdj = catalog.adjectives.find((a) => a.value === '海女美術大学の')!
    expect(formatPresetOptionLabel(inkblotAdj, 'en')).toBe('海女美術大学の (Inkblot Art Academy)')
    expect(matchesPresetQuery(inkblotAdj, 'inkblot')).toBe(true)
    expect(matchesPresetQuery(inkblotAdj, '海女美术')).toBe(true)
    expect(matchesPresetQuery(inkblotAdj, '海女美術')).toBe(true)
  })
})
