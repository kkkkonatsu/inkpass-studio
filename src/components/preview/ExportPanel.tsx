import * as React from 'react'
import { Download, FileText, RotateCcw, Type } from 'lucide-react'
import { Button } from 'splatoon-ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'splatoon-ui/select'
import { computeBleedGeometry } from '@/engine/bleed'
import { renderSideToCanvas } from '@/engine/canvas-renderer'
import {
  canvasToPngBlob,
  canvasToPngBytes,
  createCardPdfBytes,
  downloadBlob,
  type PdfLayoutMode,
} from '@/engine/exporter'
import { registerUploadedFont } from '@/engine/font-loader'
import {
  findBundledFont,
  loadBundledFont,
  mergeCardFonts,
  type BundledCardFont,
} from '@/fonts'
import { useI18n } from '@/i18n'
import {
  getLocalizedText,
  type CardFieldValues,
  type DocumentTemplateConfig,
  type TemplateSide,
} from '@/templates/schema'

const TEMPLATE_DEFAULT_FONT_KEY = '__template_default__'
const UPLOADED_FONT_KEY = '__uploaded_font__'

export interface SelectedCardFont {
  source: 'bundled' | 'uploaded'
  id?: string
  name: string
  family: string
}

interface ExportPanelProps {
  template: DocumentTemplateConfig
  activeSide: TemplateSide
  values: CardFieldValues
  exportMode: 'filled' | 'blank'
  onExportModeChange: (next: 'filled' | 'blank') => void
  exportBleedMm: number
  onExportBleedMmChange: (next: number) => void
  selectedFont: SelectedCardFont | null
  onSelectedFontChange: (next: SelectedCardFont | null) => void
  assetOverrides?: Record<string, string>
  extraFonts?: readonly BundledCardFont[]
}

export function ExportPanel({
  template,
  activeSide,
  values,
  exportMode,
  onExportModeChange,
  exportBleedMm,
  onExportBleedMmChange,
  selectedFont,
  onSelectedFontChange,
  assetOverrides,
  extraFonts,
}: ExportPanelProps) {
  const { locale, t } = useI18n()
  const [pdfLayout, setPdfLayout] = React.useState<PdfLayoutMode>('card')
  const [isExporting, setIsExporting] = React.useState(false)
  const [fontError, setFontError] = React.useState<string | null>(null)

  const availableFonts = React.useMemo(() => mergeCardFonts(extraFonts), [extraFonts])
  const maxBleedMm = Math.max(0, template.bleedMm ?? 0)
  const bleedInfo = React.useMemo(
    () =>
      computeBleedGeometry(
        template.canvasSize,
        template.physicalSizeMm,
        maxBleedMm,
        exportBleedMm
      ),
    [template.canvasSize, template.physicalSizeMm, maxBleedMm, exportBleedMm]
  )

  const templateDefaultBundledFont = findBundledFont(template.defaultFontId, extraFonts)
  const templateDefaultLabel = templateDefaultBundledFont
    ? t('editor.fontDefaultNamed', { name: templateDefaultBundledFont.label })
    : t('editor.fontDefaultLabel')

  const handleSelectFontValue = async (nextValue: string | null) => {
    if (!nextValue) return
    setFontError(null)

    if (nextValue === TEMPLATE_DEFAULT_FONT_KEY) {
      onSelectedFontChange(null)
      return
    }

    if (nextValue === UPLOADED_FONT_KEY) {
      return
    }

    const bundled = findBundledFont(nextValue, extraFonts)
    if (bundled) {
      await loadBundledFont(bundled)
      onSelectedFontChange({
        source: 'bundled',
        id: bundled.id,
        name: bundled.label,
        family: bundled.family,
      })
    }
  }

  const handleFontUpload = async (file: File | undefined) => {
    if (!file) return
    setFontError(null)
    try {
      const family = await registerUploadedFont(file)
      onSelectedFontChange({ source: 'uploaded', name: file.name, family })
    } catch {
      setFontError(t('editor.fontLoadError'))
    }
  }

  const handleDownloadPng = async () => {
    setIsExporting(true)
    try {
      const canvas = await renderSideToCanvas(template, activeSide, values, {
        mode: exportMode,
        scale: 2,
        exportBleedMm: bleedInfo.exportBleedMm,
        fontFamilyOverride: selectedFont?.family,
        assetOverrides,
        extraFonts,
      })
      const blob = await canvasToPngBlob(canvas)
      const suffix = exportMode === 'blank' ? '-blank' : ''
      const sidePart = template.sides.length > 1 ? `-${activeSide.id}` : ''
      downloadBlob(blob, `${template.id}${sidePart}${suffix}.png`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadPdf = async () => {
    setIsExporting(true)
    try {
      const sidePngBuffers: Uint8Array[] = []
      for (const side of template.sides) {
        const canvas = await renderSideToCanvas(template, side, values, {
          mode: exportMode,
          scale: 2,
          exportBleedMm: bleedInfo.exportBleedMm,
          fontFamilyOverride: selectedFont?.family,
          assetOverrides,
          extraFonts,
        })
        sidePngBuffers.push(await canvasToPngBytes(canvas))
      }

      const pdfBytes = await createCardPdfBytes(sidePngBuffers, template.physicalSizeMm, {
        layout: pdfLayout,
        cropMarks: true,
        exportBleedMm: bleedInfo.exportBleedMm,
      })
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
      const suffix = exportMode === 'blank' ? '-blank' : ''
      const layoutPart = pdfLayout === 'a4-sheet' ? '-a4' : ''
      downloadBlob(blob, `${template.id}${layoutPart}${suffix}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }

  const selectValue =
    selectedFont?.source === 'bundled' && selectedFont.id
      ? selectedFont.id
      : selectedFont?.source === 'uploaded'
        ? UPLOADED_FONT_KEY
        : TEMPLATE_DEFAULT_FONT_KEY

  const triggerLabel =
    selectedFont?.source === 'bundled'
      ? selectedFont.name
      : selectedFont?.source === 'uploaded'
        ? t('editor.fontCustomActive', { name: selectedFont.name })
        : templateDefaultLabel

  return (
    <div className="space-y-5 rounded-xl border-3 border-chaos-black bg-[#f5f0e8] p-5 text-chaos-black shadow-[4px_4px_0px_#0d0d0d]">
      {/* Card font selector (bundled project fonts + user upload) */}
      <div className="space-y-2.5 border-b-2 border-chaos-black/15 pb-4">
        <div className="flex items-center gap-2 text-sm font-extrabold">
          <Type className="h-4 w-4 text-blue" />
          <span>{t('editor.fontSectionTitle')}</span>
        </div>

        {availableFonts.length > 0 ? (
          <Select value={selectValue} onValueChange={handleSelectFontValue}>
            <SelectTrigger className="w-full" aria-label={t('editor.fontSectionTitle')}>
              <SelectValue>{triggerLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TEMPLATE_DEFAULT_FONT_KEY}>{templateDefaultLabel}</SelectItem>
              {availableFonts.map((font) => (
                <SelectItem key={font.id} value={font.id}>
                  {font.label}
                </SelectItem>
              ))}
              {selectedFont?.source === 'uploaded' && (
                <SelectItem value={UPLOADED_FONT_KEY}>
                  {t('editor.fontCustomActive', { name: selectedFont.name })}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xs font-semibold text-chaos-black/70">{triggerLabel}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              className="sr-only"
              onChange={(e) => {
                handleFontUpload(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-chaos-black bg-white px-3 py-1.5 text-xs font-bold text-chaos-black transition-colors hover:bg-yellow">
              {t('editor.uploadFont')}
            </span>
          </label>

          {selectedFont && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => onSelectedFontChange(null)}
            >
              {t('editor.resetFont')}
            </Button>
          )}
        </div>

        {fontError && <p className="text-xs font-semibold text-red">{fontError}</p>}
      </div>

      {/* Export mode (Filled vs Blank Template) */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold tracking-wide text-chaos-black/70 uppercase">
          {t('export.modeLabel')}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onExportModeChange('filled')}
            className={`rounded-md border-2 border-chaos-black px-3 py-2 text-xs font-extrabold transition-colors ${
              exportMode === 'filled'
                ? 'bg-chaos-black text-yellow'
                : 'bg-white text-chaos-black hover:bg-yellow/40'
            }`}
          >
            {t('export.modeFilled')}
          </button>
          <button
            type="button"
            onClick={() => onExportModeChange('blank')}
            className={`rounded-md border-2 border-chaos-black px-3 py-2 text-xs font-extrabold transition-colors ${
              exportMode === 'blank'
                ? 'bg-chaos-black text-yellow'
                : 'bg-white text-chaos-black hover:bg-yellow/40'
            }`}
          >
            {t('export.modeBlank')}
          </button>
        </div>
      </div>

      {/* Bleed selector (shown only when the template defines bleedMm > 0) */}
      {maxBleedMm > 0 && (
        <div className="space-y-2 rounded-lg border-2 border-chaos-black/15 bg-white/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold tracking-wide text-chaos-black/75 uppercase">
              {t('export.bleedLabel')}
            </span>
            <span className="font-mono text-xs font-bold text-blue">
              {bleedInfo.exportBleedMm} mm ({bleedInfo.exportSizeMm.width} ×{' '}
              {bleedInfo.exportSizeMm.height} mm)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={maxBleedMm}
              step={0.5}
              value={bleedInfo.exportBleedMm}
              onChange={(e) => onExportBleedMmChange(Number(e.target.value))}
              className="flex-1 accent-blue"
            />
            <input
              type="number"
              min={0}
              max={maxBleedMm}
              step={0.5}
              value={bleedInfo.exportBleedMm}
              onChange={(e) => {
                const parsed = Number(e.target.value)
                const clamped = Number.isFinite(parsed)
                  ? Math.max(0, Math.min(maxBleedMm, parsed))
                  : 0
                onExportBleedMmChange(clamped)
              }}
              className="w-16 rounded border-2 border-chaos-black/25 bg-white px-2 py-1 text-right font-mono text-xs font-bold"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-chaos-black/60">
            <span>{t('export.bleedHint', { max: maxBleedMm })}</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onExportBleedMmChange(0)}
                className="rounded border border-chaos-black/25 bg-white px-2 py-0.5 text-[11px] font-bold hover:bg-yellow"
              >
                0 mm
              </button>
              <button
                type="button"
                onClick={() => onExportBleedMmChange(maxBleedMm)}
                className="rounded border border-chaos-black/25 bg-white px-2 py-0.5 text-[11px] font-bold hover:bg-yellow"
              >
                {maxBleedMm} mm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF layout mode */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold tracking-wide text-chaos-black/70 uppercase">
          {t('export.pdfLayoutLabel')}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPdfLayout('card')}
            className={`rounded-md border-2 border-chaos-black px-3 py-2 text-xs font-extrabold transition-colors ${
              pdfLayout === 'card'
                ? 'bg-blue text-white'
                : 'bg-white text-chaos-black hover:bg-blue/10'
            }`}
          >
            {t('export.layoutCard', {
              w: bleedInfo.exportSizeMm.width,
              h: bleedInfo.exportSizeMm.height,
            })}
          </button>
          <button
            type="button"
            onClick={() => setPdfLayout('a4-sheet')}
            className={`rounded-md border-2 border-chaos-black px-3 py-2 text-xs font-extrabold transition-colors ${
              pdfLayout === 'a4-sheet'
                ? 'bg-blue text-white'
                : 'bg-white text-chaos-black hover:bg-blue/10'
            }`}
          >
            {t('export.layoutA4')}
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2.5 pt-1">
        <Button
          type="button"
          size="sm"
          variant="yellow"
          hasChevron={false}
          className="w-full"
          leftIcon={<Download className="h-4 w-4" />}
          disabled={isExporting}
          onClick={handleDownloadPng}
        >
          {isExporting ? t('export.exporting') : t('export.downloadPng')}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="blue"
          hasChevron={false}
          className="w-full"
          leftIcon={<FileText className="h-4 w-4" />}
          disabled={isExporting}
          onClick={handleDownloadPdf}
        >
          {isExporting ? t('export.exporting') : t('export.downloadPdf')}
        </Button>
      </div>

      {template.sides.length > 1 && (
        <p className="text-xs text-chaos-black/65">
          {t('export.multiSidePngHint', { side: getLocalizedText(activeSide.label, locale) })}
        </p>
      )}
    </div>
  )
}
