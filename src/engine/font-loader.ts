import { withBaseUrl, type TemplateFont } from '@/templates/schema'

const loadedFontKeys = new Set<string>()

/**
 * Loads custom `@font-face` fonts declared in a template config via the browser FontFace API.
 * Safe to call repeatedly — already-loaded fonts are skipped.
 */
export async function loadTemplateFonts(
  fonts: readonly TemplateFont[],
  assetOverrides?: Record<string, string>
): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
    return
  }

  await Promise.all(
    fonts.map(async (font) => {
      const resolvedUrl = withBaseUrl(assetOverrides?.[font.url] ?? font.url)
      const key = `${font.family}::${resolvedUrl}::${font.weight ?? 'normal'}::${font.style ?? 'normal'}`
      if (loadedFontKeys.has(key)) return

      try {
        const face = new FontFace(font.family, `url("${resolvedUrl}")`, {
          weight: font.weight ?? '100 900',
          style: font.style ?? 'normal',
        })
        const loaded = await face.load()
        document.fonts.add(loaded)
        loadedFontKeys.add(key)
      } catch (error) {
        // Don't block card rendering if a custom font file hasn't been added yet.
        console.warn(`[font-loader] Could not load font "${font.family}" from "${resolvedUrl}":`, error)
      }
    })
  )

  await document.fonts.ready
}

/**
 * Registers a user-uploaded local font file (.ttf / .otf / .woff2) directly in browser memory
 * and returns the generated CSS font-family name so the Canvas renderer can use it immediately.
 */
export async function registerUploadedFont(file: File): Promise<string> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
    throw new Error('Browser FontFace API is unavailable.')
  }

  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'CustomFont'
  const familyName = `UserFont_${baseName}_${Date.now()}`
  const buffer = await file.arrayBuffer()
  const face = new FontFace(familyName, buffer)
  const loaded = await face.load()
  document.fonts.add(loaded)
  await document.fonts.ready
  return familyName
}
