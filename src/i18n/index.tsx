import * as React from 'react'

import en from './locales/en.json'
import ja from './locales/ja.json'
import zhHans from './locales/zh-Hans.json'
import zhHant from './locales/zh-Hant.json'

/**
 * To add a new UI language:
 * 1. Create `src/i18n/locales/<locale-code>.json` copying `en.json`
 * 2. Import it above and register it in `LOCALE_MESSAGES` and `SUPPORTED_LOCALES`
 */
export type Locale = 'en' | 'ja' | 'zh-Hans' | 'zh-Hant'

export interface LocaleOption {
  code: Locale
  label: string
  shortLabel: string
  htmlLang: string
}

export const SUPPORTED_LOCALES: readonly LocaleOption[] = [
  { code: 'en', label: 'English', shortLabel: 'EN', htmlLang: 'en' },
  { code: 'ja', label: '日本語', shortLabel: '日本語', htmlLang: 'ja' },
  { code: 'zh-Hans', label: '简体中文', shortLabel: '简中', htmlLang: 'zh-Hans' },
  { code: 'zh-Hant', label: '繁體中文', shortLabel: '繁中', htmlLang: 'zh-Hant' },
] as const

export type TranslationTree = typeof en

export const LOCALE_MESSAGES: Record<Locale, TranslationTree> = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
}

const STORAGE_KEY = 'splatoon-id-studio.locale'

function readNestedKey(tree: Record<string, unknown>, key: string): string | undefined {
  let current: unknown = tree
  for (const segment of key.split('.')) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

/**
 * Pure translation helper — looks up a dot-separated key in the active locale,
 * falls back to English, and replaces `{param}` placeholders.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const raw =
    readNestedKey(LOCALE_MESSAGES[locale] as unknown as Record<string, unknown>, key) ??
    readNestedKey(LOCALE_MESSAGES.en as unknown as Record<string, unknown>, key) ??
    key

  if (!params) return raw

  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}

/**
 * Maps browser language tags (e.g. "zh-TW", "zh-HK", "zh-CN", "ja-JP", "en-US")
 * to one of our supported UI locales.
 */
export function matchBrowserLocale(languages: readonly string[]): Locale {
  for (const rawLang of languages) {
    const lang = rawLang.toLowerCase()
    if (lang.startsWith('ja')) return 'ja'
    if (lang.startsWith('zh')) {
      if (lang.includes('hant') || lang.includes('tw') || lang.includes('hk') || lang.includes('mo')) {
        return 'zh-Hant'
      }
      return 'zh-Hans'
    }
    if (lang.startsWith('en')) return 'en'
  }
  return 'en'
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.some((item) => item.code === value)
}

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isSupportedLocale(saved)) return saved
  } catch {
    // Ignore storage access errors in private browsing modes.
  }
  const browserLangs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return matchBrowserLocale(browserLangs.filter(Boolean))
}

interface I18nContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(getInitialLocale)

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore storage access errors.
    }
  }, [])

  React.useEffect(() => {
    const match = SUPPORTED_LOCALES.find((item) => item.code === locale)
    document.documentElement.lang = match?.htmlLang ?? 'en'
  }, [locale])

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  )

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used inside <I18nProvider>.')
  }
  return ctx
}
