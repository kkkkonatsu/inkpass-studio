import { describe, expect, it } from 'vitest'
import {
  LOCALE_MESSAGES,
  SUPPORTED_LOCALES,
  matchBrowserLocale,
  translate,
} from './index'

function collectLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return collectLeafKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

describe('i18n', () => {
  it('keeps identical translation keys across all supported locales', () => {
    const baselineKeys = collectLeafKeys(LOCALE_MESSAGES.en as unknown as Record<string, unknown>).sort()

    for (const { code } of SUPPORTED_LOCALES) {
      const localeKeys = collectLeafKeys(
        LOCALE_MESSAGES[code] as unknown as Record<string, unknown>
      ).sort()
      expect(localeKeys, `Locale "${code}" keys should match English baseline`).toEqual(baselineKeys)
    }
  })

  it('interpolates placeholders and falls back cleanly on unknown keys', () => {
    expect(translate('en', 'editor.fontCustomActive', { name: 'MyFont.ttf' })).toBe(
      'Custom font: MyFont.ttf'
    )
    expect(translate('ja', 'editor.fontCustomActive', { name: 'MyFont.ttf' })).toBe(
      'カスタムフォント: MyFont.ttf'
    )
    expect(translate('zh-Hans', 'missing.key.example')).toBe('missing.key.example')
  })

  it('maps browser language tags to the right locale', () => {
    expect(matchBrowserLocale(['ja-JP'])).toBe('ja')
    expect(matchBrowserLocale(['zh-CN'])).toBe('zh-Hans')
    expect(matchBrowserLocale(['zh-SG'])).toBe('zh-Hans')
    expect(matchBrowserLocale(['zh-TW'])).toBe('zh-Hant')
    expect(matchBrowserLocale(['zh-HK'])).toBe('zh-Hant')
    expect(matchBrowserLocale(['fr-FR', 'en-US'])).toBe('en')
    expect(matchBrowserLocale(['ko-KR'])).toBe('en')
  })
})
