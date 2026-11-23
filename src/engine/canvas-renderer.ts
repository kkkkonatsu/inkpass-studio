import { buildCardFontStack, findBundledFont, type BundledCardFont } from '@/fonts'
import {
  resolveTemplateAssetUrl,
  type BarcodeFieldConfig,
  type CardFieldValues,
  type DocumentTemplateConfig,
  type PhotoFieldConfig,
  type TemplateField,
  type TemplateSide,
  type TextStyleProps,
} from '@/templates/schema'
import { renderBarcodeCanvas } from './barcode'
import { computeBleedGeometry } from './bleed'
import { loadTemplateFonts } from './font-loader'
import { computeFittedFontSize, formatDateString, wrapTextLines } from './text-layout'

export interface RenderCardOptions {
  /** 'filled' draws user inputs; 'blank' outputs the clean template with no user info. */
  mode?: 'filled' | 'blank'
  /** Output resolution multiplier (1 = native template canvasSize, 2 = 2x supersampled). */
  scale?: number
  /**
   * Desired bleed in mm (`0` to `template.bleedMm`).
   * Omit to render the full template artwork including its full bleed.
   */
  exportBleedMm?: number
  /** Draw a dashed cyan guide at the finished trim boundary when `template.bleedMm > 0`. */
  showTrimGuide?: boolean
  /** Optional font-family override applied to all text fields. */
  fontFamilyOverride?: string
  /** Extra fonts loaded from an imported .zip template or Designer uploads. */
  extraFonts?: readonly BundledCardFont[]
  /** Temporary URL overrides (e.g. Blob URLs for unsaved assets in the Template Designer or .zip imports). */
  assetOverrides?: Record<string, string>
  /** Draw field bounding boxes & IDs for calibration or visual design. */
  showDebugBoxes?: boolean
  /** Highlight a specific field box when `showDebugBoxes` is enabled. */
  selectedFieldId?: string | null
  /** Optional target canvas to draw into instead of creating a new one. */
  targetCanvas?: HTMLCanvasElement
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)

  const cached = imageCache.get(url)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      imageCache.delete(url)
      resolve(null)
    }
    img.src = url
  })

  // Avoid caching huge user-uploaded data URLs forever
  if (!url.startsWith('data:')) {
    imageCache.set(url, promise)
  }

  return promise
}

function buildFontString(
  fontSize: number,
  fontWeight: string | undefined,
  fontFamily: string
): string {
  return `${fontWeight ?? '600'} ${fontSize}px ${fontFamily}`
}

const graphemeSegmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

function splitGraphemes(text: string): string[] {
  if (!text) return []
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), (part) => part.segment)
  }
  return Array.from(text)
}

/**
 * Computes the vertical offset from a desired visual center `y` down to the font's
 * `alphabetic` baseline.
 *
 * Unlike `ctx.textBaseline = 'middle'` (where Chrome/Safari use `hhea` while Firefox uses
 * `OS/2 sTypo`, causing noticeable vertical drift on CJK fonts like Source Han Serif),
 * anchoring to `alphabetic` with fixed `'H'` glyph bounds renders identically across
 * Firefox, Chrome, and Safari without jumping vertically as users type.
 */
function measureAlphabeticCenterOffset(
  ctx: CanvasRenderingContext2D,
  fontSize: number
): number {
  const prevBaseline = ctx.textBaseline
  ctx.textBaseline = 'alphabetic'
  const metrics = ctx.measureText('H')
  ctx.textBaseline = prevBaseline

  if (
    typeof metrics.actualBoundingBoxAscent === 'number' &&
    typeof metrics.actualBoundingBoxDescent === 'number' &&
    metrics.actualBoundingBoxAscent > 0
  ) {
    return (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
  }
  return fontSize * 0.37
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(Math.max(0, radius), width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function withFieldRotation(
  ctx: CanvasRenderingContext2D,
  field: TemplateField,
  draw: () => void
): void {
  if (!field.rotation) {
    draw()
    return
  }

  const cx = field.x + field.width / 2
  const cy = field.y + field.height / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((field.rotation * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  draw()
  ctx.restore()
}

async function drawPhotoField(
  ctx: CanvasRenderingContext2D,
  field: PhotoFieldConfig,
  rawSrc: string | undefined,
  showPlaceholder: boolean
): Promise<void> {
  const img = rawSrc ? await loadImage(rawSrc) : null

  withFieldRotation(ctx, field, () => {
    ctx.save()
    drawRoundedRectPath(ctx, field.x, field.y, field.width, field.height, field.borderRadius ?? 0)
    ctx.clip()

    if (img) {
      if (field.grayscale) {
        ctx.filter = 'grayscale(100%)'
      }

      const fit = field.fit ?? 'cover'
      const imgRatio = img.naturalWidth / img.naturalHeight
      const boxRatio = field.width / field.height
      let drawWidth = field.width
      let drawHeight = field.height

      if (fit === 'cover') {
        if (imgRatio > boxRatio) {
          drawHeight = field.height
          drawWidth = drawHeight * imgRatio
        } else {
          drawWidth = field.width
          drawHeight = drawWidth / imgRatio
        }
      } else {
        if (imgRatio > boxRatio) {
          drawWidth = field.width
          drawHeight = drawWidth / imgRatio
        } else {
          drawHeight = field.height
          drawWidth = drawHeight * imgRatio
        }
      }

      const drawX = field.x + (field.width - drawWidth) / 2
      const drawY = field.y + (field.height - drawHeight) / 2
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
    } else if (showPlaceholder) {
      ctx.fillStyle = 'rgba(13, 13, 13, 0.08)'
      ctx.fillRect(field.x, field.y, field.width, field.height)
      ctx.strokeStyle = 'rgba(13, 13, 13, 0.35)'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])
      ctx.strokeRect(field.x + 2, field.y + 2, field.width - 4, field.height - 4)
      ctx.setLineDash([])

      ctx.fillStyle = 'rgba(13, 13, 13, 0.45)'
      ctx.font = '600 18px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        field.placeholderLabel ?? 'PHOTO',
        field.x + field.width / 2,
        field.y + field.height / 2
      )
    }

    ctx.restore()
  })
}

function drawTextField(
  ctx: CanvasRenderingContext2D,
  field: TemplateField & TextStyleProps,
  text: string,
  defaultFontFamily: string,
  fontFamilyOverride?: string,
  extraFonts?: readonly BundledCardFont[]
): void {
  if (!text) return

  const formatted = `${field.prefix ?? ''}${text}${field.suffix ?? ''}`
  const fieldBundledFont = findBundledFont(field.fontId, extraFonts)
  const fieldFontStack = fieldBundledFont
    ? buildCardFontStack(fieldBundledFont.family, defaultFontFamily)
    : field.fontFamily
  const fontFamily = fontFamilyOverride || fieldFontStack || defaultFontFamily
  const align = field.align ?? 'left'
  const verticalAlign = field.verticalAlign ?? 'middle'
  const letterSpacing = field.letterSpacing ?? 0
  const scaleX = Math.max(10, field.scaleX ?? 100) / 100
  const scaleY = Math.max(10, field.scaleY ?? 100) / 100
  const skewX = Math.max(-45, Math.min(45, field.skewX ?? 0))
  const skewFactor = skewX !== 0 ? -Math.tan((skewX * Math.PI) / 180) : 0

  const measureUnscaledWidth = (sample: string): number => {
    if (!letterSpacing) {
      return ctx.measureText(sample).width
    }
    const chars = splitGraphemes(sample)
    if (chars.length === 0) return 0
    let total = 0
    for (const ch of chars) {
      total += ctx.measureText(ch).width
    }
    return total + Math.max(0, chars.length - 1) * letterSpacing
  }

  const measureWidth = (sample: string, size: number) => {
    ctx.font = buildFontString(size, field.fontWeight, fontFamily)
    return measureUnscaledWidth(sample) * scaleX
  }

  const fillLine = (line: string, x: number, y: number) => {
    if (!letterSpacing) {
      ctx.fillText(line, x, y)
      return
    }
    const chars = splitGraphemes(line)
    if (chars.length === 0) return

    const widths = chars.map((ch) => ctx.measureText(ch).width)
    const totalWidth =
      widths.reduce((sum, w) => sum + w, 0) + Math.max(0, chars.length - 1) * letterSpacing

    let cursorX = x
    if (align === 'center') {
      cursorX = x - totalWidth / 2
    } else if (align === 'right') {
      cursorX = x - totalWidth
    }

    const prevAlign = ctx.textAlign
    ctx.textAlign = 'left'
    for (let i = 0; i < chars.length; i += 1) {
      ctx.fillText(chars[i], cursorX, y)
      cursorX += widths[i] + letterSpacing
    }
    ctx.textAlign = prevAlign
  }

  const drawScaledLine = (line: string, x: number, y: number, baselineOffset: number) => {
    if (scaleX === 1 && scaleY === 1 && skewFactor === 0) {
      fillLine(line, x, y + baselineOffset)
      return
    }
    ctx.save()
    ctx.translate(x, y)
    if (skewFactor !== 0) {
      ctx.transform(1, 0, skewFactor, 1, 0, 0)
    }
    if (scaleX !== 1 || scaleY !== 1) {
      ctx.scale(scaleX, scaleY)
    }
    fillLine(line, 0, baselineOffset)
    ctx.restore()
  }

  withFieldRotation(ctx, field, () => {
    ctx.save()
    ctx.fillStyle = field.color
    ctx.textAlign = align
    ctx.textBaseline = 'alphabetic'

    const drawX =
      align === 'center'
        ? field.x + field.width / 2
        : align === 'right'
          ? field.x + field.width
          : field.x

    if (field.multiline) {
      const fontSize = field.fontSize
      const lineHeightPx = fontSize * (field.lineHeight ?? 1.25) * scaleY
      const lines = wrapTextLines(measureWidth, formatted, fontSize, field.width)
      const totalHeight = lines.length * lineHeightPx

      let startY = field.y + lineHeightPx / 2
      if (verticalAlign === 'middle') {
        startY = field.y + (field.height - totalHeight) / 2 + lineHeightPx / 2
      } else if (verticalAlign === 'bottom') {
        startY = field.y + field.height - totalHeight + lineHeightPx / 2
      }

      ctx.font = buildFontString(fontSize, field.fontWeight, fontFamily)
      const baselineOffset = measureAlphabeticCenterOffset(ctx, fontSize)
      lines.forEach((line, index) => {
        drawScaledLine(line, drawX, startY + index * lineHeightPx, baselineOffset)
      })
    } else {
      const fittedSize = computeFittedFontSize(
        measureWidth,
        formatted,
        field.fontSize,
        field.minFontSize,
        field.width
      )

      const visualHeight = fittedSize * scaleY
      let drawY = field.y + field.height / 2
      if (verticalAlign === 'top') {
        drawY = field.y + visualHeight / 2
      } else if (verticalAlign === 'bottom') {
        drawY = field.y + field.height - visualHeight / 2
      }

      ctx.font = buildFontString(fittedSize, field.fontWeight, fontFamily)
      const baselineOffset = measureAlphabeticCenterOffset(ctx, fittedSize)
      drawScaledLine(formatted, drawX, drawY, baselineOffset)
    }

    ctx.restore()
  })
}

function drawBarcodeField(
  ctx: CanvasRenderingContext2D,
  field: BarcodeFieldConfig,
  rawValue: string
): void {
  const barcodeCanvas = renderBarcodeCanvas(rawValue, {
    format: field.format,
    width: field.width,
    height: field.height,
    lineColor: field.lineColor,
    backgroundColor: field.backgroundColor,
    displayValue: field.displayValue,
    fontSize: field.fontSize,
  })
  if (!barcodeCanvas) return

  withFieldRotation(ctx, field, () => {
    ctx.drawImage(barcodeCanvas, field.x, field.y, field.width, field.height)
  })
}

function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  fields: readonly TemplateField[],
  selectedFieldId?: string | null
): void {
  for (const field of fields) {
    const isSelected = field.id === selectedFieldId
    withFieldRotation(ctx, field, () => {
      ctx.save()
      ctx.strokeStyle = isSelected ? '#603bff' : '#ff505e'
      ctx.fillStyle = isSelected ? 'rgba(96, 59, 255, 0.14)' : 'rgba(255, 80, 94, 0.08)'
      ctx.lineWidth = isSelected ? 3 : 2
      ctx.setLineDash(isSelected ? [] : [6, 4])
      ctx.fillRect(field.x, field.y, field.width, field.height)
      ctx.strokeRect(field.x, field.y, field.width, field.height)
      ctx.setLineDash([])

      // Small label tag at top-left of box
      const tag = `${field.id} (${field.x},${field.y})`
      ctx.font = '700 13px monospace'
      const tagWidth = ctx.measureText(tag).width + 10
      const tagY = Math.max(0, field.y - 20)
      ctx.fillStyle = isSelected ? '#603bff' : '#ff505e'
      ctx.fillRect(field.x, tagY, tagWidth, 18)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(tag, field.x + 5, tagY + 9)
      ctx.restore()
    })
  }
}

/**
 * Renders a single side of a document template to an HTMLCanvasElement.
 * Both the Live Preview, PNG/PDF Exporter, and Visual Template Designer share this exact function.
 */
export async function renderSideToCanvas(
  template: DocumentTemplateConfig,
  side: TemplateSide,
  values: CardFieldValues,
  options: RenderCardOptions = {}
): Promise<HTMLCanvasElement> {
  const mode = options.mode ?? 'filled'
  const scale = options.scale ?? 1

  const resolvedTemplateFonts = template.fonts.map((font) => ({
    ...font,
    url: resolveTemplateAssetUrl(template.id, font.url),
  }))
  const defaultBundledFont = findBundledFont(template.defaultFontId, options.extraFonts)
  const overrideBundledFont = findBundledFont(options.fontFamilyOverride, options.extraFonts)
  const fieldBundledFonts = side.fields
    .map((field) => ('fontId' in field ? findBundledFont(field.fontId, options.extraFonts) : undefined))
    .filter((font): font is NonNullable<typeof font> => Boolean(font))
  const fontsToLoad = [
    ...resolvedTemplateFonts,
    ...(defaultBundledFont ? [defaultBundledFont] : []),
    ...(overrideBundledFont ? [overrideBundledFont] : []),
    ...fieldBundledFonts,
  ]
  await loadTemplateFonts(fontsToLoad, options.assetOverrides)

  const resolvedDefaultFontFamily = buildCardFontStack(
    defaultBundledFont?.family,
    template.defaultFontFamily
  )
  const resolvedOverrideFontFamily = options.fontFamilyOverride
    ? options.fontFamilyOverride.includes(',')
      ? options.fontFamilyOverride
      : buildCardFontStack(
          overrideBundledFont?.family ?? options.fontFamilyOverride,
          template.defaultFontFamily
        )
    : undefined

  const bleed = computeBleedGeometry(
    template.canvasSize,
    template.physicalSizeMm,
    template.bleedMm,
    options.exportBleedMm
  )

  const canvas = options.targetCanvas ?? document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bleed.sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(bleed.sourceHeight * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context.')
  }

  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  // Shift origin so trimmed bleed edges fall outside the canvas while all config.json coordinates stay unchanged
  if (bleed.cropX > 0 || bleed.cropY > 0) {
    ctx.translate(-bleed.cropX, -bleed.cropY)
  }

  // 1. Background color fallback
  if (side.backgroundColor) {
    ctx.fillStyle = side.backgroundColor
    ctx.fillRect(0, 0, template.canvasSize.width, template.canvasSize.height)
  }

  // 2. Base artwork layer
  if (side.background) {
    const resolvedBg = resolveTemplateAssetUrl(template.id, side.background)
    const bgUrl = options.assetOverrides?.[side.background] ?? options.assetOverrides?.[resolvedBg] ?? resolvedBg
    const bgImage = await loadImage(bgUrl)
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, template.canvasSize.width, template.canvasSize.height)
    }
  }

  // 3. User fields (skipped in 'blank' mode so users can export an empty template!)
  if (mode === 'filled') {
    for (const field of side.fields) {
      if (field.type === 'photo') {
        await drawPhotoField(ctx, field, values[field.id], Boolean(options.showDebugBoxes))
      } else if (field.type === 'barcode') {
        const encoded = field.sourceFieldId ? values[field.sourceFieldId] : values[field.id]
        if (encoded) {
          drawBarcodeField(ctx, field, encoded)
        }
      } else if (field.type === 'date') {
        const formatted = formatDateString(values[field.id] ?? '', field.format, {
          fullWidth: field.fullWidth,
        })
        drawTextField(
          ctx,
          field,
          formatted,
          resolvedDefaultFontFamily,
          resolvedOverrideFontFamily,
          options.extraFonts
        )
      } else {
        drawTextField(
          ctx,
          field,
          values[field.id] ?? '',
          resolvedDefaultFontFamily,
          resolvedOverrideFontFamily,
          options.extraFonts
        )
      }
    }
  }

  // 4. Optional foreground overlay (e.g., official academy seal overlapping the user's photo)
  if (side.overlay) {
    const resolvedOverlay = resolveTemplateAssetUrl(template.id, side.overlay)
    const overlayUrl =
      options.assetOverrides?.[side.overlay] ??
      options.assetOverrides?.[resolvedOverlay] ??
      resolvedOverlay
    const overlayImage = await loadImage(overlayUrl)
    if (overlayImage) {
      ctx.drawImage(overlayImage, 0, 0, template.canvasSize.width, template.canvasSize.height)
    }
  }

  // 5. Optional finished-trim guide when rendered output includes bleed
  if (options.showTrimGuide && bleed.exportBleedMm > 0) {
    ctx.save()
    ctx.strokeStyle = '#00c8b4'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 6])
    ctx.strokeRect(
      bleed.trimBoxPx.x,
      bleed.trimBoxPx.y,
      bleed.trimBoxPx.width,
      bleed.trimBoxPx.height
    )
    ctx.setLineDash([])
    ctx.restore()
  }

  // 6. Optional debug/designer field bounding boxes
  if (options.showDebugBoxes) {
    drawDebugOverlay(ctx, side.fields, options.selectedFieldId)
  }

  ctx.restore()
  return canvas
}
