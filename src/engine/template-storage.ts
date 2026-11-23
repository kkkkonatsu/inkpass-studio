import type { LoadedTemplatePackage, UploadedLocalFont } from '@/engine/template-zip'
import type { BundledCardFont } from '@/fonts'
import { resolveTemplateAssetUrl, type DocumentTemplateConfig } from '@/templates/schema'
import { normalizeTemplateDocs, type TemplateDocs } from '@/templates/template-docs'

const DB_NAME = 'splatoon-id-studio-db'
const DB_VERSION = 1
const TEMPLATES_STORE = 'templates'
const DRAFTS_STORE = 'drafts'
const DESIGNER_DRAFT_KEY = 'designer-draft'

export interface StoredTemplateRecord {
  id: string
  savedAt: number
  config: DocumentTemplateConfig
  /** Raw image Blobs keyed by path (e.g. "./front.png") */
  images: Record<string, Blob>
  /** Raw font Blobs + metadata */
  fonts: UploadedLocalFont[]
  /** Optional `CREDITS.txt` / `LICENSE.txt` text */
  docs?: TemplateDocs
}

export interface StoredDesignerDraft extends StoredTemplateRecord {
  /**
   * `true` when the user edited or imported unsaved changes (triggers "Overwrite Unsaved Draft?").
   * `false` when freshly loaded/saved (still persisted so page refreshes keep the active template).
   */
  hasUnsavedChanges?: boolean
}

interface StoredDraftRecord extends Omit<StoredDesignerDraft, 'id'> {
  key: string
}

/**
 * Plain ArrayBuffer wrapper stored in IndexedDB instead of raw `Blob` objects.
 * Firefox & Safari can throw `UnknownError` ("The operation failed for reasons unrelated to
 * the database itself...") when re-saving an IndexedDB-backed Blob handle over the same key.
 */
export interface SerializedBlob {
  __inkpassBlob: true
  type: string
  bytes: ArrayBuffer
}

type StorableBlob = Blob | SerializedBlob

interface SerializedUploadedLocalFont {
  font: UploadedLocalFont['font']
  file: StorableBlob
  fileName: string
}

interface SerializedTemplateRecord extends Omit<StoredTemplateRecord, 'images' | 'fonts'> {
  images: Record<string, StorableBlob>
  fonts: SerializedUploadedLocalFont[]
}

interface SerializedDraftRecord extends Omit<StoredDraftRecord, 'images' | 'fonts'> {
  images: Record<string, StorableBlob>
  fonts: SerializedUploadedLocalFont[]
}

function isSerializedBlob(value: unknown): value is SerializedBlob {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<SerializedBlob>).__inkpassBlob === true &&
    'bytes' in value
  )
}

async function serializeBlob(blob: StorableBlob): Promise<SerializedBlob> {
  if (isSerializedBlob(blob)) return blob
  const bytes = await blob.arrayBuffer()
  return {
    __inkpassBlob: true,
    type: blob.type || 'application/octet-stream',
    bytes,
  }
}

async function deserializeBlob(value: StorableBlob): Promise<Blob> {
  if (isSerializedBlob(value)) {
    return new Blob([value.bytes], { type: value.type })
  }
  // Detach legacy IndexedDB-backed Blob handles into pure in-memory Blobs
  const bytes = await value.arrayBuffer()
  return new Blob([bytes], { type: value.type })
}

export async function serializeRecordForStorage<
  T extends { images: Record<string, Blob>; fonts: UploadedLocalFont[] },
>(
  record: T
): Promise<Omit<T, 'images' | 'fonts'> & { images: Record<string, SerializedBlob>; fonts: SerializedUploadedLocalFont[] }> {
  const images: Record<string, SerializedBlob> = {}
  for (const [key, blob] of Object.entries(record.images)) {
    if (!blob) continue
    images[key] = await serializeBlob(blob)
  }

  const fonts: SerializedUploadedLocalFont[] = []
  for (const entry of record.fonts) {
    if (!entry.file) continue
    fonts.push({
      font: entry.font,
      fileName: entry.fileName,
      file: await serializeBlob(entry.file),
    })
  }

  return {
    ...record,
    images,
    fonts,
  }
}

export async function deserializeRecordFromStorage<
  T extends { images: Record<string, StorableBlob>; fonts: SerializedUploadedLocalFont[] },
>(
  record: T
): Promise<Omit<T, 'images' | 'fonts'> & { images: Record<string, Blob>; fonts: UploadedLocalFont[] }> {
  const images: Record<string, Blob> = {}
  for (const [key, value] of Object.entries(record.images ?? {})) {
    if (!value) continue
    images[key] = await deserializeBlob(value)
  }

  const fonts: UploadedLocalFont[] = []
  for (const entry of record.fonts ?? []) {
    if (!entry.file) continue
    fonts.push({
      font: entry.font,
      fileName: entry.fileName,
      file: await deserializeBlob(entry.file),
    })
  }

  return {
    ...record,
    images,
    fonts,
  }
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
        db.createObjectStore(TEMPLATES_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
        db.createObjectStore(DRAFTS_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

async function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    let settled = false
    let result: T
    const finishReject = (err: unknown) => {
      if (settled) return
      settled = true
      try {
        db.close()
      } catch {
        // Ignore close errors.
      }
      reject(err)
    }

    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const req = executor(store)
    req.onsuccess = () => {
      result = req.result
    }
    req.onerror = () => finishReject(req.error ?? new Error('IndexedDB request failed'))
    tx.oncomplete = () => {
      if (settled) return
      settled = true
      db.close()
      resolve(result)
    }
    tx.onerror = () => finishReject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => finishReject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

/** Converts an in-memory LoadedTemplatePackage into a storable IndexedDB record. */
export function packageToStoredRecord(pkg: LoadedTemplatePackage): StoredTemplateRecord {
  // Deduplicate image Blobs by preferring relative "./..." keys where available
  const images: Record<string, Blob> = {}
  for (const [key, blob] of Object.entries(pkg.sourceFiles.images)) {
    images[key] = blob
  }

  const docs = normalizeTemplateDocs(pkg.docs)

  return {
    id: pkg.config.id,
    savedAt: Date.now(),
    config: pkg.config,
    images,
    fonts: pkg.sourceFiles.fonts,
    ...(docs ? { docs } : {}),
  }
}

/**
 * Rehydrates a StoredTemplateRecord from IndexedDB into a live `LoadedTemplatePackage`
 * with in-memory Blob URLs and registered `FontFace` instances.
 */
export async function hydrateStoredTemplate(
  record: StoredTemplateRecord
): Promise<LoadedTemplatePackage> {
  const createdUrls: string[] = []
  const makeUrl = (blob: Blob): string => {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob)
      createdUrls.push(url)
      return url
    }
    return ''
  }

  // Avoid creating duplicate Blob URLs for the same underlying Blob instance
  const blobUrlCache = new Map<Blob, string>()
  const getOrCreateUrl = (blob: Blob): string => {
    const existing = blobUrlCache.get(blob)
    if (existing !== undefined) return existing
    const url = makeUrl(blob)
    blobUrlCache.set(blob, url)
    return url
  }

  const assetOverrides: Record<string, string> = {}
  const normalizedImages: Record<string, Blob> = {}

  for (const [rawKey, blob] of Object.entries(record.images)) {
    if (!blob) continue
    const url = getOrCreateUrl(blob)
    const resolved = resolveTemplateAssetUrl(record.config.id, rawKey)
    normalizedImages[rawKey] = blob
    if (url) {
      assetOverrides[rawKey] = url
      assetOverrides[resolved] = url
      if (rawKey.startsWith('./')) {
        assetOverrides[rawKey.slice(2)] = url
      }
    }
  }

  const extraFonts: BundledCardFont[] = []
  const hydratedFonts: UploadedLocalFont[] = []

  for (const entry of record.fonts) {
    if (!entry.file) continue
    const url = getOrCreateUrl(entry.file)
    const fontRecord: BundledCardFont = {
      ...entry.font,
      url: url || entry.font.url,
    }
    extraFonts.push(fontRecord)
    hydratedFonts.push({ ...entry, font: fontRecord })
  }

  if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
    await Promise.all(
      hydratedFonts.map(async ({ font, file }) => {
        try {
          const face = new FontFace(font.family, await file.arrayBuffer(), {
            weight: font.weight ?? '100 900',
            style: font.style ?? 'normal',
          })
          const loaded = await face.load()
          document.fonts.add(loaded)
        } catch (err) {
          console.warn(`[template-storage] Could not register font "${font.family}":`, err)
        }
      })
    )
    await document.fonts.ready
  }

  const docs = normalizeTemplateDocs(record.docs)

  return {
    config: record.config,
    assetOverrides,
    extraFonts,
    ...(docs ? { docs } : {}),
    sourceFiles: {
      images: normalizedImages,
      fonts: hydratedFonts,
    },
    revokeUrls: () => {
      for (const url of createdUrls) {
        URL.revokeObjectURL(url)
      }
    },
  }
}

export async function listStoredTemplates(): Promise<StoredTemplateRecord[]> {
  if (!hasIndexedDb()) return []
  try {
    const rawRecords = await runTransaction<SerializedTemplateRecord[]>(
      TEMPLATES_STORE,
      'readonly',
      (s) => s.getAll()
    )
    const records = await Promise.all(
      rawRecords.map((rec) => deserializeRecordFromStorage(rec))
    )
    return records.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
  } catch (err) {
    console.warn('[template-storage] Failed to list stored templates:', err)
    return []
  }
}

export async function putStoredTemplate(record: StoredTemplateRecord): Promise<void> {
  if (!hasIndexedDb()) return
  const serialized = await serializeRecordForStorage(record)
  await runTransaction(TEMPLATES_STORE, 'readwrite', (s) => s.put(serialized))
}

export async function deleteStoredTemplate(id: string): Promise<void> {
  if (!hasIndexedDb()) return
  try {
    await runTransaction(TEMPLATES_STORE, 'readwrite', (s) => s.delete(id))
  } catch (err) {
    console.warn('[template-storage] Failed to delete template from IndexedDB:', err)
  }
}

export async function loadDesignerDraft(): Promise<StoredDesignerDraft | null> {
  if (!hasIndexedDb()) return null
  try {
    const rawRecord = await runTransaction<SerializedDraftRecord | undefined>(
      DRAFTS_STORE,
      'readonly',
      (s) => s.get(DESIGNER_DRAFT_KEY)
    )
    if (!rawRecord) return null
    const record = await deserializeRecordFromStorage(rawRecord)
    const docs = normalizeTemplateDocs(record.docs)
    return {
      id: record.config.id,
      savedAt: record.savedAt,
      config: record.config,
      images: record.images,
      fonts: record.fonts,
      hasUnsavedChanges: record.hasUnsavedChanges ?? true,
      ...(docs ? { docs } : {}),
    }
  } catch (err) {
    console.warn('[template-storage] Failed to load designer draft:', err)
    return null
  }
}

export async function saveDesignerDraft(
  draft: Omit<StoredDesignerDraft, 'id'>
): Promise<void> {
  if (!hasIndexedDb()) return
  try {
    const docs = normalizeTemplateDocs(draft.docs)
    const record: StoredDraftRecord = {
      key: DESIGNER_DRAFT_KEY,
      savedAt: draft.savedAt,
      config: draft.config,
      images: draft.images,
      fonts: draft.fonts,
      hasUnsavedChanges: draft.hasUnsavedChanges ?? true,
      ...(docs ? { docs } : {}),
    }
    const serialized = await serializeRecordForStorage(record)
    await runTransaction(DRAFTS_STORE, 'readwrite', (s) => s.put(serialized))
  } catch (err) {
    console.warn('[template-storage] Failed to save designer draft:', err)
  }
}

export async function clearDesignerDraft(): Promise<void> {
  if (!hasIndexedDb()) return
  try {
    await runTransaction(DRAFTS_STORE, 'readwrite', (s) => s.delete(DESIGNER_DRAFT_KEY))
  } catch (err) {
    console.warn('[template-storage] Failed to clear designer draft:', err)
  }
}
