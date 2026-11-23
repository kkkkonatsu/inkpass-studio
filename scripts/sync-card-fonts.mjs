import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FONT_EXTENSIONS = new Set(['.woff2', '.woff', '.ttf', '.otf'])

function toSlug(raw) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'card-font'
}

function toPrettyLabel(baseName) {
  return baseName.replace(/[-_]+/g, ' ').trim() || baseName
}

function toSafeFamily(baseName) {
  const cleaned = baseName.replace(/[^a-zA-Z0-9_-]/g, '_')
  return cleaned ? `CardFont_${cleaned}` : 'CardFont_Custom'
}

/**
 * Scans a font directory for `.woff2`, `.woff`, `.ttf`, and `.otf` files,
 * merging optional display-name / family metadata from `fonts.json` if present.
 */
export function scanCardFontsDir(fontsDir, urlBasePath = '/templates/_fonts', seenIds = new Set()) {
  if (!existsSync(fontsDir)) {
    return []
  }

  let overrides = {}
  const metaPath = path.join(fontsDir, 'fonts.json')
  if (existsSync(metaPath)) {
    try {
      const parsed = JSON.parse(readFileSync(metaPath, 'utf8'))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        overrides = parsed
      }
    } catch (error) {
      console.warn(`[sync-fonts] Could not parse ${metaPath}:`, error)
    }
  }

  const entries = readdirSync(fontsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => FONT_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))

  const normalizedBase = urlBasePath.replace(/\/+$/, '')

  return entries.map((fileName) => {
    const ext = path.extname(fileName)
    const baseName = path.basename(fileName, ext)
    const meta =
      overrides[fileName] && typeof overrides[fileName] === 'object' ? overrides[fileName] : {}

    let id = typeof meta.id === 'string' && meta.id.trim() ? meta.id.trim() : toSlug(baseName)
    let suffix = 2
    while (seenIds.has(id)) {
      id = `${toSlug(baseName)}-${suffix}`
      suffix += 1
    }
    seenIds.add(id)

    const family =
      typeof meta.family === 'string' && meta.family.trim()
        ? meta.family.trim()
        : toSafeFamily(baseName)
    const label =
      typeof meta.label === 'string' && meta.label.trim()
        ? meta.label.trim()
        : toPrettyLabel(baseName)

    const record = {
      id,
      family,
      label,
      url: `${normalizedBase}/${encodeURIComponent(fileName)}`,
    }

    if (typeof meta.weight === 'string' && meta.weight.trim()) {
      record.weight = meta.weight.trim()
    }
    if (typeof meta.style === 'string' && meta.style.trim()) {
      record.style = meta.style.trim()
    }

    return record
  })
}

/**
 * Indexes shared fonts from `public/templates/_fonts/` plus any optional
 * per-template fonts inside `public/templates/<id>/fonts/`.
 */
export function scanAllTemplateFonts(templatesRootDir) {
  const seenIds = new Set()
  const sharedDir = path.join(templatesRootDir, '_fonts')
  const discovered = [...scanCardFontsDir(sharedDir, '/templates/_fonts', seenIds)]

  if (existsSync(templatesRootDir)) {
    const subdirs = readdirSync(templatesRootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))

    for (const templateDirName of subdirs) {
      const localFontsDir = path.join(templatesRootDir, templateDirName, 'fonts')
      if (existsSync(localFontsDir)) {
        const localFonts = scanCardFontsDir(
          localFontsDir,
          `/templates/${encodeURIComponent(templateDirName)}/fonts`,
          seenIds
        )
        discovered.push(...localFonts)
      }
    }
  }

  return discovered
}

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isCliEntry) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const rootDir = path.resolve(__dirname, '..')
  const templatesDir = path.join(rootDir, 'public', 'templates')
  const sharedFontsDir = path.join(templatesDir, '_fonts')
  const outputPath = path.join(rootDir, 'src', 'fonts', 'card-fonts.json')

  mkdirSync(sharedFontsDir, { recursive: true })
  mkdirSync(path.dirname(outputPath), { recursive: true })

  const discovered = scanAllTemplateFonts(templatesDir)
  writeFileSync(outputPath, `${JSON.stringify(discovered, null, 2)}\n`, 'utf8')
  console.log(
    `[sync-fonts] Indexed ${discovered.length} bundled card font(s) from public/templates/.`
  )
}
