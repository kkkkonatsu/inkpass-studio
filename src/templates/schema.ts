import type { Locale } from '@/i18n'

/**
 * Localized strings inside a template config (used for form labels, hints, and card titles in the UI).
 * The card artwork itself stays in its authentic native language.
 */
export type LocalizedText = Partial<Record<Locale, string>> & {
  en?: string
  ja?: string
}

export function getLocalizedText(text: LocalizedText | undefined, locale: Locale): string {
  if (!text) return ''
  return text[locale] ?? text.en ?? text.ja ?? Object.values(text).find(Boolean) ?? ''
}

/**
 * Resolves a template asset path (e.g. "./front.png" or "overlay.svg") relative to
 * `/templates/<templateId>/`. Absolute paths ("/..."), data/blob URLs, and http(s) URLs
 * are returned untouched.
 */
export function resolveTemplateAssetUrl(
  templateId: string,
  assetPath: string | undefined
): string {
  if (!assetPath) return ''
  if (
    assetPath.startsWith('/') ||
    assetPath.startsWith('http://') ||
    assetPath.startsWith('https://') ||
    assetPath.startsWith('data:') ||
    assetPath.startsWith('blob:')
  ) {
    return assetPath
  }
  const cleaned = assetPath.replace(/^\.\//, '')
  return `/templates/${encodeURIComponent(templateId)}/${cleaned}`
}

export interface TemplateFont {
  /** CSS font-family name used by fields (e.g. "InkblotMincho") */
  family: string
  /** Public URL to .woff2 / .ttf / .otf file (e.g. "/card-fonts/my-font.woff2") */
  url: string
  weight?: string
  style?: string
}

export interface SelectOption {
  /** The exact string printed on the card (e.g. Japanese 称号 like "たつじん") */
  value: string
  /** Optional localized display label shown in the dropdown UI */
  label?: LocalizedText
}

export type FieldType =
  | 'text'
  | 'date'
  | 'select-or-custom'
  | 'splashtag-title'
  | 'photo'
  | 'barcode'

export type TextAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

export interface BaseField {
  id: string
  type: FieldType
  label: LocalizedText
  placeholder?: LocalizedText
  helpText?: LocalizedText
  /** Bounding box in native canvas pixels */
  x: number
  y: number
  width: number
  height: number
  /** Rotation around the center of the bounding box, in degrees */
  rotation?: number
  /** Sample value used when clicking "Fill Sample Data" or previewing in the Designer */
  sampleValue?: string
  defaultValue?: string
}

export interface TextStyleProps {
  fontSize: number
  /** Automatically shrink text down to this size if it exceeds `width` */
  minFontSize?: number
  /** Optional bundled font ID from `public/card-fonts/` for this specific field (overrides template default) */
  fontId?: string
  fontFamily?: string
  fontWeight?: string
  color: string
  align?: TextAlign
  verticalAlign?: VerticalAlign
  letterSpacing?: number
  /** Horizontal text scale in percent (default: 100, e.g. 80 for condensed text) */
  scaleX?: number
  /** Vertical text scale in percent (default: 100, e.g. 120 for taller text) */
  scaleY?: number
  /** Faux-italic horizontal skew in degrees (default: 0, e.g. 12 for forward italic slant) */
  skewX?: number
  multiline?: boolean
  lineHeight?: number
  prefix?: string
  suffix?: string
}

export interface TextFieldConfig extends BaseField, TextStyleProps {
  type: 'text'
  /** Optional random generator pattern (e.g. "AMA-####-##"). Shows a dice button when set. */
  randomPattern?: string
}

export interface DateFieldConfig extends BaseField, TextStyleProps {
  type: 'date'
  /**
   * Display format on card:
   * - Western: "YYYY.MM.DD", "YYYY/MM/DD", "YYYY年M月D日"
   * - Japanese Era (和暦): "GGGEEE年M月D日" (令和元年5月1日 / 令和8年4月1日), "GEE.MM.DD" (R08.04.01)
   */
  format?: string
  /** Optional hint for the editor UI: highlight Western or Japanese Era (和暦) input first */
  calendar?: 'gregorian' | 'japanese-era'
  /** Convert ASCII digits, letters, and punctuation in the rendered date to full-width (全角) */
  fullWidth?: boolean
}

export interface SelectOrCustomFieldConfig extends BaseField, TextStyleProps {
  type: 'select-or-custom'
  /** Reference a shared preset catalog in src/presets/ (e.g. "salmon-run-ranks") */
  presetId?: 'salmon-run-ranks'
  /** Inline options specific to this template (e.g. academy departments) */
  options?: SelectOption[]
  /** Allow typing a custom value outside the preset list (default: true) */
  allowCustom?: boolean
}

export interface SplashtagTitleFieldConfig extends BaseField, TextStyleProps {
  type: 'splashtag-title'
  /** Uses the Japanese Splatoon 3 二つ名 catalog ("splashtag-titles") */
  presetId?: 'splashtag-titles'
  /** String placed between prefix & suffix when combining (default: "") */
  joiner?: string
  /** Allow entering any custom text instead of picking from presets (default: true) */
  allowCustom?: boolean
}

export interface PhotoFieldConfig extends BaseField {
  type: 'photo'
  borderRadius?: number
  fit?: 'cover' | 'contain'
  grayscale?: boolean
  /** Optional text drawn inside the photo slot in sample/debug mode when no photo is uploaded */
  placeholderLabel?: string
}

export interface BarcodeFieldConfig extends BaseField {
  type: 'barcode'
  format?: 'CODE128' | 'CODE39' | 'EAN13'
  /** If set, encodes the value of another field (e.g. "employeeId") instead of showing a separate input */
  sourceFieldId?: string
  lineColor?: string
  backgroundColor?: string
  displayValue?: boolean
  fontSize?: number
  randomPattern?: string
}

export type TemplateField =
  | TextFieldConfig
  | DateFieldConfig
  | SelectOrCustomFieldConfig
  | SplashtagTitleFieldConfig
  | PhotoFieldConfig
  | BarcodeFieldConfig

export interface TemplateSide {
  id: string
  label: LocalizedText
  /** Base artwork URL (e.g. "/templates/inkblot-student-id/front.png") */
  background?: string
  /** Solid fallback color behind/instead of background image */
  backgroundColor?: string
  /** Optional foreground image drawn ABOVE user photo & text (e.g. stamp seal or laminate frame) */
  overlay?: string
  fields: TemplateField[]
}

export interface DocumentTemplateConfig {
  id: string
  /** Optional sort order in the Home gallery (lower appears first) */
  order?: number
  category: 'id-card' | 'certificate' | 'document'
  organization: LocalizedText
  name: LocalizedText
  description: LocalizedText
  themeAccent?: 'yellow' | 'blue' | 'orange' | 'green' | 'purple'
  /** Optional thumbnail preview image for the Home gallery */
  thumbnail?: string
  /** Native pixel dimensions of the template artwork & Canvas 2D coordinate space */
  canvasSize: {
    width: number
    height: number
  }
  /** Real-world finished (trimmed) print dimensions in millimeters (e.g. CR80: 85.6 x 53.98) */
  physicalSizeMm: {
    width: number
    height: number
  }
  /**
   * Optional print bleed included around all 4 edges of the template artwork, in millimeters (e.g. 3).
   * When > 0, `canvasSize` represents `physicalSizeMm + 2 * bleedMm`, and users can export
   * anywhere between `0 mm` (trimmed) and `bleedMm` (full bleed).
   */
  bleedMm?: number
  /** Custom font files loaded specifically for this template */
  fonts: TemplateFont[]
  /** Optional bundled font ID from `public/card-fonts/` (indexed in `src/fonts/card-fonts.json`) */
  defaultFontId?: string
  /** Default CSS font-family fallback stack used for fields that omit `fontFamily` */
  defaultFontFamily: string
  sides: TemplateSide[]
}

/** Flat map of `field.id -> string value` (photo fields store Data URL or Object URL). */
export type CardFieldValues = Record<string, string>

export interface TemplateValidationResult {
  valid: boolean
  errors: string[]
}

const VALID_FIELD_TYPES = new Set<FieldType>([
  'text',
  'date',
  'select-or-custom',
  'splashtag-title',
  'photo',
  'barcode',
])

/**
 * Lightweight runtime validator for `config.json` files (used both in tests and
 * when importing a JSON file inside the Template Designer).
 */
export function validateTemplateConfig(raw: unknown): TemplateValidationResult {
  const errors: string[] = []

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Config must be a JSON object.'] }
  }

  const config = raw as Partial<DocumentTemplateConfig>

  if (!config.id || typeof config.id !== 'string') {
    errors.push('Missing or invalid string property: "id".')
  }

  if (
    !config.canvasSize ||
    typeof config.canvasSize.width !== 'number' ||
    typeof config.canvasSize.height !== 'number' ||
    config.canvasSize.width <= 0 ||
    config.canvasSize.height <= 0
  ) {
    errors.push('"canvasSize" must have positive numeric width and height.')
  }

  if (
    !config.physicalSizeMm ||
    typeof config.physicalSizeMm.width !== 'number' ||
    typeof config.physicalSizeMm.height !== 'number' ||
    config.physicalSizeMm.width <= 0 ||
    config.physicalSizeMm.height <= 0
  ) {
    errors.push('"physicalSizeMm" must have positive numeric width and height.')
  }

  if (
    config.bleedMm !== undefined &&
    (typeof config.bleedMm !== 'number' || !Number.isFinite(config.bleedMm) || config.bleedMm < 0)
  ) {
    errors.push('"bleedMm" must be a non-negative number.')
  }

  if (!Array.isArray(config.sides) || config.sides.length === 0) {
    errors.push('"sides" must be a non-empty array.')
  } else {
    const seenSideIds = new Set<string>()
    const seenFieldIds = new Set<string>()

    for (const side of config.sides) {
      if (!side.id || typeof side.id !== 'string') {
        errors.push('Every side must have a string "id".')
      } else if (seenSideIds.has(side.id)) {
        errors.push(`Duplicate side id: "${side.id}".`)
      } else {
        seenSideIds.add(side.id)
      }

      if (!Array.isArray(side.fields)) {
        errors.push(`Side "${side.id ?? '?'}" must have a "fields" array.`)
        continue
      }

      for (const field of side.fields) {
        if (!field.id || typeof field.id !== 'string') {
          errors.push(`Field in side "${side.id}" is missing a string "id".`)
        } else if (seenFieldIds.has(field.id)) {
          errors.push(`Duplicate field id: "${field.id}".`)
        } else {
          seenFieldIds.add(field.id)
        }

        if (!VALID_FIELD_TYPES.has(field.type)) {
          errors.push(`Field "${field.id ?? '?'}" has unsupported type "${String(field.type)}".`)
        }

        if (
          typeof field.x !== 'number' ||
          typeof field.y !== 'number' ||
          typeof field.width !== 'number' ||
          typeof field.height !== 'number' ||
          field.width <= 0 ||
          field.height <= 0
        ) {
          errors.push(`Field "${field.id ?? '?'}" must have numeric x, y and positive width, height.`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/** Collects default or sample values across all sides of a template. */
export function collectTemplateValues(
  template: DocumentTemplateConfig,
  kind: 'default' | 'sample'
): CardFieldValues {
  const result: CardFieldValues = {}
  for (const side of template.sides) {
    for (const field of side.fields) {
      const value = kind === 'sample' ? (field.sampleValue ?? field.defaultValue) : field.defaultValue
      if (value !== undefined) {
        result[field.id] = value
      }
    }
  }
  return result
}
