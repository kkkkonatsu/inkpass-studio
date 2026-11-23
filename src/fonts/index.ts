import { loadTemplateFonts } from '@/engine/font-loader'
import type { TemplateFont } from '@/templates/schema'
import discoveredFonts from './card-fonts.json'

export interface BundledCardFont extends TemplateFont {
  /** Stable identifier referenced by `template.defaultFontId` / `field.fontId` in config.json */
  id: string
  /** Human-readable display label shown in font pickers */
  label: string
}

/**
 * Fonts auto-indexed from `public/templates/_fonts/` (and optional per-template `fonts/` folders)
 * by `scripts/sync-card-fonts.mjs`.
 */
export const BUNDLED_CARD_FONTS: readonly BundledCardFont[] =
  discoveredFonts as BundledCardFont[]

/** Merges runtime/zip-loaded fonts with built-in fonts (extra fonts take priority by id). */
export function mergeCardFonts(
  extraFonts?: readonly BundledCardFont[]
): BundledCardFont[] {
  if (!extraFonts || extraFonts.length === 0) {
    return [...BUNDLED_CARD_FONTS]
  }
  const byId = new Map<string, BundledCardFont>()
  for (const font of BUNDLED_CARD_FONTS) {
    byId.set(font.id, font)
  }
  for (const font of extraFonts) {
    byId.set(font.id, font)
  }
  return Array.from(byId.values())
}

/** Finds a bundled or runtime-imported font by its `id` or CSS `family` name. */
export function findBundledFont(
  idOrFamily: string | undefined,
  extraFonts?: readonly BundledCardFont[]
): BundledCardFont | undefined {
  if (!idOrFamily) return undefined
  if (extraFonts) {
    const extraMatch = extraFonts.find(
      (font) => font.id === idOrFamily || font.family === idOrFamily
    )
    if (extraMatch) return extraMatch
  }
  return BUNDLED_CARD_FONTS.find(
    (font) => font.id === idOrFamily || font.family === idOrFamily
  )
}

/** Builds a CSS font-family stack with the chosen font first, preserving CJK/system fallbacks. */
export function buildCardFontStack(primaryFamily: string | undefined, fallbackStack: string): string {
  if (!primaryFamily) return fallbackStack
  const quoted = primaryFamily.includes(' ') ? `"${primaryFamily}"` : `'${primaryFamily}'`
  return `${quoted}, ${fallbackStack}`
}

/** Loads a single bundled card font into `document.fonts` on demand. */
export async function loadBundledFont(font: BundledCardFont): Promise<void> {
  await loadTemplateFonts([font])
}
