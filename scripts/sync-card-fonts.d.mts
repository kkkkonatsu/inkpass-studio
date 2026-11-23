import type { BundledCardFont } from '../src/fonts'

export function scanCardFontsDir(
  fontsDir: string,
  urlBasePath?: string,
  seenIds?: Set<string>
): BundledCardFont[]

export function scanAllTemplateFonts(templatesRootDir: string): BundledCardFont[]
