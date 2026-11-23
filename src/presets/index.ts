import type { Locale } from '@/i18n'
import type { SelectOption } from '@/templates/schema'

export interface SplashtagCatalog {
  id: string
  language: string
  source?: string
  adjectives: SelectOption[]
  subjects: SelectOption[]
}

let salmonRunPromise: Promise<SelectOption[]> | null = null
let splashtagPromise: Promise<SplashtagCatalog> | null = null

/** Lazy-loads the official Japanese Salmon Run 称号 (pay grade) options with localized hints. */
export function loadSalmonRunRanks(): Promise<SelectOption[]> {
  if (!salmonRunPromise) {
    salmonRunPromise = import('./salmon-run-ranks.json').then(
      (mod) => mod.default.options as SelectOption[]
    )
  }
  return salmonRunPromise
}

/** Lazy-loads the official Japanese Splatoon 3 二つ名 (Splashtag) catalog with localized hints. */
export function loadSplashtagTitles(): Promise<SplashtagCatalog> {
  if (!splashtagPromise) {
    splashtagPromise = import('./splashtag-titles.json').then(
      (mod) => mod.default as SplashtagCatalog
    )
  }
  return splashtagPromise
}

/** Returns the localized translation for a Japanese preset option, or `null` when UI is Japanese. */
export function getPresetTranslation(option: SelectOption, locale: Locale): string | null {
  if (locale === 'ja') return null
  const translated = option.label?.[locale] ?? option.label?.en
  return translated && translated !== option.value ? translated : null
}

/**
 * Formats a Japanese preset option for plain-text display:
 * - In Japanese UI (`ja`): returns the Japanese value directly (e.g. "でんせつ")
 * - In other languages: shows the translation in parentheses (e.g. "でんせつ (Eggsecutive VP)", "でんせつ (传说)")
 * The actual value saved and drawn on the card is always `option.value` (Japanese).
 */
export function formatPresetOptionLabel(option: SelectOption, locale: Locale): string {
  const translated = getPresetTranslation(option, locale)
  return translated ? `${option.value} (${translated})` : option.value
}

/** Matches a search query against both the Japanese value and all localized translations. */
export function matchesPresetQuery(option: SelectOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (option.value.toLowerCase().includes(q)) return true
  if (option.label) {
    for (const translated of Object.values(option.label)) {
      if (translated && translated.toLowerCase().includes(q)) {
        return true
      }
    }
  }
  return false
}

/** Picks a random Japanese 二つ名 combination (adjective + subject). */
export function pickRandomSplashtag(
  catalog: SplashtagCatalog,
  joiner = '',
  rng: () => number = Math.random
): { adjective: string; subject: string; combined: string } {
  const adjective = catalog.adjectives[Math.floor(rng() * catalog.adjectives.length)]?.value ?? ''
  const subject = catalog.subjects[Math.floor(rng() * catalog.subjects.length)]?.value ?? ''
  return {
    adjective,
    subject,
    combined: `${adjective}${joiner}${subject}`,
  }
}

/**
 * Attempts to split an existing combined Japanese 二つ名 string back into matching catalog
 * `{ adjective, subject }` entries. Returns `null` if it's a custom free-text string.
 */
export function splitSplashtagValue(
  value: string,
  catalog: SplashtagCatalog,
  joiner = ''
): { adjective: string; subject: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const subjectSet = new Set(catalog.subjects.map((item) => item.value))
  for (const adjItem of catalog.adjectives) {
    const prefix = `${adjItem.value}${joiner}`
    if (trimmed.startsWith(prefix)) {
      const rest = trimmed.slice(prefix.length)
      if (subjectSet.has(rest)) {
        return { adjective: adjItem.value, subject: rest }
      }
    }
  }
  return null
}
