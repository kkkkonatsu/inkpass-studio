import JSZip from 'jszip'
import { BUNDLED_CARD_FONTS, findBundledFont, type BundledCardFont } from '@/fonts'
import {
  resolveTemplateAssetUrl,
  validateTemplateConfig,
  type DocumentTemplateConfig,
} from '@/templates/schema'
import {
  classifyTemplateDocFilename,
  normalizeTemplateDocs,
  type TemplateDocs,
} from '@/templates/template-docs'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'])
const FONT_EXTENSIONS = new Set(['.woff2', '.woff', '.ttf', '.otf'])

export interface UploadedLocalFont {
  font: BundledCardFont
  file: Blob
  fileName: string
}

export interface LoadedTemplatePackage {
  config: DocumentTemplateConfig
  /** Maps relative & resolved asset paths (e.g. "./front.png") to in-memory Blob URLs */
  assetOverrides: Record<string, string>
  /** Fonts extracted from `_fonts/` (or `<id>/fonts/`) inside the zip */
  extraFonts: BundledCardFont[]
  /** Optional `CREDITS.txt` / `LICENSE.txt` contents included with the template */
  docs?: TemplateDocs
  /** Raw Blobs retained so the Designer can re-export an edited imported zip */
  sourceFiles: {
    images: Record<string, Blob>
    fonts: UploadedLocalFont[]
  }
  /** Frees all Object URLs created during import */
  revokeUrls: () => void
}

export interface ExportTemplateZipOptions {
  /** Local uploaded or previously imported image Blobs, keyed by path (e.g. "./front.png") */
  localImages?: Record<string, Blob>
  /** Local uploaded or previously imported font Blobs */
  localFonts?: readonly UploadedLocalFont[]
  /** Optional `CREDITS.txt` and `LICENSE.txt` contents to bundle in `<template-id>/` */
  docs?: TemplateDocs
  /** Optional custom asset fetcher (defaults to browser `fetch`) */
  fetchAsset?: (url: string) => Promise<Blob | null>
}

function getExtension(filePath: string): string {
  const clean = filePath.split('?')[0].split('#')[0]
  const dot = clean.lastIndexOf('.')
  return dot >= 0 ? clean.slice(dot).toLowerCase() : ''
}

function getBaseName(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? filePath
}

function stripExt(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(0, dot) : fileName
}

function toSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'card-font'
}

function toPrettyLabel(baseName: string): string {
  return baseName.replace(/[-_]+/g, ' ').trim() || baseName
}

function toSafeFamily(baseName: string): string {
  const cleaned = baseName.replace(/[^a-zA-Z0-9_-]/g, '_')
  return cleaned ? `ZipFont_${cleaned}` : 'ZipFont_Custom'
}

function isIgnoredZipEntry(entryPath: string): boolean {
  const parts = entryPath.split('/')
  return parts.some((p) => p === '__MACOSX' || p === '.DS_Store' || p.startsWith('._'))
}

function guessMimeType(fileName: string): string {
  switch (getExtension(fileName)) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.gif':
      return 'image/gif'
    case '.woff2':
      return 'font/woff2'
    case '.woff':
      return 'font/woff'
    case '.ttf':
      return 'font/ttf'
    case '.otf':
      return 'font/otf'
    default:
      return 'application/octet-stream'
  }
}

async function defaultFetchAsset(url: string): Promise<Blob | null> {
  if (typeof fetch === 'undefined') return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.blob()
  } catch {
    return null
  }
}

/**
 * Packages a template config, all referenced artwork, and all referenced/uploaded fonts
 * into a self-contained `.zip` mirroring `public/templates/`:
 *
 * ```
 * <template-id>/
 *   config.json
 *   front.png
 *   ...
 * _fonts/
 *   fonts.json
 *   FontFile.otf
 * ```
 */
export async function buildTemplateZip(
  template: DocumentTemplateConfig,
  options: ExportTemplateZipOptions = {}
): Promise<JSZip> {
  const zip = new JSZip()
  const fetchAsset = options.fetchAsset ?? defaultFetchAsset
  const localImages = options.localImages ?? {}
  const localFonts = options.localFonts ?? []
  const extraFontRecords = localFonts.map((item) => item.font)

  const templateDir = template.id.trim() || 'custom-template'
  const cleanConfig: DocumentTemplateConfig = JSON.parse(JSON.stringify(template))

  // 1. Collect & pack all referenced image assets (thumbnail, backgrounds, overlays)
  const imagePaths = new Set<string>()
  if (cleanConfig.thumbnail) imagePaths.add(cleanConfig.thumbnail)
  for (const side of cleanConfig.sides) {
    if (side.background) imagePaths.add(side.background)
    if (side.overlay) imagePaths.add(side.overlay)
  }

  for (const rawPath of imagePaths) {
    if (rawPath.startsWith('data:') || rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      continue
    }

    const resolvedUrl = resolveTemplateAssetUrl(templateDir, rawPath)
    let blob: Blob | null = localImages[rawPath] ?? localImages[resolvedUrl] ?? null
    if (!blob) {
      blob = await fetchAsset(resolvedUrl)
    }
    if (!blob) continue

    // Normalize path inside `<templateDir>/...`
    const relativeInsideDir = rawPath.startsWith('/')
      ? rawPath.startsWith(`/templates/${templateDir}/`)
        ? rawPath.slice(`/templates/${templateDir}/`.length)
        : getBaseName(rawPath)
      : rawPath.replace(/^\.\//, '')

    zip.file(`${templateDir}/${relativeInsideDir}`, blob)
  }

  // 2. Collect all referenced fonts (defaultFontId, per-field fontId) + any uploaded local fonts
  const referencedFontIds = new Set<string>()
  if (cleanConfig.defaultFontId) referencedFontIds.add(cleanConfig.defaultFontId)
  for (const side of cleanConfig.sides) {
    for (const field of side.fields) {
      if ('fontId' in field && field.fontId) {
        referencedFontIds.add(field.fontId)
      }
    }
  }
  for (const local of localFonts) {
    referencedFontIds.add(local.font.id)
  }

  const fontsMeta: Record<
    string,
    { id: string; label: string; family: string; weight?: string; style?: string }
  > = {}
  const localFontById = new Map(localFonts.map((item) => [item.font.id, item]))

  for (const fontId of referencedFontIds) {
    const localEntry = localFontById.get(fontId)
    const fontRecord =
      localEntry?.font ?? findBundledFont(fontId, [...extraFontRecords, ...BUNDLED_CARD_FONTS])
    if (!fontRecord) continue

    let fontBlob: Blob | null = localEntry?.file ?? null
    let fileName = localEntry?.fileName ?? decodeURIComponent(getBaseName(fontRecord.url))

    if (!fontBlob && fontRecord.url) {
      fontBlob = await fetchAsset(fontRecord.url)
    }
    if (!fontBlob) continue

    if (!FONT_EXTENSIONS.has(getExtension(fileName))) {
      fileName = `${fontRecord.id}.otf`
    }

    zip.file(`_fonts/${fileName}`, fontBlob)
    fontsMeta[fileName] = {
      id: fontRecord.id,
      label: fontRecord.label,
      family: fontRecord.family,
      ...(fontRecord.weight ? { weight: fontRecord.weight } : {}),
      ...(fontRecord.style ? { style: fontRecord.style } : {}),
    }
  }

  // Also include any explicit `template.fonts` files if present
  for (const font of cleanConfig.fonts) {
    if (!font.url || font.url.startsWith('http://') || font.url.startsWith('https://')) continue
    const resolvedUrl = resolveTemplateAssetUrl(templateDir, font.url)
    const blob = await fetchAsset(resolvedUrl)
    if (!blob) continue
    const relativeInsideDir = font.url.startsWith('/')
      ? `fonts/${decodeURIComponent(getBaseName(font.url))}`
      : font.url.replace(/^\.\//, '')
    zip.file(`${templateDir}/${relativeInsideDir}`, blob)
  }

  if (Object.keys(fontsMeta).length > 0) {
    zip.file('_fonts/fonts.json', `${JSON.stringify(fontsMeta, null, 2)}\n`)
  }

  // 3. Write optional CREDITS.txt / LICENSE.txt
  const cleanDocs = normalizeTemplateDocs(options.docs)
  if (cleanDocs?.credits) {
    const text = cleanDocs.credits.endsWith('\n') ? cleanDocs.credits : `${cleanDocs.credits}\n`
    zip.file(`${templateDir}/CREDITS.txt`, text)
  }
  if (cleanDocs?.license) {
    const text = cleanDocs.license.endsWith('\n') ? cleanDocs.license : `${cleanDocs.license}\n`
    zip.file(`${templateDir}/LICENSE.txt`, text)
  }

  // 4. Write config.json cleanly
  zip.file(`${templateDir}/config.json`, `${JSON.stringify(cleanConfig, null, 2)}\n`)

  return zip
}

export async function exportTemplateZip(
  template: DocumentTemplateConfig,
  options: ExportTemplateZipOptions = {}
): Promise<Blob> {
  const zip = await buildTemplateZip(template, options)
  return zip.generateAsync({ type: 'blob' })
}

export async function exportTemplateZipBytes(
  template: DocumentTemplateConfig,
  options: ExportTemplateZipOptions = {}
): Promise<Uint8Array> {
  const zip = await buildTemplateZip(template, options)
  return zip.generateAsync({ type: 'uint8array' })
}

/**
 * Loads a standalone template `.zip` entirely in memory:
 * - Supports `<id>/config.json` OR flat root `config.json`
 * - Supports `_fonts/`, `_font/`, and `<id>/fonts/` (with optional `fonts.json` metadata)
 * - Validates `config.json`, creates Blob URLs for images, and prepares fonts for `FontFace`.
 */
export async function importTemplateZip(
  input: File | Blob | ArrayBuffer | Uint8Array
): Promise<LoadedTemplatePackage> {
  const zip = await JSZip.loadAsync(input)
  const fileEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && !isIgnoredZipEntry(entry.name)
  )

  // 1. Locate config.json (prefer `<dir>/config.json` or root `config.json`)
  const configEntry = fileEntries.find((entry) => {
    const parts = entry.name.split('/').filter(Boolean)
    return (
      (parts.length === 1 && parts[0] === 'config.json') ||
      (parts.length === 2 && !parts[0].startsWith('_') && parts[1] === 'config.json')
    )
  })

  if (!configEntry) {
    throw new Error('ZIP does not contain a config.json file.')
  }

  const configText = await configEntry.async('text')
  let parsed: unknown
  try {
    parsed = JSON.parse(configText)
  } catch {
    throw new Error('config.json inside the ZIP is not valid JSON.')
  }

  const validation = validateTemplateConfig(parsed)
  if (!validation.valid) {
    throw new Error(`Invalid config.json: ${validation.errors[0]}`)
  }

  const config = parsed as DocumentTemplateConfig
  const configDirPrefix = configEntry.name.includes('/')
    ? configEntry.name.slice(0, configEntry.name.lastIndexOf('/') + 1)
    : ''

  const createdObjectUrls: string[] = []
  const createUrl = (blob: Blob): string => {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob)
      createdObjectUrls.push(url)
      return url
    }
    return ''
  }

  // 2. Extract images and optional CREDITS.txt / LICENSE.txt from the template folder
  const assetOverrides: Record<string, string> = {}
  const imageBlobs: Record<string, Blob> = {}
  const extractedDocs: TemplateDocs = {}

  for (const entry of fileEntries) {
    if (configDirPrefix && !entry.name.startsWith(configDirPrefix)) continue
    const relPath = configDirPrefix ? entry.name.slice(configDirPrefix.length) : entry.name
    if (!relPath || relPath === 'config.json') continue

    if (!relPath.includes('/')) {
      const docKind = classifyTemplateDocFilename(relPath)
      if (docKind && !extractedDocs[docKind]) {
        const text = await entry.async('text')
        if (text.trim()) {
          extractedDocs[docKind] = text
        }
        continue
      }
    }

    if (!IMAGE_EXTENSIONS.has(getExtension(relPath))) continue

    const rawBytes = await entry.async('uint8array')
    const blob = new Blob([rawBytes as Uint8Array<ArrayBuffer>], {
      type: guessMimeType(relPath),
    })
    const url = createUrl(blob)

    const dotRel = `./${relPath}`
    const resolved = resolveTemplateAssetUrl(config.id, dotRel)
    imageBlobs[dotRel] = blob
    imageBlobs[relPath] = blob
    imageBlobs[resolved] = blob

    if (url) {
      assetOverrides[dotRel] = url
      assetOverrides[relPath] = url
      assetOverrides[resolved] = url
    }
  }

  // 3. Extract fonts from `_fonts/`, `_font/`, or `<templateDir>/fonts/`
  const fontDirs = new Set<string>(['_fonts/', '_font/', `${configDirPrefix}fonts/`])
  const fontMetaByDir = new Map<string, Record<string, Partial<BundledCardFont>>>()

  for (const dir of fontDirs) {
    const metaEntry = fileEntries.find((e) => e.name === `${dir}fonts.json`)
    if (!metaEntry) continue
    try {
      const parsedMeta = JSON.parse(await metaEntry.async('text')) as unknown
      if (parsedMeta && typeof parsedMeta === 'object' && !Array.isArray(parsedMeta)) {
        fontMetaByDir.set(dir, parsedMeta as Record<string, Partial<BundledCardFont>>)
      }
    } catch {
      // Ignore malformed optional fonts.json
    }
  }

  const extraFonts: BundledCardFont[] = []
  const uploadedFonts: UploadedLocalFont[] = []
  const seenFontIds = new Set<string>()

  for (const entry of fileEntries) {
    const matchedDir = Array.from(fontDirs).find((dir) => entry.name.startsWith(dir))
    if (!matchedDir) continue
    const fileName = entry.name.slice(matchedDir.length)
    if (!fileName || fileName.includes('/') || !FONT_EXTENSIONS.has(getExtension(fileName))) continue

    const rawBytes = await entry.async('uint8array')
    const blob = new Blob([rawBytes as Uint8Array<ArrayBuffer>], {
      type: guessMimeType(fileName),
    })
    const url = createUrl(blob)

    const baseName = stripExt(fileName)
    const meta = fontMetaByDir.get(matchedDir)?.[fileName]
    let id = typeof meta?.id === 'string' && meta.id.trim() ? meta.id.trim() : toSlug(baseName)
    let suffix = 2
    while (seenFontIds.has(id)) {
      id = `${toSlug(baseName)}-${suffix}`
      suffix += 1
    }
    seenFontIds.add(id)

    const fontRecord: BundledCardFont = {
      id,
      family:
        typeof meta?.family === 'string' && meta.family.trim()
          ? meta.family.trim()
          : toSafeFamily(baseName),
      label:
        typeof meta?.label === 'string' && meta.label.trim()
          ? meta.label.trim()
          : toPrettyLabel(baseName),
      url: url || `/templates/_fonts/${encodeURIComponent(fileName)}`,
      ...(meta?.weight ? { weight: meta.weight } : {}),
      ...(meta?.style ? { style: meta.style } : {}),
    }

    // Also register override for relative `./fonts/<fileName>` references inside template.fonts
    if (url && matchedDir === `${configDirPrefix}fonts/`) {
      const dotRel = `./fonts/${fileName}`
      assetOverrides[dotRel] = url
      assetOverrides[resolveTemplateAssetUrl(config.id, dotRel)] = url
    }

    extraFonts.push(fontRecord)
    uploadedFonts.push({ font: fontRecord, file: blob, fileName })
  }

  // Register extracted fonts in the browser immediately if available
  if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
    await Promise.all(
      uploadedFonts.map(async ({ font, file }) => {
        try {
          const face = new FontFace(font.family, await file.arrayBuffer(), {
            weight: font.weight ?? '100 900',
            style: font.style ?? 'normal',
          })
          const loaded = await face.load()
          document.fonts.add(loaded)
        } catch (err) {
          console.warn(`[template-zip] Could not register font "${font.family}":`, err)
        }
      })
    )
    await document.fonts.ready
  }

  const normalizedDocs = normalizeTemplateDocs(extractedDocs)

  return {
    config,
    assetOverrides,
    extraFonts,
    ...(normalizedDocs ? { docs: normalizedDocs } : {}),
    sourceFiles: {
      images: imageBlobs,
      fonts: uploadedFonts,
    },
    revokeUrls: () => {
      for (const url of createdObjectUrls) {
        URL.revokeObjectURL(url)
      }
    },
  }
}
