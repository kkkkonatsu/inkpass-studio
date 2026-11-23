import * as React from 'react'
import { ArrowLeft, Eraser, Scale, Sparkles, Wrench } from 'lucide-react'
import { Badge } from 'splatoon-ui/badge'
import { Button } from 'splatoon-ui/button'
import { Loader } from 'splatoon-ui/loader'
import { Section } from 'splatoon-ui/section'
import { SegmentedControl, SegmentedControlItem } from 'splatoon-ui/segmented-control'
import { TornCard, TornCardDescription, TornCardTitle } from 'splatoon-ui/torn-card'
import { DynamicForm } from '@/components/editor/DynamicForm'
import { TemplateDocsModal } from '@/components/editor/TemplateDocsModal'
import { ExportPanel, type SelectedCardFont } from '@/components/preview/ExportPanel'
import { LiveCardPreview } from '@/components/preview/LiveCardPreview'
import { computeBleedGeometry } from '@/engine/bleed'
import { useDraftValues } from '@/hooks/use-draft-values'
import { useI18n } from '@/i18n'
import { buildHashPath } from '@/router'
import { useRuntimeTemplates } from '@/templates/runtime-store'
import { getLocalizedText } from '@/templates/schema'
import { hasTemplateDocs } from '@/templates/template-docs'

interface EditorPageProps {
  templateId: string
}

export function EditorPage({ templateId }: EditorPageProps) {
  const { locale, t } = useI18n()
  const { getTemplateEntry, isHydrating } = useRuntimeTemplates()
  const entry = React.useMemo(() => getTemplateEntry(templateId), [getTemplateEntry, templateId])
  const template = entry?.config

  const { values, setFieldValue, fillSample, clearAll } = useDraftValues(template)
  const [activeSideId, setActiveSideId] = React.useState<string>(() => template?.sides[0]?.id ?? 'front')
  const [exportMode, setExportMode] = React.useState<'filled' | 'blank'>('filled')
  const [exportBleedMm, setExportBleedMm] = React.useState<number>(0)
  const [selectedFont, setSelectedFont] = React.useState<SelectedCardFont | null>(null)
  const [docsModalOpen, setDocsModalOpen] = React.useState(false)

  const showDebugBoxes = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('debug') === '1'
  }, [])

  React.useEffect(() => {
    if (template) {
      setActiveSideId(template.sides[0]?.id ?? 'front')
      setExportMode('filled')
      setExportBleedMm(0)
      setSelectedFont(null)
    }
  }, [template])

  if (!template) {
    if (isHydrating) {
      return (
        <Section
          size="md"
          backgroundClassName="bg-white"
          textClassName="text-chaos-black"
          pattern="chip-white"
        >
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader variant="blue" size="2em" />
          </div>
        </Section>
      )
    }

    return (
      <Section size="md" backgroundClassName="bg-white" textClassName="text-chaos-black" pattern="chip-white">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div>
            <a
              href={buildHashPath({ page: 'home' })}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-chaos-black/65 underline-offset-4 transition-colors hover:text-blue hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('editor.backToTemplates')}</span>
            </a>
          </div>
          <TornCard variant="a" rotation="0deg" background="#f5f0e8">
            <div className="space-y-3 p-6">
              <TornCardTitle className="text-2xl text-chaos-black">
                {t('editor.notFoundTitle')}
              </TornCardTitle>
              <TornCardDescription className="text-sm text-chaos-black/75">
                {t('editor.notFoundDescription', { id: templateId })}
              </TornCardDescription>
            </div>
          </TornCard>
        </div>
      </Section>
    )
  }

  const activeSide = template.sides.find((s) => s.id === activeSideId) ?? template.sides[0]
  const previewBleed = computeBleedGeometry(
    template.canvasSize,
    template.physicalSizeMm,
    template.bleedMm,
    exportBleedMm
  )

  return (
    <Section size="md" backgroundClassName="bg-white" textClassName="text-chaos-black" pattern="chip-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Top utility links row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a
            href={buildHashPath({ page: 'home' })}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-chaos-black/65 underline-offset-4 transition-colors hover:text-blue hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('editor.backToTemplates')}</span>
          </a>

          <a
            href={buildHashPath({ page: 'designer', templateId: template.id })}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-chaos-black/65 underline-offset-4 transition-colors hover:text-blue hover:underline"
          >
            <Wrench className="h-4 w-4" />
            <span>{t('editor.editInDesigner')}</span>
          </a>
        </div>

        {/* Title header with Fill Sample / Clear All aligned right on the title row */}
        <div className="space-y-1.5">
          <div>
            <Badge color={template.themeAccent === 'orange' ? 'yellow' : 'blue'}>
              {getLocalizedText(template.organization, locale)}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-heading text-3xl font-black text-chaos-black sm:text-4xl">
              {getLocalizedText(template.name, locale)}
            </h1>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="yellow"
                leftIcon={<Sparkles className="h-4 w-4" />}
                onClick={fillSample}
              >
                {t('editor.fillSample')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                leftIcon={<Eraser className="h-4 w-4" />}
                onClick={clearAll}
              >
                {t('editor.clearAll')}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-sm font-medium text-chaos-black/70">
              {getLocalizedText(template.description, locale)}
            </p>
            {hasTemplateDocs(entry?.docs) && (
              <button
                type="button"
                onClick={() => setDocsModalOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-chaos-black/65 underline-offset-4 transition-colors hover:text-blue hover:underline"
              >
                <Scale className="h-3.5 w-3.5" />
                <span>{t('editor.creditsAndLicense')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-side selector (e.g., Front / Back) */}
        {template.sides.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold tracking-wider text-chaos-black/65 uppercase">
              {t('editor.sideLabel')}
            </span>
            <SegmentedControl
              appearance="track"
              density="compact"
              value={activeSide.id}
              onValueChange={(next) => setActiveSideId(next)}
              aria-label={t('editor.sideLabel')}
              style={{ '--segmented-control-track-width': '5.5rem' } as React.CSSProperties}
            >
              {template.sides.map((side) => (
                <SegmentedControlItem key={side.id} value={side.id}>
                  {getLocalizedText(side.label, locale)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>
        )}

        {/* Split-screen Studio: Preview sticky on right (top on mobile), Form on left */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Preview & Export column (first on mobile, sticky right on desktop) */}
          <div className="space-y-5 lg:sticky lg:top-20 lg:order-2 lg:col-span-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold tracking-wider text-chaos-black/65 uppercase">
                  {t('editor.previewTitle')} — {getLocalizedText(activeSide.label, locale)}
                </span>
                <span className="font-mono text-xs font-semibold text-chaos-black/55">
                  {previewBleed.exportSizeMm.width} × {previewBleed.exportSizeMm.height} mm
                </span>
              </div>

              <LiveCardPreview
                template={template}
                side={activeSide}
                values={values}
                mode={exportMode}
                exportBleedMm={previewBleed.exportBleedMm}
                showTrimGuide={previewBleed.exportBleedMm > 0}
                fontFamilyOverride={selectedFont?.family}
                assetOverrides={entry?.assetOverrides}
                extraFonts={entry?.extraFonts}
                showDebugBoxes={showDebugBoxes}
              />
            </div>

            <ExportPanel
              template={template}
              activeSide={activeSide}
              values={values}
              exportMode={exportMode}
              onExportModeChange={setExportMode}
              exportBleedMm={previewBleed.exportBleedMm}
              onExportBleedMmChange={setExportBleedMm}
              selectedFont={selectedFont}
              onSelectedFontChange={setSelectedFont}
              assetOverrides={entry?.assetOverrides}
              extraFonts={entry?.extraFonts}
            />
          </div>

          {/* Dynamic Form column */}
          <div className="rounded-xl border-3 border-chaos-black bg-[#f5f0e8] p-5 shadow-[4px_4px_0px_#0d0d0d] lg:order-1 lg:col-span-6">
            <DynamicForm
              template={template}
              side={activeSide}
              values={values}
              onChange={setFieldValue}
            />
          </div>
        </div>
      </div>
      <TemplateDocsModal
        open={docsModalOpen}
        templateName={getLocalizedText(template.name, locale)}
        docs={entry?.docs}
        onClose={() => setDocsModalOpen(false)}
      />
    </Section>
  )
}
