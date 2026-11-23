import * as React from 'react'
import {
  AlertTriangle,
  BookmarkCheck,
  Check,
  ChevronDown,
  Copy,
  Download,
  FilePlus2,
  FolderArchive,
  FolderOpen,
  Keyboard,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { Badge } from 'splatoon-ui/badge'
import { Button, type ButtonVariant } from 'splatoon-ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'splatoon-ui/dialog'
import { Section } from 'splatoon-ui/section'
import { SegmentedControl, SegmentedControlItem } from 'splatoon-ui/segmented-control'
import { DesignerCanvas } from '@/components/designer/DesignerCanvas'
import { DesignerShortcutsModal } from '@/components/designer/DesignerShortcutsModal'
import { FieldInspector } from '@/components/designer/FieldInspector'
import { TemplateMetaPanel } from '@/components/designer/TemplateMetaPanel'
import { useDesignerTabLock } from '@/components/designer/use-designer-tab-lock'
import { HoverTooltip } from '@/components/ui/HoverTooltip'
import {
  buildStandardImagePath,
  createBlankTemplate,
  createDefaultField,
  deduplicateTemplateFieldIds,
  duplicateTemplateField,
  formatRelativeTimeAgo,
  resolveUniqueFieldId,
  scaleTemplateFieldsToCanvas,
  serializeTemplateConfig,
} from '@/components/designer/designer-helpers'
import { renderSideToCanvas } from '@/engine/canvas-renderer'
import { canvasToPngBlob, downloadBlob } from '@/engine/exporter'
import { registerUploadedFont } from '@/engine/font-loader'
import {
  hydrateStoredTemplate,
  loadDesignerDraft,
  saveDesignerDraft,
} from '@/engine/template-storage'
import {
  exportTemplateZip,
  importTemplateZip,
  type LoadedTemplatePackage,
  type UploadedLocalFont,
} from '@/engine/template-zip'
import { useI18n } from '@/i18n'
import { navigateTo } from '@/router'
import { TEMPLATES, getBuiltInTemplateDocs } from '@/templates/registry'
import { useRuntimeTemplates } from '@/templates/runtime-store'
import type { TemplateDocs } from '@/templates/template-docs'
import {
  collectTemplateValues,
  getLocalizedText,
  resolveTemplateAssetUrl,
  validateTemplateConfig,
  type DocumentTemplateConfig,
  type FieldType,
  type TemplateField,
  type TemplateSide,
} from '@/templates/schema'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function fontIdFromFileName(fileName: string): { id: string; label: string } {
  const base = fileName.replace(/\.[^.]+$/, '')
  const id =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-font'
  const label = base.replace(/[-_]+/g, ' ').trim() || fileName
  return { id, label }
}

/**
 * Snapshots a built-in preset's referenced artwork into in-memory Blobs + Object URLs
 * so presets load through the exact same self-contained LoadedTemplatePackage pipeline
 * as .zip and browser-saved templates (even if Template ID is renamed later).
 * Built-in site fonts stay lightweight ID references rather than duplicating font binaries.
 */
async function hydratePresetPackage(
  preset: DocumentTemplateConfig
): Promise<LoadedTemplatePackage> {
  const paths = new Set<string>()
  if (preset.thumbnail) paths.add(preset.thumbnail)
  for (const side of preset.sides) {
    if (side.background) paths.add(side.background)
    if (side.overlay) paths.add(side.overlay)
  }

  const images: Record<string, Blob> = {}
  const assetOverrides: Record<string, string> = {}
  const createdUrls: string[] = []

  await Promise.all(
    Array.from(paths).map(async (rawPath) => {
      if (
        rawPath.startsWith('data:') ||
        rawPath.startsWith('blob:') ||
        rawPath.startsWith('http://') ||
        rawPath.startsWith('https://')
      ) {
        return
      }

      const resolvedUrl = resolveTemplateAssetUrl(preset.id, rawPath)
      try {
        const response = await fetch(resolvedUrl)
        if (!response.ok) return
        const blob = await response.blob()
        images[rawPath] = blob

        const objectUrl = URL.createObjectURL(blob)
        createdUrls.push(objectUrl)
        assetOverrides[rawPath] = objectUrl
        assetOverrides[resolvedUrl] = objectUrl
        if (rawPath.startsWith('./')) {
          assetOverrides[rawPath.slice(2)] = objectUrl
        }
      } catch {
        // Ignore unreachable assets; user can upload replacements.
      }
    })
  )

  const docs = getBuiltInTemplateDocs(preset.id)

  return {
    config: deepClone(preset),
    assetOverrides,
    extraFonts: [],
    ...(docs ? { docs } : {}),
    sourceFiles: {
      images,
      fonts: [],
    },
    revokeUrls: () => {
      for (const url of createdUrls) {
        URL.revokeObjectURL(url)
      }
    },
  }
}

interface ToolbarDropdownProps {
  label: string
  variant: ButtonVariant
  icon: React.ReactNode
  open: boolean
  onOpenChange: (next: boolean) => void
  children: React.ReactNode
}

function ToolbarDropdown({
  label,
  variant,
  icon,
  open,
  onOpenChange,
  children,
}: ToolbarDropdownProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onOpenChange])

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        size="sm"
        variant={variant}
        hasChevron={false}
        leftIcon={icon}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
      >
        <span className="inline-flex items-center gap-1.5">
          <span>{label}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 min-w-56 overflow-hidden rounded-lg border-3 border-chaos-black bg-white p-1.5 shadow-[4px_4px_0px_#0d0d0d]"
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface DesignerPageProps {
  initialTemplateId?: string
}

type PendingLoadAction =
  | { kind: 'stored'; pkg: LoadedTemplatePackage }
  | { kind: 'preset'; preset: DocumentTemplateConfig }
  | { kind: 'blank' }
  | { kind: 'import'; file: File }

interface PendingCanvasResize {
  oldSize: { width: number; height: number }
  newSize: { width: number; height: number }
}

interface HistorySnapshot {
  config: DocumentTemplateConfig
  docs: TemplateDocs
}

const MAX_HISTORY_STEPS = 50
const HISTORY_COALESCE_MS = 450

function DraftSavedBadge({ savedAt }: { savedAt: number | null }) {
  const { locale, t } = useI18n()
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (savedAt === null) return
    setNow(Date.now())

    let timerId: number | null = null
    const scheduleTick = () => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
      const delay = elapsedSec < 60 ? 1000 : elapsedSec < 3600 ? 15000 : 60000
      timerId = window.setTimeout(() => {
        setNow(Date.now())
        scheduleTick()
      }, delay)
    }

    scheduleTick()
    return () => {
      if (timerId !== null) window.clearTimeout(timerId)
    }
  }, [savedAt])

  if (savedAt === null) {
    return (
      <span className="rounded-md bg-chaos-black/8 px-2.5 py-1 text-xs font-bold text-chaos-black/65">
        {t('designer.draftSaved')}
      </span>
    )
  }

  const relative = formatRelativeTimeAgo(savedAt, now, locale)
  const label = relative
    ? t('designer.draftSavedAgo', { time: relative })
    : t('designer.draftSavedJustNow')

  return (
    <span
      title={new Date(savedAt).toLocaleString(locale)}
      className="rounded-md bg-chaos-black/8 px-2.5 py-1 text-xs font-bold text-chaos-black/65"
    >
      {label}
    </span>
  )
}

export function DesignerPage({ initialTemplateId }: DesignerPageProps = {}) {
  const { locale, t } = useI18n()
  const { importedPackages, isHydrating, saveTemplateToBrowser } = useRuntimeTemplates()

  const [config, setConfig] = React.useState<DocumentTemplateConfig>(() => {
    if (initialTemplateId) {
      const stored = importedPackages.find((pkg) => pkg.config.id === initialTemplateId)
      if (stored) return deepClone(stored.config)
      const preset = TEMPLATES.find((tpl) => tpl.id === initialTemplateId)
      if (preset) return deepClone(preset)
    }
    return deepClone(TEMPLATES[0] ?? createBlankTemplate())
  })
  const [activeSideId, setActiveSideId] = React.useState<string>(
    () => config.sides[0]?.id ?? 'front'
  )
  const [selectedFieldId, setSelectedFieldId] = React.useState<string | null>(
    () => config.sides[0]?.fields[0]?.id ?? null
  )
  const [inspectorTab, setInspectorTab] = React.useState<'fields' | 'template'>('fields')
  const [showBoxes, setShowBoxes] = React.useState(true)
  const [assetOverrides, setAssetOverrides] = React.useState<Record<string, string>>({})
  const [localImages, setLocalImages] = React.useState<Record<string, Blob>>({})
  const [localFonts, setLocalFonts] = React.useState<UploadedLocalFont[]>([])
  const [docs, setDocs] = React.useState<TemplateDocs>(() => {
    if (initialTemplateId) {
      const stored = importedPackages.find((pkg) => pkg.config.id === initialTemplateId)
      if (stored) return { ...(stored.docs ?? {}) }
      return { ...(getBuiltInTemplateDocs(initialTemplateId) ?? {}) }
    }
    return { ...(getBuiltInTemplateDocs(TEMPLATES[0]?.id ?? '') ?? {}) }
  })
  const [isDirty, setIsDirty] = React.useState(false)
  const [draftSaved, setDraftSaved] = React.useState(false)
  const [draftSavedAt, setDraftSavedAt] = React.useState<number | null>(null)
  const [saveFeedback, setSaveFeedback] = React.useState<'copied' | 'saved' | null>(null)
  const [isExportingZip, setIsExportingZip] = React.useState(false)
  const [isSavingBrowser, setIsSavingBrowser] = React.useState(false)
  const [isGeneratingThumb, setIsGeneratingThumb] = React.useState(false)
  const [importError, setImportError] = React.useState<string | null>(null)
  const [openMenu, setOpenMenu] = React.useState<'load' | 'export' | null>(null)
  const [pendingLoad, setPendingLoad] = React.useState<PendingLoadAction | null>(null)
  const [pendingResize, setPendingResize] = React.useState<PendingCanvasResize | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  const { isBlockedByOtherTab, takeOverTab } = useDesignerTabLock()
  const isBlockedByOtherTabRef = React.useRef(isBlockedByOtherTab)
  isBlockedByOtherTabRef.current = isBlockedByOtherTab
  const clipboardFieldRef = React.useRef<TemplateField | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const hydratedCleanupRef = React.useRef<(() => void) | null>(null)
  const loadedInitialIdRef = React.useRef<string | null>(null)
  const loadedPlainDesignerRef = React.useRef(false)
  const loadSeqRef = React.useRef(0)
  const latestStateRef = React.useRef<HistorySnapshot>({ config, docs })
  latestStateRef.current = { config, docs }

  const historyRef = React.useRef<{
    past: HistorySnapshot[]
    future: HistorySnapshot[]
    lastPushAt: number
    lastCoalesceKey: string | null
  }>({
    past: [],
    future: [],
    lastPushAt: 0,
    lastCoalesceKey: null,
  })

  const clearHistory = React.useCallback(() => {
    historyRef.current = {
      past: [],
      future: [],
      lastPushAt: 0,
      lastCoalesceKey: null,
    }
  }, [])

  const pushHistory = React.useCallback((coalesceKey: string | null = null) => {
    const now = Date.now()
    const history = historyRef.current
    if (
      coalesceKey &&
      history.lastCoalesceKey === coalesceKey &&
      now - history.lastPushAt < HISTORY_COALESCE_MS
    ) {
      history.lastPushAt = now
      return
    }

    const current = latestStateRef.current
    history.past.push({
      config: deepClone(current.config),
      docs: { ...current.docs },
    })
    if (history.past.length > MAX_HISTORY_STEPS) {
      history.past.shift()
    }
    history.future = []
    history.lastPushAt = now
    history.lastCoalesceKey = coalesceKey
  }, [])

  const applyHistorySnapshot = React.useCallback((snapshot: HistorySnapshot) => {
    const nextConfig = deepClone(snapshot.config)
    setConfig(nextConfig)
    setDocs({ ...snapshot.docs })
    setActiveSideId((prevSideId) =>
      nextConfig.sides.some((s) => s.id === prevSideId)
        ? prevSideId
        : (nextConfig.sides[0]?.id ?? 'front')
    )
    setSelectedFieldId((prevFieldId) => {
      if (!prevFieldId) return null
      const exists = nextConfig.sides.some((s) => s.fields.some((f) => f.id === prevFieldId))
      return exists ? prevFieldId : null
    })
    setIsDirty(true)
  }, [])

  const handleUndo = React.useCallback(() => {
    const history = historyRef.current
    const previous = history.past.pop()
    if (!previous) return
    const current = latestStateRef.current
    history.future.push({
      config: deepClone(current.config),
      docs: { ...current.docs },
    })
    history.lastCoalesceKey = null
    applyHistorySnapshot(previous)
  }, [applyHistorySnapshot])

  const handleRedo = React.useCallback(() => {
    const history = historyRef.current
    const next = history.future.pop()
    if (!next) return
    const current = latestStateRef.current
    history.past.push({
      config: deepClone(current.config),
      docs: { ...current.docs },
    })
    history.lastCoalesceKey = null
    applyHistorySnapshot(next)
  }, [applyHistorySnapshot])

  const applyPackageToDesigner = React.useCallback(
    (
      pkg: LoadedTemplatePackage,
      options: {
        ownUrls: boolean
        isDraft?: boolean
        savedAt?: number
        persistDraft?: 'clean' | 'dirty' | false
      }
    ) => {
      clearHistory()
      hydratedCleanupRef.current?.()
      hydratedCleanupRef.current = options.ownUrls ? pkg.revokeUrls : null

      const cloned = deduplicateTemplateFieldIds(deepClone(pkg.config))
      setConfig(cloned)
      setActiveSideId(cloned.sides[0]?.id ?? 'front')
      setSelectedFieldId(cloned.sides[0]?.fields[0]?.id ?? null)
      setAssetOverrides({ ...pkg.assetOverrides })
      setLocalImages({ ...pkg.sourceFiles.images })
      setLocalFonts([...pkg.sourceFiles.fonts])
      setDocs({ ...(pkg.docs ?? {}) })
      setImportError(null)
      setIsDirty(false)

      if (options.persistDraft && !isBlockedByOtherTabRef.current) {
        const hasUnsavedChanges = options.persistDraft === 'dirty'
        const savedAt = Date.now()
        setDraftSaved(false)
        setDraftSavedAt(null)
        const seq = loadSeqRef.current
        void saveDesignerDraft({
          savedAt,
          config: cloned,
          images: { ...pkg.sourceFiles.images },
          fonts: [...pkg.sourceFiles.fonts],
          docs: pkg.docs ? { ...pkg.docs } : {},
          hasUnsavedChanges,
        }).then(() => {
          if (hasUnsavedChanges && seq === loadSeqRef.current && !isBlockedByOtherTabRef.current) {
            setDraftSaved(true)
            setDraftSavedAt(savedAt)
          }
        })
      } else {
        const isDraft = Boolean(options.isDraft)
        setDraftSaved(isDraft)
        setDraftSavedAt(isDraft ? (options.savedAt ?? Date.now()) : null)
      }
    },
    [clearHistory]
  )

  const loadBlankOrRawConfig = React.useCallback(
    (
      next: DocumentTemplateConfig,
      options: { persistDraft?: 'clean' | 'dirty' | false } = {}
    ) => {
      clearHistory()
      const seq = ++loadSeqRef.current
      hydratedCleanupRef.current?.()
      hydratedCleanupRef.current = null

      const cloned = deduplicateTemplateFieldIds(deepClone(next))
      setConfig(cloned)
      setActiveSideId(cloned.sides[0]?.id ?? 'front')
      setSelectedFieldId(cloned.sides[0]?.fields[0]?.id ?? null)
      setAssetOverrides({})
      setLocalImages({})
      setLocalFonts([])
      setDocs({})
      setImportError(null)
      setIsDirty(false)

      const persistMode = options.persistDraft ?? 'clean'
      if (persistMode && !isBlockedByOtherTabRef.current) {
        const hasUnsavedChanges = persistMode === 'dirty'
        const savedAt = Date.now()
        setDraftSaved(false)
        setDraftSavedAt(null)
        void saveDesignerDraft({
          savedAt,
          config: cloned,
          images: {},
          fonts: [],
          docs: {},
          hasUnsavedChanges,
        }).then(() => {
          if (hasUnsavedChanges && seq === loadSeqRef.current && !isBlockedByOtherTabRef.current) {
            setDraftSaved(true)
            setDraftSavedAt(savedAt)
          }
        })
      } else {
        setDraftSaved(false)
        setDraftSavedAt(null)
      }
    },
    [clearHistory]
  )

  const loadPresetIntoDesigner = React.useCallback(
    async (preset: DocumentTemplateConfig) => {
      const seq = ++loadSeqRef.current
      const pkg = await hydratePresetPackage(preset)
      if (seq !== loadSeqRef.current) {
        pkg.revokeUrls()
        return
      }
      applyPackageToDesigner(pkg, { ownUrls: true, persistDraft: 'clean' })
    },
    [applyPackageToDesigner]
  )

  React.useEffect(() => {
    return () => {
      loadSeqRef.current += 1
      hydratedCleanupRef.current?.()
    }
  }, [])

  // Restore draft (or hydrate the default preset) on plain #/designer mount,
  // or load the requested template when opened via #/designer/:templateId
  React.useEffect(() => {
    let active = true

    if (!initialTemplateId) {
      loadedInitialIdRef.current = null
      // Only restore the initial draft once for plain #/designer — never re-run when
      // `importedPackages` or `isHydrating` updates (e.g. during Save to Browser).
      if (loadedPlainDesignerRef.current) {
        return () => {
          active = false
        }
      }
      const seq = ++loadSeqRef.current

      loadDesignerDraft().then(async (draft) => {
        if (!active || seq !== loadSeqRef.current) return
        loadedPlainDesignerRef.current = true

        if (draft) {
          const hydrated = await hydrateStoredTemplate(draft)
          if (!active || seq !== loadSeqRef.current) {
            hydrated.revokeUrls()
            loadedPlainDesignerRef.current = false
            return
          }
          applyPackageToDesigner(hydrated, {
            ownUrls: true,
            isDraft: draft.hasUnsavedChanges !== false,
            savedAt: draft.savedAt,
          })
          return
        }

        const defaultPreset = TEMPLATES[0]
        if (defaultPreset) {
          const pkg = await hydratePresetPackage(defaultPreset)
          if (!active || seq !== loadSeqRef.current) {
            pkg.revokeUrls()
            loadedPlainDesignerRef.current = false
            return
          }
          applyPackageToDesigner(pkg, { ownUrls: true, persistDraft: 'clean' })
        }
      })
      return () => {
        active = false
      }
    }

    loadedPlainDesignerRef.current = false
    if (isHydrating || loadedInitialIdRef.current === initialTemplateId) {
      return () => {
        active = false
      }
    }

    const seq = ++loadSeqRef.current

    loadDesignerDraft().then(async (draft) => {
      if (!active || seq !== loadSeqRef.current) return

      // Mark as loaded only after the async call resolves while still active (StrictMode-safe)
      loadedInitialIdRef.current = initialTemplateId

      const storedPkg = importedPackages.find((pkg) => pkg.config.id === initialTemplateId)
      const preset = storedPkg ? undefined : TEMPLATES.find((tpl) => tpl.id === initialTemplateId)

      // If an UNSAVED draft exists (even for the same template ID, since it was edited),
      // restore the draft and ask whether to save or overwrite it before loading the fresh template.
      if (draft && draft.hasUnsavedChanges !== false && (storedPkg || preset)) {
        const hydrated = await hydrateStoredTemplate(draft)
        if (!active || seq !== loadSeqRef.current) {
          hydrated.revokeUrls()
          loadedInitialIdRef.current = null
          return
        }
        applyPackageToDesigner(hydrated, { ownUrls: true, isDraft: true, savedAt: draft.savedAt })
        setPendingLoad(
          storedPkg ? { kind: 'stored', pkg: storedPkg } : { kind: 'preset', preset: preset! }
        )
        window.history.replaceState(null, '', '#/designer')
        return
      }

      if (storedPkg) {
        applyPackageToDesigner(storedPkg, { ownUrls: false, persistDraft: 'clean' })
        window.history.replaceState(null, '', '#/designer')
        return
      }

      if (preset) {
        const pkg = await hydratePresetPackage(preset)
        if (!active || seq !== loadSeqRef.current) {
          pkg.revokeUrls()
          loadedInitialIdRef.current = null
          return
        }
        applyPackageToDesigner(pkg, { ownUrls: true, persistDraft: 'clean' })
        window.history.replaceState(null, '', '#/designer')
        return
      }

      // Fallback if initialTemplateId doesn't match any known template but a draft exists
      if (draft) {
        const hydrated = await hydrateStoredTemplate(draft)
        if (!active || seq !== loadSeqRef.current) {
          hydrated.revokeUrls()
          loadedInitialIdRef.current = null
          return
        }
        applyPackageToDesigner(hydrated, {
          ownUrls: true,
          isDraft: draft.hasUnsavedChanges !== false,
          savedAt: draft.savedAt,
        })
      }
    })

    return () => {
      active = false
    }
  }, [initialTemplateId, isHydrating, importedPackages, applyPackageToDesigner])

  // Auto-save working draft to IndexedDB ONLY after the user makes a change
  // (paused while another Designer tab owns the active lock so drafts never overwrite each other)
  React.useEffect(() => {
    if (!isDirty || isBlockedByOtherTab) return

    const timerId = window.setTimeout(() => {
      if (isBlockedByOtherTabRef.current) return
      const savedAt = Date.now()
      saveDesignerDraft({
        savedAt,
        config,
        images: localImages,
        fonts: localFonts,
        docs,
        hasUnsavedChanges: true,
      }).then(() => {
        if (!isBlockedByOtherTabRef.current) {
          setDraftSaved(true)
          setDraftSavedAt(savedAt)
        }
      })
    }, 500)

    return () => window.clearTimeout(timerId)
  }, [isDirty, isBlockedByOtherTab, config, localImages, localFonts, docs])

  const activeSide = config.sides.find((s) => s.id === activeSideId) ?? config.sides[0]
  const validation = React.useMemo(() => validateTemplateConfig(config), [config])
  const extraFonts = React.useMemo(() => localFonts.map((item) => item.font), [localFonts])

  const loadStoredPackageIntoDesigner = (pkg: LoadedTemplatePackage) => {
    loadSeqRef.current += 1
    applyPackageToDesigner(pkg, { ownUrls: false, persistDraft: 'clean' })
  }

  const updateDocs = (patch: Partial<TemplateDocs>) => {
    pushHistory('docs')
    setDocs((prev) => ({ ...prev, ...patch }))
    setIsDirty(true)
  }

  const updateTemplate = (patch: Partial<DocumentTemplateConfig>) => {
    pushHistory('template')
    setConfig((prev) => ({ ...prev, ...patch }))
    setIsDirty(true)
  }

  const updateSide = (sideId: string, patch: Partial<TemplateSide>) => {
    pushHistory(`side:${sideId}`)
    setConfig((prev) => ({
      ...prev,
      sides: prev.sides.map((s) => (s.id === sideId ? { ...s, ...patch } : s)),
    }))
    setIsDirty(true)
  }

  const updateField = React.useCallback(
    (fieldId: string, patch: Partial<TemplateField>) => {
      pushHistory(`field:${activeSide.id}:${fieldId}`)
      setConfig((prev) => ({
        ...prev,
        sides: prev.sides.map((side) =>
          side.id !== activeSide.id
            ? side
            : {
                ...side,
                fields: side.fields.map((field) =>
                  field.id === fieldId ? ({ ...field, ...patch } as TemplateField) : field
                ),
              }
        ),
      }))
      setIsDirty(true)
    },
    [activeSide.id, pushHistory]
  )

  const renameField = React.useCallback(
    (oldId: string, desiredId: string): string => {
      const otherIds = new Set<string>()
      let skippedTarget = false
      for (const side of config.sides) {
        for (const field of side.fields) {
          if (!skippedTarget && side.id === activeSide.id && field.id === oldId) {
            skippedTarget = true
            continue
          }
          otherIds.add(field.id)
        }
      }

      const nextId = resolveUniqueFieldId(desiredId, otherIds)
      if (nextId === oldId) return oldId

      pushHistory()
      setConfig((prev) => {
        let renamed = false
        return {
          ...prev,
          sides: prev.sides.map((side) => ({
            ...side,
            fields: side.fields.map((field) => {
              if (!renamed && side.id === activeSide.id && field.id === oldId) {
                renamed = true
                return { ...field, id: nextId }
              }
              if (field.type === 'barcode' && field.sourceFieldId === oldId) {
                return { ...field, sourceFieldId: nextId }
              }
              return field
            }),
          })),
        }
      })
      setSelectedFieldId(nextId)
      setIsDirty(true)
      return nextId
    },
    [activeSide.id, config.sides, pushHistory]
  )

  const addField = (type: FieldType) => {
    pushHistory()
    const allFields = config.sides.flatMap((s) => s.fields)
    const nextField = createDefaultField(type, allFields, config.canvasSize)
    setConfig((prev) => ({
      ...prev,
      sides: prev.sides.map((side) =>
        side.id === activeSide.id ? { ...side, fields: [...side.fields, nextField] } : side
      ),
    }))
    setSelectedFieldId(nextField.id)
    setInspectorTab('fields')
    setIsDirty(true)
  }

  const duplicateField = React.useCallback(
    (fieldId: string) => {
      const source = activeSide.fields.find((f) => f.id === fieldId)
      if (!source) return
      pushHistory()
      const allFields = config.sides.flatMap((s) => s.fields)
      const duplicated = duplicateTemplateField(source, allFields, config.canvasSize)
      setConfig((prev) => ({
        ...prev,
        sides: prev.sides.map((side) => {
          if (side.id !== activeSide.id) return side
          const idx = side.fields.findIndex((f) => f.id === fieldId)
          const nextFields = [...side.fields]
          nextFields.splice(idx >= 0 ? idx + 1 : nextFields.length, 0, duplicated)
          return { ...side, fields: nextFields }
        }),
      }))
      setSelectedFieldId(duplicated.id)
      setInspectorTab('fields')
      setIsDirty(true)
    },
    [activeSide.fields, activeSide.id, config.canvasSize, config.sides, pushHistory]
  )

  const duplicateFieldAtOrigin = React.useCallback(
    (fieldId: string): TemplateField | null => {
      const source = activeSide.fields.find((f) => f.id === fieldId)
      if (!source) return null
      const allFields = config.sides.flatMap((s) => s.fields)
      const duplicated = duplicateTemplateField(source, allFields, config.canvasSize, {
        x: 0,
        y: 0,
      })
      pushHistory(`field:${activeSide.id}:${duplicated.id}`)
      setConfig((prev) => ({
        ...prev,
        sides: prev.sides.map((side) => {
          if (side.id !== activeSide.id) return side
          const idx = side.fields.findIndex((f) => f.id === fieldId)
          const nextFields = [...side.fields]
          nextFields.splice(idx >= 0 ? idx + 1 : nextFields.length, 0, duplicated)
          return { ...side, fields: nextFields }
        }),
      }))
      setSelectedFieldId(duplicated.id)
      setInspectorTab('fields')
      setIsDirty(true)
      return duplicated
    },
    [activeSide.fields, activeSide.id, config.canvasSize, config.sides, pushHistory]
  )

  const pasteField = React.useCallback(() => {
    const copied = clipboardFieldRef.current
    if (!copied) return
    pushHistory()
    const allFields = config.sides.flatMap((s) => s.fields)
    const pasted = duplicateTemplateField(copied, allFields, config.canvasSize, { x: 16, y: 16 })
    setConfig((prev) => ({
      ...prev,
      sides: prev.sides.map((side) =>
        side.id === activeSide.id ? { ...side, fields: [...side.fields, pasted] } : side
      ),
    }))
    setSelectedFieldId(pasted.id)
    setInspectorTab('fields')
    setIsDirty(true)
  }, [activeSide.id, config.canvasSize, config.sides, pushHistory])

  const deleteField = React.useCallback(
    (fieldId: string) => {
      pushHistory()
      setConfig((prev) => ({
        ...prev,
        sides: prev.sides.map((side) =>
          side.id === activeSide.id
            ? { ...side, fields: side.fields.filter((f) => f.id !== fieldId) }
            : side
        ),
      }))
      setSelectedFieldId((prev) => (prev === fieldId ? null : prev))
      setIsDirty(true)
    },
    [activeSide.id, pushHistory]
  )

  const moveFieldOrder = React.useCallback(
    (fieldId: string, direction: -1 | 1) => {
      pushHistory()
      setConfig((prev) => ({
        ...prev,
        sides: prev.sides.map((side) => {
          if (side.id !== activeSide.id) return side
          const idx = side.fields.findIndex((f) => f.id === fieldId)
          const targetIdx = idx + direction
          if (idx < 0 || targetIdx < 0 || targetIdx >= side.fields.length) return side
          const copy = [...side.fields]
          const [item] = copy.splice(idx, 1)
          copy.splice(targetIdx, 0, item)
          return { ...side, fields: copy }
        }),
      }))
      setIsDirty(true)
    },
    [activeSide.id, pushHistory]
  )

  const nudgeFontSize = React.useCallback(
    (fieldId: string, delta: number) => {
      const field = activeSide.fields.find((f) => f.id === fieldId)
      if (!field || !('fontSize' in field) || typeof field.fontSize !== 'number') return
      const nextSize = Math.max(8, Math.round(field.fontSize + delta))
      if (nextSize === field.fontSize) return
      updateField(field.id, { fontSize: nextSize })
    },
    [activeSide.fields, updateField]
  )

  // Global keyboard shortcuts (Undo/Redo, Copy/Paste/Duplicate, Delete, Preview W, Layer [/], Font size)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pendingLoad !== null || pendingResize !== null || shortcutsOpen) return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }

      const hasMod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (hasMod && !e.altKey) {
        if (key === 'z' && !e.shiftKey) {
          if (historyRef.current.past.length > 0) {
            e.preventDefault()
            handleUndo()
          }
          return
        }
        if ((key === 'z' && e.shiftKey) || (e.ctrlKey && !e.metaKey && key === 'y')) {
          if (historyRef.current.future.length > 0) {
            e.preventDefault()
            handleRedo()
          }
          return
        }
        if (key === 'c' && !e.shiftKey && selectedFieldId) {
          const selection = window.getSelection()?.toString()
          if (selection) return
          const field = activeSide.fields.find((f) => f.id === selectedFieldId)
          if (field) {
            e.preventDefault()
            clipboardFieldRef.current = deepClone(field)
          }
          return
        }
        if (key === 'v' && !e.shiftKey && clipboardFieldRef.current) {
          e.preventDefault()
          pasteField()
          return
        }
        if (key === 'd' && !e.shiftKey && selectedFieldId) {
          e.preventDefault()
          duplicateField(selectedFieldId)
          return
        }
        if (e.shiftKey && selectedFieldId) {
          if (e.key === '>' || e.key === '.') {
            e.preventDefault()
            nudgeFontSize(selectedFieldId, 1)
            return
          }
          if (e.key === '<' || e.key === ',') {
            e.preventDefault()
            nudgeFontSize(selectedFieldId, -1)
            return
          }
        }
        return
      }

      if (hasMod || e.altKey) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldId) {
        e.preventDefault()
        deleteField(selectedFieldId)
        return
      }
      if (e.key === 'Escape' && selectedFieldId) {
        e.preventDefault()
        setSelectedFieldId(null)
        return
      }
      if (key === 'w' && !e.shiftKey) {
        e.preventDefault()
        setShowBoxes((prev) => !prev)
        return
      }
      if (e.key === '[' && selectedFieldId) {
        e.preventDefault()
        moveFieldOrder(selectedFieldId, -1)
        return
      }
      if (e.key === ']' && selectedFieldId) {
        e.preventDefault()
        moveFieldOrder(selectedFieldId, 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeSide.fields,
    deleteField,
    duplicateField,
    handleRedo,
    handleUndo,
    moveFieldOrder,
    nudgeFontSize,
    pasteField,
    pendingLoad,
    pendingResize,
    selectedFieldId,
    shortcutsOpen,
  ])

  const addSide = () => {
    pushHistory()
    const nextIndex = config.sides.length + 1
    const nextId =
      nextIndex === 2 && !config.sides.some((s) => s.id === 'back')
        ? 'back'
        : `side-${nextIndex}`
    const newSide: TemplateSide = {
      id: nextId,
      label: {
        en: `Side ${nextIndex}`,
        ja: `面 ${nextIndex}`,
        'zh-Hans': `第 ${nextIndex} 面`,
        'zh-Hant': `第 ${nextIndex} 面`,
      },
      backgroundColor: '#f5f0e8',
      fields: [],
    }
    setConfig((prev) => ({ ...prev, sides: [...prev.sides, newSide] }))
    setActiveSideId(nextId)
    setSelectedFieldId(null)
    setIsDirty(true)
  }

  const removeSide = (sideId: string) => {
    if (config.sides.length <= 1) return
    pushHistory()
    const remaining = config.sides.filter((s) => s.id !== sideId)
    setConfig((prev) => ({ ...prev, sides: remaining }))
    setActiveSideId(remaining[0].id)
    setSelectedFieldId(remaining[0].fields[0]?.id ?? null)
    setIsDirty(true)
  }

  const isImagePathReferencedElsewhere = (
    pathToCheck: string | undefined,
    excluding: { sideId?: string; kind: 'background' | 'overlay' | 'thumbnail' }
  ): boolean => {
    if (!pathToCheck) return false
    if (excluding.kind !== 'thumbnail' && config.thumbnail === pathToCheck) return true
    for (const side of config.sides) {
      if (
        !(excluding.kind === 'background' && excluding.sideId === side.id) &&
        side.background === pathToCheck
      ) {
        return true
      }
      if (
        !(excluding.kind === 'overlay' && excluding.sideId === side.id) &&
        side.overlay === pathToCheck
      ) {
        return true
      }
    }
    return false
  }

  const handleUploadLocalImage = (kind: 'background' | 'overlay' | 'thumbnail', file: File) => {
    const blobUrl = URL.createObjectURL(file)
    const nextPath = buildStandardImagePath(kind, activeSide.id, file.name, file.type)
    const oldPath =
      kind === 'background'
        ? activeSide.background
        : kind === 'overlay'
          ? activeSide.overlay
          : config.thumbnail
    let thumbAlsoUpdated = false

    if (kind === 'background') {
      const currentSize = { ...config.canvasSize }
      const hasExistingFields = config.sides.some((side) => side.fields.length > 0)
      const oldBackground = activeSide.background

      const img = new Image()
      img.onload = () => {
        if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return
        const nextSize = { width: img.naturalWidth, height: img.naturalHeight }
        const sizeChanged =
          nextSize.width !== currentSize.width || nextSize.height !== currentSize.height
        if (!sizeChanged) return

        if (hasExistingFields) {
          setPendingResize({ oldSize: currentSize, newSize: nextSize })
        } else {
          updateTemplate({ canvasSize: nextSize })
        }
      }
      img.src = blobUrl

      updateSide(activeSide.id, { background: nextPath })
      // Only auto-sync thumbnail if it wasn't customized to a separate image
      if (
        activeSide.id === config.sides[0]?.id &&
        (!config.thumbnail || config.thumbnail === oldBackground)
      ) {
        updateTemplate({ thumbnail: nextPath })
        thumbAlsoUpdated = true
      }
    } else if (kind === 'overlay') {
      updateSide(activeSide.id, { overlay: nextPath })
    } else {
      updateTemplate({ thumbnail: nextPath })
    }

    const shouldPruneOld =
      oldPath &&
      oldPath !== nextPath &&
      !(
        !thumbAlsoUpdated &&
        isImagePathReferencedElsewhere(oldPath, { sideId: activeSide.id, kind })
      )

    setAssetOverrides((prev) => ({
      ...prev,
      [nextPath]: blobUrl,
      [resolveTemplateAssetUrl(config.id, nextPath)]: blobUrl,
    }))
    setLocalImages((prev) => {
      const next = { ...prev, [nextPath]: file }
      if (shouldPruneOld && oldPath) {
        delete next[oldPath]
      }
      return next
    })
    setIsDirty(true)
  }

  const handleApplyCanvasResize = (mode: 'scale-fields' | 'resize-only' | 'keep-canvas') => {
    if (!pendingResize) return
    const { oldSize, newSize } = pendingResize
    setPendingResize(null)

    if (mode === 'keep-canvas') return

    if (mode === 'scale-fields') {
      pushHistory()
      setConfig((prev) => ({
        ...prev,
        canvasSize: newSize,
        sides: scaleTemplateFieldsToCanvas(prev.sides, oldSize, newSize),
      }))
      setIsDirty(true)
      return
    }

    updateTemplate({ canvasSize: newSize })
  }

  const handleRemoveSideImage = (kind: 'background' | 'overlay' | 'thumbnail') => {
    const oldPath =
      kind === 'thumbnail'
        ? config.thumbnail
        : kind === 'background'
          ? activeSide.background
          : activeSide.overlay
    let thumbAlsoRemoved = false

    if (kind === 'thumbnail') {
      updateTemplate({ thumbnail: undefined })
    } else {
      updateSide(
        activeSide.id,
        kind === 'background' ? { background: undefined } : { overlay: undefined }
      )
      if (kind === 'background' && oldPath && config.thumbnail === oldPath) {
        updateTemplate({ thumbnail: undefined })
        thumbAlsoRemoved = true
      }
    }

    if (
      oldPath &&
      !(
        !thumbAlsoRemoved &&
        isImagePathReferencedElsewhere(oldPath, { sideId: activeSide.id, kind })
      )
    ) {
      setLocalImages((prev) => {
        if (!(oldPath in prev)) return prev
        const next = { ...prev }
        delete next[oldPath]
        return next
      })
    }
  }

  const handleGenerateThumbnail = async () => {
    const targetSide = activeSide ?? config.sides[0]
    if (!targetSide) return
    setIsGeneratingThumb(true)
    try {
      const sampleValues = collectTemplateValues(config, 'sample')
      const maxWidth = 1000
      const scale = config.canvasSize.width > maxWidth ? maxWidth / config.canvasSize.width : 1
      const canvas = await renderSideToCanvas(config, targetSide, sampleValues, {
        mode: 'filled',
        scale,
        exportBleedMm: 0,
        assetOverrides,
        extraFonts,
        showTrimGuide: false,
        showDebugBoxes: false,
      })
      const blob = await canvasToPngBlob(canvas)
      const blobUrl = URL.createObjectURL(blob)
      const nextPath = './thumb.png'
      const oldThumb = config.thumbnail
      const shouldPruneOld =
        oldThumb &&
        oldThumb !== nextPath &&
        !isImagePathReferencedElsewhere(oldThumb, { kind: 'thumbnail' })

      updateTemplate({ thumbnail: nextPath })
      setAssetOverrides((prev) => ({
        ...prev,
        [nextPath]: blobUrl,
        [resolveTemplateAssetUrl(config.id, nextPath)]: blobUrl,
      }))
      setLocalImages((prev) => {
        const next: Record<string, Blob> = { ...prev, [nextPath]: blob }
        if (shouldPruneOld && oldThumb) {
          delete next[oldThumb]
        }
        return next
      })
      setIsDirty(true)
    } finally {
      setIsGeneratingThumb(false)
    }
  }

  const handleUploadLocalFont = async (file: File) => {
    const family = await registerUploadedFont(file)
    const { id, label } = fontIdFromFileName(file.name)
    const nextFont: UploadedLocalFont = {
      fileName: file.name,
      file,
      font: {
        id,
        label,
        family,
        url: `/templates/_fonts/${encodeURIComponent(file.name)}`,
      },
    }
    setLocalFonts((prev) => [...prev.filter((item) => item.font.id !== id), nextFont])
    updateTemplate({ defaultFontId: id })
    setIsDirty(true)
  }

  const handleRemoveLocalFont = (fontId: string) => {
    setLocalFonts((prev) => prev.filter((item) => item.font.id !== fontId))
    if (config.defaultFontId === fontId) {
      updateTemplate({ defaultFontId: undefined })
    }
    setIsDirty(true)
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    setImportError(null)
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const seq = ++loadSeqRef.current
        const loaded = await importTemplateZip(file)
        if (seq !== loadSeqRef.current) {
          loaded.revokeUrls()
          return
        }
        // Importing directly in the Designer immediately saves it as the active working draft
        applyPackageToDesigner(loaded, { ownUrls: true, persistDraft: 'dirty' })
        return
      }

      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const check = validateTemplateConfig(parsed)
      if (!check.valid) {
        setImportError(t('designer.importError', { message: check.errors[0] }))
        return
      }
      loadBlankOrRawConfig(parsed as DocumentTemplateConfig, { persistDraft: 'dirty' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid file'
      setImportError(t('designer.importError', { message: msg }))
    }
  }

  const executeLoadAction = async (action: PendingLoadAction) => {
    switch (action.kind) {
      case 'stored':
        loadStoredPackageIntoDesigner(action.pkg)
        break
      case 'preset':
        await loadPresetIntoDesigner(action.preset)
        break
      case 'blank':
        loadBlankOrRawConfig(createBlankTemplate())
        setInspectorTab('template')
        break
      case 'import':
        await handleImportFile(action.file)
        break
    }
  }

  const requestLoadAction = (action: PendingLoadAction) => {
    setOpenMenu(null)
    if (isDirty || draftSaved) {
      setPendingLoad(action)
      return
    }
    void executeLoadAction(action)
  }

  const handleConfirmOverwriteDraft = async () => {
    if (!pendingLoad) return
    const action = pendingLoad
    setPendingLoad(null)
    await executeLoadAction(action)
  }

  const handleSaveDraftAndContinue = async () => {
    if (!pendingLoad) return
    const action = pendingLoad
    await handleSaveToBrowser(false)
    setPendingLoad(null)
    await executeLoadAction(action)
  }

  const showTemporaryFeedback = (kind: 'copied' | 'saved') => {
    setSaveFeedback(kind)
    window.setTimeout(() => {
      setSaveFeedback((current) => (current === kind ? null : current))
    }, 2000)
  }

  const handleSaveToBrowser = async (openInEditor = true) => {
    setIsSavingBrowser(true)
    setImportError(null)
    try {
      const savedPkg = await saveTemplateToBrowser(config, localImages, localFonts, docs)
      // Sync local state to the saved template (e.g. if a built-in ID received a -2 suffix)
      hydratedCleanupRef.current?.()
      hydratedCleanupRef.current = null
      setConfig(deepClone(savedPkg.config))
      setAssetOverrides({ ...savedPkg.assetOverrides })
      setLocalImages({ ...savedPkg.sourceFiles.images })
      setLocalFonts([...savedPkg.sourceFiles.fonts])
      setDocs({ ...(savedPkg.docs ?? {}) })
      setIsDirty(false)
      setDraftSaved(false)
      setDraftSavedAt(null)
      if (!isBlockedByOtherTabRef.current) {
        await saveDesignerDraft({
          savedAt: Date.now(),
          config: deepClone(savedPkg.config),
          images: { ...savedPkg.sourceFiles.images },
          fonts: [...savedPkg.sourceFiles.fonts],
          docs: savedPkg.docs ? { ...savedPkg.docs } : {},
          hasUnsavedChanges: false,
        })
      }
      showTemporaryFeedback('saved')
      if (openInEditor) {
        navigateTo({ page: 'editor', templateId: savedPkg.config.id })
      }
    } catch (err) {
      console.error('[DesignerPage] Failed to save template to browser:', err)
      const msg = err instanceof Error ? err.message : String(err)
      setImportError(msg)
    } finally {
      setIsSavingBrowser(false)
      setOpenMenu(null)
    }
  }

  const handleDownloadJson = () => {
    const json = serializeTemplateConfig(config)
    const blob = new Blob([json], { type: 'application/json' })
    downloadBlob(blob, `${config.id || 'template'}-config.json`)
    setOpenMenu(null)
  }

  const handleDownloadZip = async () => {
    setIsExportingZip(true)
    try {
      const zipBlob = await exportTemplateZip(config, {
        localImages,
        localFonts,
        docs,
      })
      downloadBlob(zipBlob, `${config.id || 'template'}.zip`)
    } finally {
      setIsExportingZip(false)
      setOpenMenu(null)
    }
  }

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(serializeTemplateConfig(config))
    setOpenMenu(null)
    showTemporaryFeedback('copied')
  }

  const handleReloadLatestDraft = async () => {
    takeOverTab()
    const seq = ++loadSeqRef.current
    const draft = await loadDesignerDraft()
    if (seq !== loadSeqRef.current || !draft) return
    const hydrated = await hydrateStoredTemplate(draft)
    if (seq !== loadSeqRef.current) {
      hydrated.revokeUrls()
      return
    }
    applyPackageToDesigner(hydrated, {
      ownUrls: true,
      isDraft: draft.hasUnsavedChanges !== false,
      savedAt: draft.savedAt,
    })
  }

  const menuItemClassName =
    'flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow/60 disabled:opacity-50'

  const exportButtonLabel =
    saveFeedback === 'copied' ? t('designer.copied') : t('designer.exportMenu')

  return (
    <Section
      size="md"
      backgroundClassName="bg-white"
      textClassName="text-chaos-black"
      pattern="chip-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Hidden file input triggered by the Load dropdown menu */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) {
              requestLoadAction({ kind: 'import', file })
            }
          }}
        />

        {/* Title row: Heading + status badges on left, Load & Save dropdowns on right */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-black text-chaos-black sm:text-4xl">
                {t('designer.title')}
              </h1>
              <Badge color={validation.valid ? 'green' : 'red'}>
                {validation.valid
                  ? t('designer.validConfig')
                  : t('designer.invalidConfig', { count: validation.errors.length })}
              </Badge>
              {draftSaved && <DraftSavedBadge savedAt={draftSavedAt} />}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2.5">
              {/* New blank template */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                hasChevron={false}
                leftIcon={<FilePlus2 className="h-4 w-4" />}
                onClick={() => requestLoadAction({ kind: 'blank' })}
              >
                {t('designer.newButton')}
              </Button>

              {/* Load menu: Saved in Browser, Preset templates, Import (.json / .zip) */}
              <ToolbarDropdown
                label={t('designer.loadMenu')}
                variant="outline"
                icon={<FolderOpen className="h-4 w-4" />}
                open={openMenu === 'load'}
                onOpenChange={(next) => setOpenMenu(next ? 'load' : null)}
              >
                {importedPackages.length > 0 && (
                  <>
                    <div className="px-3 py-1 text-[10px] font-black tracking-wider text-chaos-black/50 uppercase">
                      {t('designer.savedGroup')}
                    </div>
                    {importedPackages.map((pkg) => {
                      const isActive = pkg.config.id === config.id
                      return (
                        <button
                          key={pkg.config.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            requestLoadAction({ kind: 'stored', pkg })
                          }}
                          className={`${menuItemClassName} justify-between ${
                            isActive ? 'bg-blue/10 text-blue' : ''
                          }`}
                        >
                          <span className="truncate">
                            {getLocalizedText(pkg.config.name, locale)}
                          </span>
                          {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      )
                    })}
                    <div className="my-1.5 border-t border-chaos-black/15" />
                  </>
                )}

                <div className="px-3 py-1 text-[10px] font-black tracking-wider text-chaos-black/50 uppercase">
                  {t('designer.presetsGroup')}
                </div>
                {TEMPLATES.map((tpl) => {
                  const isActive = tpl.id === config.id
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        requestLoadAction({ kind: 'preset', preset: tpl })
                      }}
                      className={`${menuItemClassName} justify-between ${
                        isActive ? 'bg-blue/10 text-blue' : ''
                      }`}
                    >
                      <span className="truncate">{getLocalizedText(tpl.name, locale)}</span>
                      {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  )
                })}

                <div className="my-1.5 border-t border-chaos-black/15" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenMenu(null)
                    fileInputRef.current?.click()
                  }}
                  className={menuItemClassName}
                >
                  <Upload className="h-4 w-4 shrink-0 text-blue" />
                  <span>{t('designer.importJsonOrZip')}</span>
                </button>
              </ToolbarDropdown>

              {/* Export menu: Download Template (.zip), Download config.json, Copy JSON */}
              <ToolbarDropdown
                label={exportButtonLabel}
                variant="yellow"
                icon={
                  saveFeedback === 'copied' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )
                }
                open={openMenu === 'export'}
                onOpenChange={(next) => setOpenMenu(next ? 'export' : null)}
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={isExportingZip}
                  onClick={handleDownloadZip}
                  className={menuItemClassName}
                >
                  <FolderArchive className="h-4 w-4 shrink-0 text-blue" />
                  <span>{isExportingZip ? t('export.exporting') : t('designer.downloadZip')}</span>
                </button>

                <div className="my-1.5 border-t border-chaos-black/15" />
                <div className="px-3 py-1 text-[10px] font-black tracking-wider text-chaos-black/50 uppercase">
                  {t('designer.advancedExportGroup')}
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleDownloadJson}
                  className={menuItemClassName}
                >
                  <Download className="h-4 w-4 shrink-0 text-blue" />
                  <span>{t('designer.downloadJson')}</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleCopyJson}
                  className={menuItemClassName}
                >
                  <Copy className="h-4 w-4 shrink-0 text-blue" />
                  <span>{t('designer.copyJson')}</span>
                </button>
              </ToolbarDropdown>

              <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-chaos-black/20" />

              {/* One-click Save to Browser (grid stack keeps width constant when showing "Saved!") */}
              <HoverTooltip text={t('common.localBrowserStorageTooltip')} align="right">
                <Button
                  type="button"
                  size="sm"
                  variant="blue"
                  hasChevron={false}
                  disabled={isSavingBrowser || !validation.valid}
                  onClick={() => void handleSaveToBrowser(true)}
                >
                  <span className="inline-grid place-items-center">
                    <span
                      aria-hidden={saveFeedback === 'saved'}
                      className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${
                        saveFeedback === 'saved' ? 'invisible' : ''
                      }`}
                    >
                      <BookmarkCheck className="h-4 w-4 shrink-0" />
                      <span>{t('designer.saveToBrowser')}</span>
                    </span>
                    <span
                      aria-hidden={saveFeedback !== 'saved'}
                      className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${
                        saveFeedback === 'saved' ? '' : 'invisible'
                      }`}
                    >
                      <Check className="h-4 w-4 shrink-0" />
                      <span>{t('designer.savedToBrowser')}</span>
                    </span>
                  </span>
                </Button>
              </HoverTooltip>
            </div>
          </div>

          <p className="max-w-3xl text-sm font-medium text-chaos-black/70">
            {t('designer.subtitle')}
          </p>
        </div>

        {isBlockedByOtherTab && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-chaos-black bg-yellow/45 px-4 py-3 text-xs text-chaos-black shadow-[3px_3px_0px_#0d0d0d]"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-chaos-black" />
              <div className="space-y-0.5">
                <p className="font-black">{t('designer.otherTabWarningTitle')}</p>
                <p className="font-medium text-chaos-black/80">
                  {t('designer.otherTabWarningBody')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={takeOverTab}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-chaos-black bg-white px-3 py-1.5 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow"
              >
                {t('designer.takeOverTab')}
              </button>
              <button
                type="button"
                onClick={() => void handleReloadLatestDraft()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-chaos-black bg-blue px-3 py-1.5 text-xs font-extrabold text-white transition-colors hover:bg-blue/90"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{t('designer.reloadLatestDraft')}</span>
              </button>
            </div>
          </div>
        )}

        {importError && (
          <div className="rounded-lg border-2 border-red bg-red/10 px-4 py-2 text-xs font-bold text-red">
            {importError}
          </div>
        )}

        {!validation.valid && (
          <div className="rounded-lg border-2 border-red bg-red/10 px-4 py-2 text-xs font-semibold text-red">
            {validation.errors.join(' • ')}
          </div>
        )}

        {/* Workspace Controls Bar + Main Designer Grid */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {config.sides.length > 1 ? (
              <SegmentedControl
                appearance="track"
                density="compact"
                value={activeSide.id}
                onValueChange={(next) => {
                  setActiveSideId(next)
                  const nextSide = config.sides.find((s) => s.id === next)
                  setSelectedFieldId(nextSide?.fields[0]?.id ?? null)
                }}
                style={{ '--segmented-control-track-width': '5rem' } as React.CSSProperties}
              >
                {config.sides.map((s) => (
                  <SegmentedControlItem key={s.id} value={s.id}>
                    {s.id}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            ) : (
              <span className="font-mono text-xs font-bold text-chaos-black/60">
                {config.canvasSize.width} × {config.canvasSize.height} px
              </span>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-chaos-black">
                <input
                  type="checkbox"
                  checked={showBoxes}
                  onChange={(e) => setShowBoxes(e.target.checked)}
                />
                <span>{t('designer.showBoxes')}</span>
              </label>

              <span aria-hidden="true" className="h-3.5 w-px bg-chaos-black/20" />

              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-bold text-blue underline-offset-2 hover:underline"
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>{t('designer.shortcutsLink')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            {/* Interactive Canvas */}
            <div className="space-y-3 lg:sticky lg:top-20 lg:col-span-7">
              <DesignerCanvas
                template={config}
                side={activeSide}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onUpdateField={updateField}
                onDuplicateFieldAtOrigin={duplicateFieldAtOrigin}
                assetOverrides={assetOverrides}
                extraFonts={extraFonts}
                showBoxes={showBoxes}
              />

              <p className="text-xs font-semibold text-chaos-black/60">{t('designer.canvasHint')}</p>
            </div>

            {/* Right Inspector Sidebar */}
            <div className="space-y-4 rounded-xl border-3 border-chaos-black bg-[#f5f0e8] p-4 shadow-[4px_4px_0px_#0d0d0d] lg:col-span-5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInspectorTab('fields')}
                className={`rounded-md border-2 border-chaos-black py-2 text-xs font-extrabold transition-colors ${
                  inspectorTab === 'fields'
                    ? 'bg-chaos-black text-yellow'
                    : 'bg-white text-chaos-black hover:bg-yellow/40'
                }`}
              >
                {t('designer.tabFields')}
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('template')}
                className={`rounded-md border-2 border-chaos-black py-2 text-xs font-extrabold transition-colors ${
                  inspectorTab === 'template'
                    ? 'bg-chaos-black text-yellow'
                    : 'bg-white text-chaos-black hover:bg-yellow/40'
                }`}
              >
                {t('designer.tabTemplate')}
              </button>
            </div>

            {inspectorTab === 'fields' ? (
              <FieldInspector
                template={config}
                side={activeSide}
                selectedFieldId={selectedFieldId}
                extraFonts={extraFonts}
                onSelectField={setSelectedFieldId}
                onAddField={addField}
                onDuplicateField={duplicateField}
                onRenameField={renameField}
                onUpdateField={updateField}
                onDeleteField={deleteField}
                onMoveFieldOrder={moveFieldOrder}
              />
            ) : (
              <TemplateMetaPanel
                template={config}
                activeSide={activeSide}
                assetOverrides={assetOverrides}
                extraFonts={extraFonts}
                docs={docs}
                onUpdateTemplate={updateTemplate}
                onUpdateDocs={updateDocs}
                onAddSide={addSide}
                onRemoveSide={removeSide}
                onUploadLocalImage={handleUploadLocalImage}
                onRemoveSideImage={handleRemoveSideImage}
                onGenerateThumbnail={handleGenerateThumbnail}
                isGeneratingThumbnail={isGeneratingThumb}
                onUploadLocalFont={handleUploadLocalFont}
                onRemoveLocalFont={handleRemoveLocalFont}
              />
            )}
            </div>
          </div>
        </div>
      </div>
      <Dialog
        open={pendingLoad !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingLoad(null)
        }}
      >
        <DialogContent className="max-w-md text-center !animate-none ![transform:translate(-50%,-50%)]">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-center">
              {t('designer.overwriteDraftTitle')}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t('designer.overwriteDraftDescription', {
                name: getLocalizedText(config.name, locale) || config.id,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2.5 pt-4">
            <Button
              type="button"
              size="sm"
              variant="blue"
              hasChevron={false}
              className="w-full"
              disabled={isSavingBrowser || !validation.valid}
              onClick={() => void handleSaveDraftAndContinue()}
            >
              {t('designer.overwriteDraftSaveFirst')}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="destructive"
              hasChevron={false}
              className="w-full"
              onClick={() => void handleConfirmOverwriteDraft()}
            >
              {t('designer.overwriteDraftConfirm')}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              hasChevron={false}
              className="w-full"
              onClick={() => setPendingLoad(null)}
            >
              {t('designer.overwriteDraftCancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingResize !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingResize(null)
        }}
      >
        <DialogContent className="max-w-md text-center !animate-none ![transform:translate(-50%,-50%)]">
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-center">
              {t('designer.resizeFieldsTitle')}
            </DialogTitle>
            <DialogDescription className="text-center">
              {pendingResize &&
                t('designer.resizeFieldsDescription', {
                  newW: pendingResize.newSize.width,
                  newH: pendingResize.newSize.height,
                  oldW: pendingResize.oldSize.width,
                  oldH: pendingResize.oldSize.height,
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2.5 pt-4">
            <Button
              type="button"
              size="sm"
              variant="blue"
              hasChevron={false}
              className="w-full"
              onClick={() => handleApplyCanvasResize('scale-fields')}
            >
              {t('designer.resizeFieldsScale')}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="yellow"
              hasChevron={false}
              className="w-full"
              onClick={() => handleApplyCanvasResize('resize-only')}
            >
              {t('designer.resizeFieldsCanvasOnly')}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              hasChevron={false}
              className="w-full"
              onClick={() => handleApplyCanvasResize('keep-canvas')}
            >
              {pendingResize
                ? t('designer.resizeFieldsKeepCanvas', {
                    oldW: pendingResize.oldSize.width,
                    oldH: pendingResize.oldSize.height,
                  })
                : t('designer.overwriteDraftCancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DesignerShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </Section>
  )
}
