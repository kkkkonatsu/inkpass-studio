import * as React from 'react'
import { FolderArchive, Trash2 } from 'lucide-react'
import { Badge, type BadgeColor } from 'splatoon-ui/badge'
import { BannerDivider } from 'splatoon-ui/banner-divider'
import { Button } from 'splatoon-ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'splatoon-ui/dialog'
import { DottedDivider } from 'splatoon-ui/dotted-divider'
import { HeadingTape } from 'splatoon-ui/heading-tape'
import { Loader } from 'splatoon-ui/loader'
import { Section } from 'splatoon-ui/section'
import { TapeTitle } from 'splatoon-ui/tape-title'
import { TornCard, TornCardDescription, TornCardTitle } from 'splatoon-ui/torn-card'
import { HoverTooltip } from '@/components/ui/HoverTooltip'
import { useI18n } from '@/i18n'
import { navigateTo } from '@/router'
import {
  useRuntimeTemplates,
  type ResolvedTemplateEntry,
} from '@/templates/runtime-store'
import {
  getLocalizedText,
  resolveTemplateAssetUrl,
  type DocumentTemplateConfig,
} from '@/templates/schema'

function getBadgeColor(accent: DocumentTemplateConfig['themeAccent']): BadgeColor {
  if (accent === 'orange') return 'yellow'
  if (accent === 'green') return 'green'
  if (accent === 'purple') return 'purple'
  return 'blue'
}

function getButtonVariant(
  accent: DocumentTemplateConfig['themeAccent']
): 'yellow' | 'blue' | 'orange' | 'green' | 'purple' {
  if (accent === 'orange') return 'orange'
  if (accent === 'green') return 'green'
  if (accent === 'purple') return 'purple'
  if (accent === 'yellow') return 'yellow'
  return 'blue'
}

function TemplateCard({
  entry,
  index,
  onRemove,
}: {
  entry: ResolvedTemplateEntry
  index: number
  onRemove: (id: string) => void
}) {
  const { locale, t } = useI18n()
  const template = entry.config
  const rawThumb = template.thumbnail ?? template.sides[0]?.background
  const resolvedThumb = rawThumb
    ? entry.assetOverrides?.[rawThumb] ??
      entry.assetOverrides?.[resolveTemplateAssetUrl(template.id, rawThumb)] ??
      resolveTemplateAssetUrl(template.id, rawThumb)
    : ''
  const imgRef = React.useRef<HTMLImageElement | null>(null)
  const [thumbStatus, setThumbStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading')

  React.useEffect(() => {
    if (!resolvedThumb) return
    const img = imgRef.current
    if (img && img.complete) {
      setThumbStatus(img.naturalWidth > 0 ? 'loaded' : 'error')
    } else {
      setThumbStatus('loading')
    }
  }, [resolvedThumb])

  return (
    <TornCard
      variant={index % 2 === 0 ? 'a' : 'b'}
      background="#f5f0e8"
      className="text-chaos-black"
    >
      <div className="relative flex h-full flex-col items-center justify-between gap-5 p-6 text-center">
        {entry.isImported && (
          <button
            type="button"
            aria-label={t('editor.removePhoto')}
            title={t('editor.removePhoto')}
            onClick={() => onRemove(template.id)}
            className="absolute top-3 right-3 z-30 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-chaos-black bg-white/95 text-red shadow-[2px_2px_0px_#0d0d0d] transition-colors hover:bg-red hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        <div className="w-full space-y-3">
          {resolvedThumb && (
            <div className="relative aspect-[1011/638] overflow-hidden rounded-lg border-2 border-chaos-black/15 bg-white shadow-sm">
              {thumbStatus === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#f5f0e8]/65">
                  <Loader variant="blue" size="2.25rem" />
                </div>
              )}
              <img
                ref={imgRef}
                src={resolvedThumb}
                alt={getLocalizedText(template.name, locale)}
                onLoad={() => setThumbStatus('loaded')}
                onError={() => setThumbStatus('error')}
                className={`h-full w-full object-cover transition-opacity duration-200 ${
                  thumbStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Badge color={getBadgeColor(template.themeAccent)}>
              {getLocalizedText(template.organization, locale)}
            </Badge>
          </div>

          <TornCardTitle className="text-center text-2xl text-chaos-black">
            {getLocalizedText(template.name, locale)}
          </TornCardTitle>
          <TornCardDescription className="text-center text-sm text-chaos-black/75">
            {getLocalizedText(template.description, locale)}
          </TornCardDescription>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            variant={getButtonVariant(template.themeAccent)}
            onClick={() => navigateTo({ page: 'editor', templateId: template.id })}
          >
            {t('home.openEditor')}
          </Button>
        </div>
      </div>
    </TornCard>
  )
}

function TemplateGrid({
  entries,
  onRemove,
}: {
  entries: ResolvedTemplateEntry[]
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-10">
      {entries.map((entry, index) => (
        <div key={entry.config.id} className="w-full md:w-[calc(50%-1.25rem)]">
          <TemplateCard entry={entry} index={index} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}

export function HomePage() {
  const { locale, t } = useI18n()
  const { allTemplates, importZipFile, removeImportedTemplate } = useRuntimeTemplates()
  const [importError, setImportError] = React.useState<string | null>(null)
  const [isImporting, setIsImporting] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<ResolvedTemplateEntry | null>(null)
  const zipInputRef = React.useRef<HTMLInputElement | null>(null)

  const handleRequestRemove = React.useCallback(
    (id: string) => {
      const target = allTemplates.find((entry) => entry.config.id === id)
      if (target) {
        setPendingDelete(target)
      }
    },
    [allTemplates]
  )

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    removeImportedTemplate(pendingDelete.config.id)
    setPendingDelete(null)
  }

  const uploadedTemplates = React.useMemo(
    () => allTemplates.filter((entry) => entry.isImported),
    [allTemplates]
  )
  const defaultTemplates = React.useMemo(
    () => allTemplates.filter((entry) => !entry.isImported),
    [allTemplates]
  )

  const handleImportZip = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    setIsImporting(true)
    try {
      const loaded = await importZipFile(file)
      navigateTo({ page: 'editor', templateId: loaded.config.id })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid ZIP file'
      setImportError(t('home.importZipError', { message }))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div>
      <Section
        size="md"
        backgroundClassName="bg-white"
        textClassName="text-chaos-black"
        pattern="chip-white"
        bottomOverlayClearance="banner-divider"
        style={
          {
            '--section-overlay-clearance': 'clamp(4.25rem, 5.5vw, 6.25rem)',
          } as React.CSSProperties
        }
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center">
          <Badge color="yellow">{t('app.badge')}</Badge>
          <h1
            className="font-heading text-4xl font-black tracking-wider text-chaos-black drop-shadow-[3px_3px_0px_rgba(0,0,0,0.15)] sm:text-6xl"
            style={{ transform: 'rotate(-2deg)' }}
          >
            {t('app.title')}
          </h1>
          <p className="max-w-2xl text-base font-medium text-chaos-black/75 sm:text-lg">
            {t('app.subtitle')}
          </p>

          <div className="pt-1">
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              disabled={isImporting}
              onChange={(e) => {
                handleImportZip(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <HoverTooltip text={t('common.localBrowserStorageTooltip')} align="center">
              <Button
                type="button"
                size="sm"
                variant="blue"
                disabled={isImporting}
                leftIcon={<FolderArchive className="h-4 w-4" />}
                onClick={() => zipInputRef.current?.click()}
              >
                {isImporting ? t('home.importingZip') : t('home.importZip')}
              </Button>
            </HoverTooltip>
          </div>

          {importError && (
            <div className="rounded-lg border-2 border-red bg-red/10 px-4 py-2 text-sm font-bold text-red">
              {importError}
            </div>
          )}
        </div>
      </Section>

      <BannerDivider
        tapes={[
          { variant: 'design1', rotate: -1.5, offsetY: 0, enterFrom: 'left' },
          { variant: 'yellow', rotate: 1.5, offsetY: { base: 35, medium: 45 }, enterFrom: 'right' },
        ]}
        animate
      />

      <Section
        size="md"
        backgroundClassName="bg-black"
        textClassName="text-white"
        pattern="tapes-black"
        headingTape={<HeadingTape>{t('home.sectionTitle')}</HeadingTape>}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          {uploadedTemplates.length > 0 ? (
            <div className="space-y-12">
              {/* My Templates section */}
              <div className="space-y-8">
                <div className="flex justify-center">
                  <TapeTitle color="yellow" className="text-center">
                    {t('home.uploadedSectionTitle')}
                  </TapeTitle>
                </div>
                <TemplateGrid entries={uploadedTemplates} onRemove={handleRequestRemove} />
                <p className="mx-auto max-w-xl text-center text-xs font-medium text-white/65 sm:text-sm">
                  {t('home.uploadedSectionNote')}
                </p>
              </div>

              <DottedDivider color="#eaff3d" />

              {/* Default built-in templates section */}
              <div className="space-y-8">
                <div className="flex justify-center">
                  <TapeTitle color="red" className="text-center">
                    {t('home.defaultSectionTitle')}
                  </TapeTitle>
                </div>
                <TemplateGrid entries={defaultTemplates} onRemove={handleRequestRemove} />
              </div>
            </div>
          ) : (
            <TemplateGrid entries={defaultTemplates} onRemove={handleRequestRemove} />
          )}
        </div>
      </Section>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDelete(null)
        }}
      >
        <DialogContent className="max-w-md text-center !animate-none ![transform:translate(-50%,-50%)]">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-center">{t('home.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription className="text-center">
              {pendingDelete &&
                t('home.deleteConfirmDescription', {
                  name: getLocalizedText(pendingDelete.config.name, locale),
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2.5 pt-4">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              hasChevron={false}
              className="w-full"
              onClick={handleConfirmDelete}
            >
              {t('home.deleteConfirmAction')}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              hasChevron={false}
              className="w-full"
              onClick={() => setPendingDelete(null)}
            >
              {t('home.deleteConfirmCancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
