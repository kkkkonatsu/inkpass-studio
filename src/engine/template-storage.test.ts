import { describe, expect, it } from 'vitest'
import type { DocumentTemplateConfig } from '@/templates/schema'
import {
  deserializeRecordFromStorage,
  hydrateStoredTemplate,
  packageToStoredRecord,
  serializeRecordForStorage,
  type StoredTemplateRecord,
} from './template-storage'

const sampleConfig: DocumentTemplateConfig = {
  id: 'browser-saved-card',
  category: 'id-card',
  organization: { en: 'Inkblot' },
  name: { en: 'Custom Pass' },
  description: { en: 'Saved in browser' },
  thumbnail: './front.png',
  canvasSize: { width: 1011, height: 638 },
  physicalSizeMm: { width: 85.6, height: 53.98 },
  fonts: [],
  defaultFontId: 'my-font',
  defaultFontFamily: 'sans-serif',
  sides: [
    {
      id: 'front',
      label: { en: 'Front' },
      background: './front.png',
      fields: [],
    },
  ],
}

describe('browser template storage hydration', () => {
  it('round-trips a stored record into a live LoadedTemplatePackage and back', async () => {
    const fakeImg = new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' })
    const fakeFont = new Blob([Uint8Array.from([79, 84, 79, 79])], { type: 'font/otf' })

    const record: StoredTemplateRecord = {
      id: sampleConfig.id,
      savedAt: 123456789,
      config: sampleConfig,
      images: { './front.png': fakeImg },
      fonts: [
        {
          fileName: 'MyFont.otf',
          file: fakeFont,
          font: {
            id: 'my-font',
            label: 'My Font',
            family: 'MyFont',
            url: '/templates/_fonts/MyFont.otf',
          },
        },
      ],
      docs: {
        credits: 'Artwork by @squid',
        license: 'CC BY-NC 4.0',
      },
    }

    const hydrated = await hydrateStoredTemplate(record)
    expect(hydrated.config.id).toBe('browser-saved-card')
    expect(hydrated.sourceFiles.images['./front.png']).toBe(fakeImg)
    expect(hydrated.extraFonts).toHaveLength(1)
    expect(hydrated.extraFonts[0].id).toBe('my-font')
    expect(hydrated.docs).toEqual({
      credits: 'Artwork by @squid',
      license: 'CC BY-NC 4.0',
    })

    const reserialized = packageToStoredRecord(hydrated)
    expect(reserialized.id).toBe('browser-saved-card')
    expect(reserialized.images['./front.png']).toBe(fakeImg)
    expect(reserialized.fonts[0].fileName).toBe('MyFont.otf')
    expect(reserialized.docs).toEqual({
      credits: 'Artwork by @squid',
      license: 'CC BY-NC 4.0',
    })
    hydrated.revokeUrls()
  })

  it('serializes Blobs to plain ArrayBuffers for IndexedDB and restores both new and legacy records', async () => {
    const imgBytes = Uint8Array.from([137, 80, 78, 71, 13, 10])
    const fontBytes = Uint8Array.from([79, 84, 79, 79, 1, 2])
    const record: StoredTemplateRecord = {
      id: sampleConfig.id,
      savedAt: 999,
      config: sampleConfig,
      images: { './front.png': new Blob([imgBytes], { type: 'image/png' }) },
      fonts: [
        {
          fileName: 'MyFont.otf',
          file: new Blob([fontBytes], { type: 'font/otf' }),
          font: {
            id: 'my-font',
            label: 'My Font',
            family: 'MyFont',
            url: '/templates/_fonts/MyFont.otf',
          },
        },
      ],
    }

    const serialized = await serializeRecordForStorage(record)
    expect(serialized.images['./front.png'].__inkpassBlob).toBe(true)
    expect(serialized.images['./front.png'].bytes).toBeInstanceOf(ArrayBuffer)
    expect((serialized.fonts[0].file as { __inkpassBlob?: boolean }).__inkpassBlob).toBe(true)

    const restored = await deserializeRecordFromStorage(serialized)
    expect(restored.images['./front.png']).toBeInstanceOf(Blob)
    expect(new Uint8Array(await restored.images['./front.png'].arrayBuffer())).toEqual(imgBytes)
    expect(new Uint8Array(await restored.fonts[0].file.arrayBuffer())).toEqual(fontBytes)

    // Also supports legacy raw Blob records saved before ArrayBuffer serialization
    const restoredLegacy = await deserializeRecordFromStorage(record)
    expect(new Uint8Array(await restoredLegacy.images['./front.png'].arrayBuffer())).toEqual(
      imgBytes
    )
  })
})
