import type {
  DocumentTemplateConfig,
  FieldType,
  TemplateField,
  TemplateSide,
} from '@/templates/schema'

const MIN_BOX_SIZE = 20
const SAFE_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'])

function getImageExtension(fileName: string, mimeType?: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  if (match && SAFE_IMAGE_EXTENSIONS.has(match[1])) {
    return match[1] === 'jpeg' ? 'jpg' : match[1]
  }
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/svg+xml') return 'svg'
  if (mimeType === 'image/gif') return 'gif'
  return 'png'
}

/**
 * Generates clean, standardized relative filenames when users upload artwork in the Designer:
 * - background: `./front.png`, `./back.png`
 * - overlay: `./front-overlay.png`, `./back-overlay.png`
 * - thumbnail: `./thumb.png`
 */
export function buildStandardImagePath(
  kind: 'background' | 'overlay' | 'thumbnail',
  sideId: string,
  fileName: string,
  mimeType?: string
): string {
  const ext = getImageExtension(fileName, mimeType)
  if (kind === 'thumbnail') return `./thumb.${ext}`
  const safeSide =
    sideId
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'side'
  if (kind === 'overlay') return `./${safeSide}-overlay.${ext}`
  return `./${safeSide}.${ext}`
}

export function createBlankTemplate(): DocumentTemplateConfig {
  return {
    id: 'custom-card',
    category: 'id-card',
    organization: {
      en: 'Custom Organization',
      ja: 'カスタム組織',
      'zh-Hans': '自定义组织',
      'zh-Hant': '自訂組織',
    },
    name: {
      en: 'Custom ID Card',
      ja: 'カスタムIDカード',
      'zh-Hans': '自定义证件',
      'zh-Hant': '自訂證件',
    },
    description: {
      en: 'Custom Splatoon-style document template.',
      ja: 'カスタムテンプレート。',
      'zh-Hans': '自定义斯普拉遁风格证件模板。',
      'zh-Hant': '自訂斯普拉遁風格證件範本。',
    },
    themeAccent: 'blue',
    canvasSize: { width: 1011, height: 638 },
    physicalSizeMm: { width: 85.6, height: 53.98 },
    fonts: [],
    defaultFontFamily: "'Hiragino Sans', 'Noto Sans JP', 'Montserrat', sans-serif",
    sides: [
      {
        id: 'front',
        label: { en: 'Front', ja: '表面', 'zh-Hans': '正面', 'zh-Hant': '正面' },
        backgroundColor: '#f5f0e8',
        fields: [],
      },
    ],
  }
}

export function createUniqueFieldId(
  type: FieldType,
  allExistingFields: readonly TemplateField[]
): string {
  const existing = new Set(allExistingFields.map((f) => f.id))
  const base = type.replace(/-/g, '_')
  let index = 1
  while (existing.has(`${base}_${index}`)) {
    index += 1
  }
  return `${base}_${index}`
}

export function resolveUniqueFieldId(
  desiredId: string,
  existingIds: ReadonlySet<string>
): string {
  const trimmed = desiredId.trim() || 'field'
  if (!existingIds.has(trimmed)) return trimmed

  const base = trimmed.replace(/_\d+$/, '') || trimmed
  let suffix = 2
  while (existingIds.has(`${base}_${suffix}`)) {
    suffix += 1
  }
  return `${base}_${suffix}`
}

/**
 * Ensures every field across all sides has a unique, non-empty ID by auto-appending
 * sequential suffixes (`name` -> `name_2`, `name_3`, ...) to any duplicates.
 */
export function deduplicateTemplateFieldIds(
  config: DocumentTemplateConfig
): DocumentTemplateConfig {
  const seen = new Set<string>()
  let changed = false

  const nextSides = config.sides.map((side) => ({
    ...side,
    fields: side.fields.map((field) => {
      const rawId = field.id.trim()
      const nextId =
        rawId && !seen.has(rawId)
          ? rawId
          : resolveUniqueFieldId(rawId || field.type.replace(/-/g, '_'), seen)
      seen.add(nextId)
      if (nextId !== field.id) {
        changed = true
        return { ...field, id: nextId }
      }
      return field
    }),
  }))

  return changed ? { ...config, sides: nextSides } : config
}

/**
 * Deep-clones a field with a unique sequential ID (`name` -> `name_2`, `name_2` -> `name_3`)
 * and optionally offsets it inside `canvasSize`.
 */
export function duplicateTemplateField(
  source: TemplateField,
  allExistingFields: readonly TemplateField[],
  canvasSize: { width: number; height: number },
  offset: { x: number; y: number } = { x: 16, y: 16 }
): TemplateField {
  const existing = new Set(allExistingFields.map((f) => f.id))
  const nextId = resolveUniqueFieldId(source.id, existing)

  const cloned = JSON.parse(JSON.stringify(source)) as TemplateField
  const offsetRect = clampFieldRect(
    {
      x: cloned.x + offset.x,
      y: cloned.y + offset.y,
      width: cloned.width,
      height: cloned.height,
    },
    canvasSize
  )

  return {
    ...cloned,
    id: nextId,
    ...offsetRect,
  }
}

export interface SnapGuide {
  axis: 'x' | 'y'
  /** Canvas pixel coordinate where the guide line sits */
  position: number
}

export interface SmartSnapResult {
  x: number
  y: number
  guides: SnapGuide[]
}

/**
 * Snaps a dragged field box to canvas center and other fields' edges/centers within `threshold` px.
 */
export function computeSmartSnap(
  candidate: { x: number; y: number; width: number; height: number },
  otherFields: readonly TemplateField[],
  canvasSize: { width: number; height: number },
  threshold = 6
): SmartSnapResult {
  const xTargets = [canvasSize.width / 2]
  const yTargets = [canvasSize.height / 2]

  for (const field of otherFields) {
    xTargets.push(field.x, field.x + field.width / 2, field.x + field.width)
    yTargets.push(field.y, field.y + field.height / 2, field.y + field.height)
  }

  const xAnchors = [
    { value: candidate.x, apply: (target: number) => target },
    { value: candidate.x + candidate.width / 2, apply: (target: number) => target - candidate.width / 2 },
    { value: candidate.x + candidate.width, apply: (target: number) => target - candidate.width },
  ]

  const yAnchors = [
    { value: candidate.y, apply: (target: number) => target },
    { value: candidate.y + candidate.height / 2, apply: (target: number) => target - candidate.height / 2 },
    { value: candidate.y + candidate.height, apply: (target: number) => target - candidate.height },
  ]

  let bestDx = threshold + 1
  let snappedX = candidate.x
  let guideX: number | null = null

  for (const target of xTargets) {
    for (const anchor of xAnchors) {
      const diff = Math.abs(anchor.value - target)
      if (diff <= threshold && diff < bestDx) {
        bestDx = diff
        snappedX = Math.round(anchor.apply(target))
        guideX = target
      }
    }
  }

  let bestDy = threshold + 1
  let snappedY = candidate.y
  let guideY: number | null = null

  for (const target of yTargets) {
    for (const anchor of yAnchors) {
      const diff = Math.abs(anchor.value - target)
      if (diff <= threshold && diff < bestDy) {
        bestDy = diff
        snappedY = Math.round(anchor.apply(target))
        guideY = target
      }
    }
  }

  const clamped = clampFieldRect(
    { x: snappedX, y: snappedY, width: candidate.width, height: candidate.height },
    canvasSize
  )

  const guides: SnapGuide[] = []
  if (guideX !== null) guides.push({ axis: 'x', position: guideX })
  if (guideY !== null) guides.push({ axis: 'y', position: guideY })

  return { x: clamped.x, y: clamped.y, guides }
}

export function createDefaultField(
  type: FieldType,
  allExistingFields: readonly TemplateField[],
  canvasSize: { width: number; height: number }
): TemplateField {
  const id = createUniqueFieldId(type, allExistingFields)
  const cx = Math.round(canvasSize.width / 2)
  const cy = Math.round(canvasSize.height / 2)

  switch (type) {
    case 'photo':
      return {
        id,
        type: 'photo',
        label: { en: 'Photo', ja: '写真', 'zh-Hans': '照片', 'zh-Hant': '照片' },
        x: Math.max(0, cx - 120),
        y: Math.max(0, cy - 150),
        width: 240,
        height: 300,
        borderRadius: 8,
        fit: 'cover',
        placeholderLabel: 'PHOTO',
      }
    case 'date':
      return {
        id,
        type: 'date',
        label: { en: 'Date', ja: '日付', 'zh-Hans': '日期', 'zh-Hant': '日期' },
        x: Math.max(0, cx - 160),
        y: Math.max(0, cy - 24),
        width: 320,
        height: 48,
        fontSize: 24,
        minFontSize: 14,
        fontWeight: '700',
        color: '#0d0d0d',
        align: 'left',
        verticalAlign: 'middle',
        format: 'GGGEEE年M月D日',
        calendar: 'japanese-era',
        sampleValue: '2026-04-01',
      }
    case 'select-or-custom':
      return {
        id,
        type: 'select-or-custom',
        label: { en: 'Rank / Option', ja: '称号・選択肢', 'zh-Hans': '称号 / 选项', 'zh-Hant': '稱號 / 選項' },
        x: Math.max(0, cx - 160),
        y: Math.max(0, cy - 24),
        width: 320,
        height: 48,
        fontSize: 24,
        minFontSize: 14,
        fontWeight: '700',
        color: '#0d0d0d',
        align: 'left',
        verticalAlign: 'middle',
        presetId: 'salmon-run-ranks',
        allowCustom: true,
        sampleValue: 'でんせつ',
      }
    case 'splashtag-title':
      return {
        id,
        type: 'splashtag-title',
        label: { en: 'Splashtag Title', ja: '二つ名', 'zh-Hans': '铭牌称号', 'zh-Hant': '名牌稱號' },
        x: Math.max(0, cx - 180),
        y: Math.max(0, cy - 24),
        width: 360,
        height: 48,
        fontSize: 22,
        minFontSize: 14,
        fontWeight: '700',
        color: '#0d0d0d',
        align: 'left',
        verticalAlign: 'middle',
        presetId: 'splashtag-titles',
        joiner: '',
        allowCustom: true,
        sampleValue: '海女美術大学のアーティスト',
      }
    case 'barcode':
      return {
        id,
        type: 'barcode',
        label: { en: 'Barcode', ja: 'バーコード', 'zh-Hans': '条形码', 'zh-Hant': '條碼' },
        x: Math.max(0, cx - 200),
        y: Math.max(0, cy - 40),
        width: 400,
        height: 80,
        format: 'CODE128',
        lineColor: '#0d0d0d',
        backgroundColor: 'transparent',
        displayValue: false,
        sampleValue: 'GRZ-0777-SR',
      }
    case 'text':
    default:
      return {
        id,
        type: 'text',
        label: { en: 'Text Field', ja: 'テキスト', 'zh-Hans': '文本字段', 'zh-Hant': '文字欄位' },
        x: Math.max(0, cx - 160),
        y: Math.max(0, cy - 24),
        width: 320,
        height: 48,
        fontSize: 28,
        minFontSize: 14,
        fontWeight: '700',
        color: '#0d0d0d',
        align: 'left',
        verticalAlign: 'middle',
        sampleValue: 'サンプル文字',
      }
  }
}

export function clampFieldRect(
  rect: { x: number; y: number; width: number; height: number },
  canvasSize: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(MIN_BOX_SIZE, Math.min(canvasSize.width, Math.round(rect.width)))
  const height = Math.max(MIN_BOX_SIZE, Math.min(canvasSize.height, Math.round(rect.height)))
  const x = Math.max(0, Math.min(canvasSize.width - width, Math.round(rect.x)))
  const y = Math.max(0, Math.min(canvasSize.height - height, Math.round(rect.y)))
  return { x, y, width, height }
}

export function nudgeField(
  field: TemplateField,
  dx: number,
  dy: number,
  canvasSize: { width: number; height: number }
): TemplateField {
  const clamped = clampFieldRect(
    { x: field.x + dx, y: field.y + dy, width: field.width, height: field.height },
    canvasSize
  )
  return { ...field, ...clamped }
}

export function serializeTemplateConfig(config: DocumentTemplateConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`
}

/**
 * Formats an elapsed timestamp into a localized relative duration (e.g. "12 seconds ago",
 * "3 minutes ago", "2 hours ago"). Returns `null` when fewer than 5 seconds have elapsed
 * so callers can show a concise "just now" label.
 */
export function formatRelativeTimeAgo(
  savedAt: number,
  now: number,
  locale: string
): string | null {
  const diffSec = Math.max(0, Math.floor((now - savedAt) / 1000))
  if (diffSec < 5) return null

  let value: number
  let unit: Intl.RelativeTimeFormatUnit
  if (diffSec < 60) {
    value = diffSec
    unit = 'second'
  } else if (diffSec < 3600) {
    value = Math.floor(diffSec / 60)
    unit = 'minute'
  } else if (diffSec < 86400) {
    value = Math.floor(diffSec / 3600)
    unit = 'hour'
  } else {
    value = Math.floor(diffSec / 86400)
    unit = 'day'
  }

  if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function') {
    try {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(-value, unit)
    } catch {
      // Fallback below
    }
  }
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`
}

/**
 * Proportionally scales every field's coordinates, dimensions, typography, and corner radius
 * when a template's canvasSize changes (e.g., replacing artwork with a higher-res PNG).
 */
export function scaleTemplateFieldsToCanvas(
  sides: readonly TemplateSide[],
  fromSize: { width: number; height: number },
  toSize: { width: number; height: number }
): TemplateSide[] {
  if (
    fromSize.width <= 0 ||
    fromSize.height <= 0 ||
    toSize.width <= 0 ||
    toSize.height <= 0
  ) {
    return sides.map((side) => ({ ...side, fields: [...side.fields] }))
  }

  const scaleX = toSize.width / fromSize.width
  const scaleY = toSize.height / fromSize.height
  const scaleUniform = Math.min(scaleX, scaleY)

  return sides.map((side) => ({
    ...side,
    fields: side.fields.map((field): TemplateField => {
      const base = {
        ...field,
        x: Math.round(field.x * scaleX),
        y: Math.round(field.y * scaleY),
        width: Math.max(MIN_BOX_SIZE, Math.round(field.width * scaleX)),
        height: Math.max(MIN_BOX_SIZE, Math.round(field.height * scaleY)),
      }

      if (base.type === 'photo') {
        return {
          ...base,
          ...(base.borderRadius !== undefined
            ? { borderRadius: Math.max(0, Math.round(base.borderRadius * scaleUniform)) }
            : {}),
        }
      }

      if (
        base.type === 'text' ||
        base.type === 'date' ||
        base.type === 'select-or-custom' ||
        base.type === 'splashtag-title'
      ) {
        return {
          ...base,
          fontSize: Math.max(8, Math.round(base.fontSize * scaleUniform)),
          ...(base.minFontSize !== undefined
            ? { minFontSize: Math.max(6, Math.round(base.minFontSize * scaleUniform)) }
            : {}),
          ...(base.letterSpacing !== undefined && base.letterSpacing !== 0
            ? { letterSpacing: Number((base.letterSpacing * scaleX).toFixed(2)) }
            : {}),
        }
      }

      return base
    }),
  }))
}
