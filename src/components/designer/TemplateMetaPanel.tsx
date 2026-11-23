import * as React from 'react'
import {
  AlertCircle,
  FileText,
  ImagePlus,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react'
import { Input } from 'splatoon-ui/input'
import { BUNDLED_CARD_FONTS, type BundledCardFont } from '@/fonts'
import { useI18n, type Locale } from '@/i18n'
import {
  getLocalizedText,
  resolveTemplateAssetUrl,
  type DocumentTemplateConfig,
  type TemplateSide,
} from '@/templates/schema'
import {
  CREDITS_STARTER_TEMPLATE,
  LICENSE_PRESETS,
  type TemplateDocs,
} from '@/templates/template-docs'

interface TemplateMetaPanelProps {
  template: DocumentTemplateConfig
  activeSide: TemplateSide
  assetOverrides?: Record<string, string>
  extraFonts?: readonly BundledCardFont[]
  docs: TemplateDocs
  onUpdateTemplate: (patch: Partial<DocumentTemplateConfig>) => void
  onUpdateDocs: (patch: Partial<TemplateDocs>) => void
  onAddSide: () => void
  onRemoveSide: (sideId: string) => void
  onUploadLocalImage: (kind: 'background' | 'overlay' | 'thumbnail', file: File) => void
  onRemoveSideImage: (kind: 'background' | 'overlay' | 'thumbnail') => void
  onGenerateThumbnail: () => void
  isGeneratingThumbnail?: boolean
  onUploadLocalFont: (file: File) => void
  onRemoveLocalFont: (fontId: string) => void
}

function useImageAvailability(
  templateId: string,
  rawPath: string | undefined,
  assetOverrides: Record<string, string>
): 'idle' | 'ok' | 'missing' {
  const [status, setStatus] = React.useState<'idle' | 'ok' | 'missing'>('idle')

  React.useEffect(() => {
    const trimmed = rawPath?.trim()
    if (!trimmed) {
      setStatus('idle')
      return
    }

    const resolvedDefault = resolveTemplateAssetUrl(templateId, trimmed)
    const overrideUrl = assetOverrides[trimmed] ?? assetOverrides[resolvedDefault]
    if (overrideUrl) {
      setStatus('ok')
      return
    }

    let cancelled = false
    const timerId = window.setTimeout(() => {
      const img = new Image()
      img.onload = () => {
        if (!cancelled) setStatus('ok')
      }
      img.onerror = () => {
        if (!cancelled) setStatus('missing')
      }
      img.src = resolvedDefault
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [templateId, rawPath, assetOverrides])

  return status
}

const META_LOCALES: Array<{ code: Locale; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-Hans', label: '简中' },
  { code: 'zh-Hant', label: '繁中' },
]

export function TemplateMetaPanel({
  template,
  activeSide,
  assetOverrides = {},
  extraFonts = [],
  docs,
  onUpdateTemplate,
  onUpdateDocs,
  onAddSide,
  onRemoveSide,
  onUploadLocalImage,
  onRemoveSideImage,
  onGenerateThumbnail,
  isGeneratingThumbnail = false,
  onUploadLocalFont,
  onRemoveLocalFont,
}: TemplateMetaPanelProps) {
  const { locale, t } = useI18n()
  const [metaLocale, setMetaLocale] = React.useState<Locale>(locale)
  const [selectedLicenseId, setSelectedLicenseId] = React.useState<string>(LICENSE_PRESETS[0].id)
  const bgStatus = useImageAvailability(template.id, activeSide.background, assetOverrides)
  const overlayStatus = useImageAvailability(template.id, activeSide.overlay, assetOverrides)
  const thumbStatus = useImageAvailability(template.id, template.thumbnail, assetOverrides)
  const resolvePreviewUrl = (rawPath: string | undefined): string | undefined => {
    if (!rawPath) return undefined
    const resolved = resolveTemplateAssetUrl(template.id, rawPath)
    return assetOverrides[rawPath] ?? assetOverrides[resolved] ?? resolved
  }
  const resolvedBgPreview = resolvePreviewUrl(activeSide.background)
  const resolvedOverlayPreview = resolvePreviewUrl(activeSide.overlay)
  const resolvedThumbPreview = resolvePreviewUrl(template.thumbnail)

  const selectedLicense =
    LICENSE_PRESETS.find((preset) => preset.id === selectedLicenseId) ?? LICENSE_PRESETS[0]

  const uploadedFontIds = React.useMemo(
    () => new Set(extraFonts.map((font) => font.id)),
    [extraFonts]
  )
  const siteFonts = React.useMemo(
    () => BUNDLED_CARD_FONTS.filter((font) => !uploadedFontIds.has(font.id)),
    [uploadedFontIds]
  )

  const handleUploadTextDoc = async (kind: 'credits' | 'license', file: File | undefined) => {
    if (!file) return
    const content = await file.text()
    onUpdateDocs({ [kind]: content })
  }

  return (
    <div className="space-y-5">
      {/* Side artwork (upload-first) */}
      <div className="space-y-4 rounded-lg border-2 border-chaos-black bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs font-black text-blue">
            {t('designerForm.sideLabel', { id: activeSide.id })}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onAddSide}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border-2 border-chaos-black bg-yellow px-2.5 py-1 text-[11px] font-extrabold text-chaos-black transition-colors hover:bg-yellow/80"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t('designer.addSide')}</span>
            </button>
            {template.sides.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveSide(activeSide.id)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border-2 border-chaos-black bg-red px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-red/90"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('designer.removeSide')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Background image */}
        <div className="space-y-2 border-t border-chaos-black/15 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border-2 border-chaos-black bg-yellow px-3 py-1.5 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow/80">
              <ImagePlus className="h-4 w-4" />
              <span>{t('designer.uploadBgPreview')}</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUploadLocalImage('background', file)
                  e.target.value = ''
                }}
              />
            </label>

            {activeSide.background && (
              <button
                type="button"
                onClick={() => onRemoveSideImage('background')}
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-chaos-black/25 px-2 py-1 text-[11px] font-bold text-red hover:bg-red/10"
              >
                <X className="h-3.5 w-3.5" />
                <span>{t('designer.removeAsset')}</span>
              </button>
            )}
          </div>

          {resolvedBgPreview && bgStatus === 'ok' && (
            <div className="overflow-hidden rounded-md border-2 border-chaos-black/20 bg-chaos-black/5">
              <img
                src={resolvedBgPreview}
                alt="Background preview"
                className="max-h-28 w-full object-contain"
              />
            </div>
          )}

          {bgStatus === 'missing' && (
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-red">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{t('designer.imageFileNotFound')}</span>
            </p>
          )}
        </div>

        {/* Overlay image (optional) */}
        <div className="space-y-2 border-t border-chaos-black/15 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border-2 border-chaos-black bg-white px-3 py-1.5 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow/40">
              <ImagePlus className="h-4 w-4" />
              <span>{t('designer.uploadOverlayPreview')}</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUploadLocalImage('overlay', file)
                  e.target.value = ''
                }}
              />
            </label>

            {activeSide.overlay && (
              <button
                type="button"
                onClick={() => onRemoveSideImage('overlay')}
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-chaos-black/25 px-2 py-1 text-[11px] font-bold text-red hover:bg-red/10"
              >
                <X className="h-3.5 w-3.5" />
                <span>{t('designer.removeAsset')}</span>
              </button>
            )}
          </div>

          {resolvedOverlayPreview && overlayStatus === 'ok' && (
            <div className="overflow-hidden rounded-md border-2 border-chaos-black/20 bg-[conic-gradient(#e5e7eb_90deg,#ffffff_90deg_180deg,#e5e7eb_180deg_270deg,#ffffff_270deg)] bg-[length:12px_12px]">
              <img
                src={resolvedOverlayPreview}
                alt="Overlay preview"
                className="max-h-28 w-full object-contain"
              />
            </div>
          )}

          {overlayStatus === 'missing' && (
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-red">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{t('designer.imageFileNotFound')}</span>
            </p>
          )}
        </div>
      </div>

      {/* Fonts (upload-first, site fonts secondary) */}
      <div className="space-y-3 rounded-lg border-2 border-chaos-black bg-white p-4">
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border-2 border-chaos-black bg-yellow px-3 py-1.5 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow/80">
            <Type className="h-4 w-4" />
            <span>{t('designer.uploadFontPreview')}</span>
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUploadLocalFont(file)
                e.target.value = ''
              }}
            />
          </label>

          {extraFonts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {extraFonts.map((font) => (
                <span
                  key={font.id}
                  className="inline-flex items-center gap-1 rounded-md border border-blue/30 bg-blue/10 px-2 py-1 text-[11px] font-bold text-blue"
                >
                  <span>{font.label}</span>
                  <button
                    type="button"
                    aria-label={`${t('designer.removeAsset')} ${font.label}`}
                    onClick={() => onRemoveLocalFont(font.id)}
                    className="cursor-pointer rounded hover:bg-blue/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <label className="block space-y-1 border-t border-chaos-black/15 pt-3 text-xs font-bold">
          <span>{t('designer.templateFontLabel')}</span>
          <select
            value={template.defaultFontId ?? ''}
            onChange={(e) =>
              onUpdateTemplate({ defaultFontId: e.target.value || undefined })
            }
            className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
          >
            <option value="">{t('designer.systemFontOption')}</option>
            {extraFonts.length > 0 && (
              <optgroup label={t('designer.uploadedFontsGroup')}>
                {extraFonts.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </optgroup>
            )}
            {siteFonts.length > 0 && (
              <optgroup label={t('designer.siteFontsGroup')}>
                {siteFonts.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <p className="text-[11px] font-medium text-chaos-black/60">
          {t('designer.siteFontsHint')}
        </p>

        <details className="border-t border-chaos-black/15 pt-2">
          <summary className="cursor-pointer text-[11px] font-extrabold text-chaos-black/65 hover:text-blue">
            {t('designer.advancedSettings')}
          </summary>
          <div className="pt-2">
            <label className="block space-y-1 text-xs font-bold text-chaos-black/75">
              <span>{t('designerForm.fallbackFontStack')}</span>
              <Input
                value={template.defaultFontFamily}
                onChange={(e) => onUpdateTemplate({ defaultFontFamily: e.target.value })}
              />
            </label>
          </div>
        </details>
      </div>

      {/* Core template identity & dimensions */}
      <div className="space-y-3 rounded-lg border-2 border-chaos-black bg-white p-4">
        <div className="grid grid-cols-4 gap-1 rounded-md border-2 border-chaos-black/20 bg-chaos-black/5 p-1">
          {META_LOCALES.map((item) => {
            const active = metaLocale === item.code
            const hasContent = Boolean(
              template.name[item.code]?.trim() ||
                template.organization[item.code]?.trim() ||
                template.description[item.code]?.trim()
            )
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => setMetaLocale(item.code)}
                className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded px-2 py-1 text-[11px] font-extrabold transition-colors ${
                  active
                    ? 'bg-chaos-black text-yellow'
                    : 'text-chaos-black/75 hover:bg-white hover:text-chaos-black'
                }`}
              >
                <span>{item.label}</span>
                {hasContent && (
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-yellow' : 'bg-blue'}`}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="space-y-2.5">
          <label className="block space-y-1 text-xs font-bold">
            <span>{t('designerForm.templateName')}</span>
            <Input
              value={template.name[metaLocale] ?? ''}
              onChange={(e) =>
                onUpdateTemplate({ name: { ...template.name, [metaLocale]: e.target.value } })
              }
            />
          </label>
          <label className="block space-y-1 text-xs font-bold">
            <span>{t('designerForm.templateOrg')}</span>
            <Input
              value={template.organization[metaLocale] ?? ''}
              onChange={(e) =>
                onUpdateTemplate({
                  organization: { ...template.organization, [metaLocale]: e.target.value },
                })
              }
            />
          </label>
          <label className="block space-y-1 text-xs font-bold">
            <span>{t('designerForm.templateDesc')}</span>
            <Input
              value={template.description[metaLocale] ?? ''}
              onChange={(e) =>
                onUpdateTemplate({
                  description: { ...template.description, [metaLocale]: e.target.value },
                })
              }
            />
          </label>
        </div>

        <label className="block space-y-1 border-t border-chaos-black/15 pt-3 text-xs font-bold">
          <span>{t('designerForm.templateId')}</span>
          <Input
            value={template.id}
            placeholder="my-card-id"
            className="font-mono"
            onChange={(e) => onUpdateTemplate({ id: e.target.value })}
          />
          <p className="text-[11px] font-medium text-chaos-black/60">
            {t('designerForm.templateIdHint')}
          </p>
        </label>

        <label className="block space-y-1 text-xs font-bold">
          <span>{t('designerForm.accentColor')}</span>
          <select
            value={template.themeAccent ?? 'blue'}
            onChange={(e) =>
              onUpdateTemplate({
                themeAccent: e.target.value as DocumentTemplateConfig['themeAccent'],
              })
            }
            className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
          >
            <option value="blue">{t('designerForm.colorBlue')}</option>
            <option value="orange">{t('designerForm.colorOrange')}</option>
            <option value="yellow">{t('designerForm.colorYellow')}</option>
            <option value="green">{t('designerForm.colorGreen')}</option>
            <option value="purple">{t('designerForm.colorPurple')}</option>
          </select>
        </label>

        {/* Gallery Thumbnail (optional, template-wide) */}
        <div className="space-y-2 border-t border-chaos-black/15 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={isGeneratingThumbnail}
                onClick={onGenerateThumbnail}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-chaos-black bg-yellow px-3 py-1.5 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {isGeneratingThumbnail
                    ? t('designer.generatingThumbnail')
                    : t('designer.generateThumbnail')}
                </span>
              </button>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-chaos-black bg-white px-3 py-1.5 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow/40">
                <ImagePlus className="h-3.5 w-3.5" />
                <span>{t('designer.uploadThumbnail')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onUploadLocalImage('thumbnail', file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            {template.thumbnail && (
              <button
                type="button"
                onClick={() => onRemoveSideImage('thumbnail')}
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-chaos-black/25 px-2 py-1 text-[11px] font-bold text-red hover:bg-red/10"
              >
                <X className="h-3.5 w-3.5" />
                <span>{t('designer.removeAsset')}</span>
              </button>
            )}
          </div>

          {resolvedThumbPreview && thumbStatus === 'ok' && (
            <div className="overflow-hidden rounded-md border-2 border-chaos-black/20 bg-chaos-black/5">
              <img
                src={resolvedThumbPreview}
                alt="Thumbnail preview"
                className="max-h-28 w-full object-contain"
              />
            </div>
          )}

          {thumbStatus === 'missing' && (
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-red">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{t('designer.imageFileNotFound')}</span>
            </p>
          )}
          <p className="text-[11px] font-medium text-chaos-black/60">
            {t('designer.thumbnailHint')}
          </p>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-2 border-t border-chaos-black/15 pt-3">
          <label className="space-y-1 text-xs font-bold">
            <span>{t('designerForm.canvasWidth')}</span>
            <Input
              type="number"
              min={100}
              value={template.canvasSize.width}
              onChange={(e) =>
                onUpdateTemplate({
                  canvasSize: {
                    ...template.canvasSize,
                    width: Math.max(100, Number(e.target.value) || 100),
                  },
                })
              }
            />
          </label>
          <label className="space-y-1 text-xs font-bold">
            <span>{t('designerForm.canvasHeight')}</span>
            <Input
              type="number"
              min={100}
              value={template.canvasSize.height}
              onChange={(e) =>
                onUpdateTemplate({
                  canvasSize: {
                    ...template.canvasSize,
                    height: Math.max(100, Number(e.target.value) || 100),
                  },
                })
              }
            />
          </label>
          <label className="space-y-1 text-xs font-bold">
            <span>{t('designerForm.physicalWidth')}</span>
            <Input
              type="number"
              step={0.1}
              min={10}
              value={template.physicalSizeMm.width}
              onChange={(e) =>
                onUpdateTemplate({
                  physicalSizeMm: {
                    ...template.physicalSizeMm,
                    width: Math.max(10, Number(e.target.value) || 10),
                  },
                })
              }
            />
          </label>
          <label className="space-y-1 text-xs font-bold">
            <span>{t('designerForm.physicalHeight')}</span>
            <Input
              type="number"
              step={0.1}
              min={10}
              value={template.physicalSizeMm.height}
              onChange={(e) =>
                onUpdateTemplate({
                  physicalSizeMm: {
                    ...template.physicalSizeMm,
                    height: Math.max(10, Number(e.target.value) || 10),
                  },
                })
              }
            />
          </label>
          <label className="col-span-2 space-y-1 text-xs font-bold">
            <span>{t('designerForm.templateBleed')}</span>
            <Input
              type="number"
              step={0.5}
              min={0}
              value={template.bleedMm ?? 0}
              onChange={(e) => {
                const next = Math.max(0, Number(e.target.value) || 0)
                onUpdateTemplate({ bleedMm: next > 0 ? next : undefined })
              }}
            />
          </label>
        </div>
      </div>

      {/* Credits & License text files */}
      <div className="space-y-4 rounded-lg border-2 border-chaos-black bg-white p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-black tracking-wide text-chaos-black uppercase">
            <Scale className="h-4 w-4 text-blue" />
            <span>{t('designer.docsSectionTitle')}</span>
          </div>
          <p className="text-[11px] font-medium text-chaos-black/65">
            {t('designer.docsSectionHint')}
          </p>
        </div>

        {/* CREDITS.txt */}
        <div className="space-y-2 border-t border-chaos-black/15 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-black text-chaos-black">CREDITS.txt</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateDocs({ credits: CREDITS_STARTER_TEMPLATE })}
                className="inline-flex cursor-pointer items-center gap-1 rounded border-2 border-chaos-black bg-yellow px-2 py-1 text-[11px] font-extrabold text-chaos-black transition-colors hover:bg-yellow/80"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>{t('designer.insertCreditsStarter')}</span>
              </button>

              <label className="inline-flex cursor-pointer items-center gap-1 rounded border-2 border-chaos-black bg-white px-2 py-1 text-[11px] font-extrabold text-chaos-black transition-colors hover:bg-yellow/40">
                <Upload className="h-3.5 w-3.5" />
                <span>{t('designer.uploadTextFile')}</span>
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="sr-only"
                  onChange={(e) => {
                    void handleUploadTextDoc('credits', e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>

              {docs.credits?.trim() && (
                <button
                  type="button"
                  onClick={() => onUpdateDocs({ credits: undefined })}
                  className="inline-flex cursor-pointer items-center gap-1 rounded border border-chaos-black/25 px-2 py-1 text-[11px] font-bold text-red hover:bg-red/10"
                >
                  {t('designer.clearDoc')}
                </button>
              )}
            </div>
          </div>

          <textarea
            rows={5}
            value={docs.credits ?? ''}
            placeholder={t('designer.creditsPlaceholder')}
            onChange={(e) => onUpdateDocs({ credits: e.target.value })}
            className="w-full rounded border-2 border-chaos-black/25 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-chaos-black focus:border-blue focus:outline-none"
          />
        </div>

        {/* LICENSE.txt */}
        <div className="space-y-2.5 border-t border-chaos-black/15 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-black text-chaos-black">LICENSE.txt</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border-2 border-chaos-black bg-white px-2 py-1 text-[11px] font-extrabold text-chaos-black transition-colors hover:bg-yellow/40">
                <Upload className="h-3.5 w-3.5" />
                <span>{t('designer.uploadTextFile')}</span>
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="sr-only"
                  onChange={(e) => {
                    void handleUploadTextDoc('license', e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>

              {docs.license?.trim() && (
                <button
                  type="button"
                  onClick={() => onUpdateDocs({ license: undefined })}
                  className="inline-flex cursor-pointer items-center gap-1 rounded border border-chaos-black/25 px-2 py-1 text-[11px] font-bold text-red hover:bg-red/10"
                >
                  {t('designer.clearDoc')}
                </button>
              )}
            </div>
          </div>

          {/* Recommended license preset picker + explanation */}
          <div className="space-y-2 rounded-md border border-chaos-black/15 bg-chaos-black/[0.03] p-2.5">
            <div className="text-[11px] font-extrabold text-chaos-black/75">
              {t('designer.licensePresetLabel')}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedLicense.id}
                onChange={(e) => setSelectedLicenseId(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold text-chaos-black"
              >
                {LICENSE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                    {preset.recommended ? ` (${t('designer.recommendedTag')})` : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => onUpdateDocs({ license: selectedLicense.text })}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded border-2 border-chaos-black bg-yellow px-3 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow/80"
              >
                {t('designer.applyLicensePreset')}
              </button>
            </div>

            <p className="text-[11px] leading-snug font-semibold text-chaos-black/75">
              {getLocalizedText(selectedLicense.summary, locale)}
            </p>

            <details className="pt-0.5">
              <summary className="cursor-pointer text-[11px] font-extrabold text-blue hover:underline">
                {t('designer.compareLicenses')}
              </summary>
              <div className="mt-2 space-y-1.5 border-t border-chaos-black/10 pt-2">
                {LICENSE_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-start justify-between gap-2 rounded bg-white p-2 text-[11px]"
                  >
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-chaos-black">
                        {preset.name}
                        {preset.recommended && (
                          <span className="ml-1.5 rounded bg-yellow px-1.5 py-0.5 text-[10px] font-black text-chaos-black">
                            {t('designer.recommendedTag')}
                          </span>
                        )}
                      </div>
                      <p className="leading-snug text-chaos-black/70">
                        {getLocalizedText(preset.summary, locale)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLicenseId(preset.id)
                        onUpdateDocs({ license: preset.text })
                      }}
                      className="shrink-0 cursor-pointer rounded border border-chaos-black/30 bg-chaos-black/5 px-2 py-1 text-[10px] font-extrabold text-chaos-black hover:bg-yellow"
                    >
                      {t('designer.usePresetShort')}
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>

          <textarea
            rows={6}
            value={docs.license ?? ''}
            placeholder={t('designer.licensePlaceholder')}
            onChange={(e) => onUpdateDocs({ license: e.target.value })}
            className="w-full rounded border-2 border-chaos-black/25 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-chaos-black focus:border-blue focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
