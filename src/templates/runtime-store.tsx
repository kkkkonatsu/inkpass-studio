import * as React from 'react'
import {
  deleteStoredTemplate,
  hydrateStoredTemplate,
  listStoredTemplates,
  packageToStoredRecord,
  putStoredTemplate,
} from '@/engine/template-storage'
import {
  importTemplateZip,
  type LoadedTemplatePackage,
  type UploadedLocalFont,
} from '@/engine/template-zip'
import type { BundledCardFont } from '@/fonts'
import { TEMPLATES, getBuiltInTemplateDocs, getTemplateById } from './registry'
import type { DocumentTemplateConfig, LocalizedText } from './schema'
import { normalizeTemplateDocs, type TemplateDocs } from './template-docs'

export interface ResolvedTemplateEntry {
  config: DocumentTemplateConfig
  assetOverrides?: Record<string, string>
  extraFonts?: readonly BundledCardFont[]
  docs?: TemplateDocs
  isImported: boolean
}

function appendSuffixToLocalizedText(text: LocalizedText, suffix: string): LocalizedText {
  const updated: LocalizedText = {}
  for (const [locale, value] of Object.entries(text)) {
    if (typeof value === 'string' && value.trim()) {
      updated[locale as keyof LocalizedText] = `${value}${suffix}`
    }
  }
  return updated
}

/**
 * Ensures an imported/saved template never overwrites or hides an existing built-in
 * or colliding template with the same `id`.
 * If `id` already exists in `existingIds`, appends `-2`, `-3`, ... to `config.id` and
 * ` (2)`, ` (3)`, ... to `config.name`, while preserving all `assetOverrides` lookups.
 */
export function deduplicateImportedPackage(
  loaded: LoadedTemplatePackage,
  existingIds: ReadonlySet<string>
): LoadedTemplatePackage {
  const originalId = loaded.config.id
  if (!existingIds.has(originalId)) {
    return loaded
  }

  let counter = 2
  while (existingIds.has(`${originalId}-${counter}`)) {
    counter += 1
  }

  const nextId = `${originalId}-${counter}`
  const oldPrefix = `/templates/${encodeURIComponent(originalId)}/`
  const nextPrefix = `/templates/${encodeURIComponent(nextId)}/`

  const nextAssetOverrides: Record<string, string> = { ...loaded.assetOverrides }
  for (const [key, url] of Object.entries(loaded.assetOverrides)) {
    if (key.startsWith(oldPrefix)) {
      nextAssetOverrides[`${nextPrefix}${key.slice(oldPrefix.length)}`] = url
    }
  }

  return {
    ...loaded,
    config: {
      ...loaded.config,
      id: nextId,
      name: appendSuffixToLocalizedText(loaded.config.name, ` (${counter})`),
    },
    assetOverrides: nextAssetOverrides,
  }
}

interface RuntimeTemplatesContextValue {
  /** Built-in templates + any .zip or browser-saved templates */
  allTemplates: ResolvedTemplateEntry[]
  importedPackages: LoadedTemplatePackage[]
  /** True while restoring persisted templates from IndexedDB on initial page load */
  isHydrating: boolean
  importZipFile: (file: File) => Promise<LoadedTemplatePackage>
  saveTemplateToBrowser: (
    config: DocumentTemplateConfig,
    localImages: Record<string, Blob>,
    localFonts: readonly UploadedLocalFont[],
    docs?: TemplateDocs
  ) => Promise<LoadedTemplatePackage>
  removeImportedTemplate: (id: string) => void
  getTemplateEntry: (id: string) => ResolvedTemplateEntry | undefined
}

const RuntimeTemplatesContext = React.createContext<RuntimeTemplatesContextValue | null>(null)

export function RuntimeTemplatesProvider({ children }: { children: React.ReactNode }) {
  const [importedPackages, setImportedPackages] = React.useState<LoadedTemplatePackage[]>([])
  const [isHydrating, setIsHydrating] = React.useState(true)
  const packagesRef = React.useRef<LoadedTemplatePackage[]>([])

  React.useEffect(() => {
    packagesRef.current = importedPackages
  }, [importedPackages])

  // Restore persisted templates from IndexedDB on initial load
  React.useEffect(() => {
    let active = true
    listStoredTemplates()
      .then(async (records) => {
        if (!active || records.length === 0) return
        const hydrated = await Promise.all(records.map((rec) => hydrateStoredTemplate(rec)))
        if (!active) {
          hydrated.forEach((pkg) => pkg.revokeUrls())
          return
        }
        setImportedPackages(hydrated)
      })
      .finally(() => {
        if (active) setIsHydrating(false)
      })

    return () => {
      active = false
    }
  }, [])

  // Revoke all Object URLs on unmount
  React.useEffect(() => {
    return () => {
      for (const pkg of packagesRef.current) {
        pkg.revokeUrls()
      }
    }
  }, [])

  const importZipFile = React.useCallback(async (file: File) => {
    const rawLoaded = await importTemplateZip(file)
    const existingIds = new Set<string>([
      ...TEMPLATES.map((tpl) => tpl.id),
      ...packagesRef.current.map((pkg) => pkg.config.id),
    ])
    const uniqueLoaded = deduplicateImportedPackage(rawLoaded, existingIds)
    await putStoredTemplate(packageToStoredRecord(uniqueLoaded))
    setImportedPackages((prev) => [uniqueLoaded, ...prev])
    return uniqueLoaded
  }, [])

  const saveTemplateToBrowser = React.useCallback(
    async (
      config: DocumentTemplateConfig,
      localImages: Record<string, Blob>,
      localFonts: readonly UploadedLocalFont[],
      docs?: TemplateDocs
    ) => {
      // Never collide with a built-in preset ID; allow updating an existing browser-saved ID in place
      const builtInIds = new Set(TEMPLATES.map((tpl) => tpl.id))
      const normalizedDocs = normalizeTemplateDocs(docs)
      const rawHydrated = await hydrateStoredTemplate({
        id: config.id,
        savedAt: Date.now(),
        config: JSON.parse(JSON.stringify(config)) as DocumentTemplateConfig,
        images: { ...localImages },
        fonts: [...localFonts],
        ...(normalizedDocs ? { docs: normalizedDocs } : {}),
      })

      const savedPkg = builtInIds.has(rawHydrated.config.id)
        ? deduplicateImportedPackage(
            rawHydrated,
            new Set([
              ...builtInIds,
              ...packagesRef.current.map((pkg) => pkg.config.id),
            ])
          )
        : rawHydrated

      await putStoredTemplate(packageToStoredRecord(savedPkg))

      const previousSameId = packagesRef.current.find((p) => p.config.id === savedPkg.config.id)
      const nextPackages = [
        savedPkg,
        ...packagesRef.current.filter((p) => p.config.id !== savedPkg.config.id),
      ]
      packagesRef.current = nextPackages
      setImportedPackages(nextPackages)
      previousSameId?.revokeUrls()

      return savedPkg
    },
    []
  )

  const removeImportedTemplate = React.useCallback((id: string) => {
    void deleteStoredTemplate(id)
    setImportedPackages((prev) => {
      const target = prev.find((p) => p.config.id === id)
      target?.revokeUrls()
      return prev.filter((p) => p.config.id !== id)
    })
  }, [])

  const allTemplates = React.useMemo<ResolvedTemplateEntry[]>(() => {
    const importedEntries: ResolvedTemplateEntry[] = importedPackages.map((pkg) => ({
      config: pkg.config,
      assetOverrides: pkg.assetOverrides,
      extraFonts: pkg.extraFonts,
      docs: pkg.docs,
      isImported: true,
    }))
    const builtInEntries: ResolvedTemplateEntry[] = TEMPLATES.map((tpl) => ({
      config: tpl,
      docs: getBuiltInTemplateDocs(tpl.id),
      isImported: false,
    }))
    return [...importedEntries, ...builtInEntries]
  }, [importedPackages])

  const getTemplateEntry = React.useCallback(
    (id: string): ResolvedTemplateEntry | undefined => {
      const imported = importedPackages.find((pkg) => pkg.config.id === id)
      if (imported) {
        return {
          config: imported.config,
          assetOverrides: imported.assetOverrides,
          extraFonts: imported.extraFonts,
          docs: imported.docs,
          isImported: true,
        }
      }
      const builtIn = getTemplateById(id)
      return builtIn
        ? { config: builtIn, docs: getBuiltInTemplateDocs(builtIn.id), isImported: false }
        : undefined
    },
    [importedPackages]
  )

  const value = React.useMemo(
    () => ({
      allTemplates,
      importedPackages,
      isHydrating,
      importZipFile,
      saveTemplateToBrowser,
      removeImportedTemplate,
      getTemplateEntry,
    }),
    [
      allTemplates,
      importedPackages,
      isHydrating,
      importZipFile,
      saveTemplateToBrowser,
      removeImportedTemplate,
      getTemplateEntry,
    ]
  )

  return (
    <RuntimeTemplatesContext.Provider value={value}>{children}</RuntimeTemplatesContext.Provider>
  )
}

export function useRuntimeTemplates(): RuntimeTemplatesContextValue {
  const ctx = React.useContext(RuntimeTemplatesContext)
  if (!ctx) {
    throw new Error('useRuntimeTemplates must be used inside <RuntimeTemplatesProvider>.')
  }
  return ctx
}
