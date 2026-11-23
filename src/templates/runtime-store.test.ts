import { describe, expect, it } from 'vitest'
import type { LoadedTemplatePackage } from '@/engine/template-zip'
import { deduplicateImportedPackage } from './runtime-store'

function makePackage(id: string): LoadedTemplatePackage {
  return {
    config: {
      id,
      category: 'id-card',
      organization: { en: 'Grizzco', ja: 'クマサン商会' },
      name: { en: 'Staff ID', ja: '社員証' },
      description: { en: 'Test' },
      canvasSize: { width: 1011, height: 638 },
      physicalSizeMm: { width: 85.6, height: 53.98 },
      fonts: [],
      defaultFontFamily: 'sans-serif',
      sides: [
        {
          id: 'front',
          label: { en: 'Front' },
          background: './front.png',
          fields: [],
        },
      ],
    },
    assetOverrides: {
      './front.png': 'blob:front',
      [`/templates/${id}/front.png`]: 'blob:front',
    },
    extraFonts: [],
    sourceFiles: { images: {}, fonts: [] },
    revokeUrls: () => {},
  }
}

describe('deduplicateImportedPackage', () => {
  it('keeps unique template IDs and names untouched', () => {
    const pkg = makePackage('brand-new-card')
    const result = deduplicateImportedPackage(pkg, new Set(['grizzco-staff-id']))
    expect(result.config.id).toBe('brand-new-card')
    expect(result.config.name).toEqual({ en: 'Staff ID', ja: '社員証' })
  })

  it('appends incremental suffixes on ID collision and re-keys asset overrides', () => {
    const existing = new Set(['grizzco-staff-id', 'grizzco-staff-id-2'])
    const pkg = makePackage('grizzco-staff-id')

    const result = deduplicateImportedPackage(pkg, existing)
    expect(result.config.id).toBe('grizzco-staff-id-3')
    expect(result.config.name).toEqual({ en: 'Staff ID (3)', ja: '社員証 (3)' })
    expect(result.assetOverrides['./front.png']).toBe('blob:front')
    expect(result.assetOverrides['/templates/grizzco-staff-id-3/front.png']).toBe('blob:front')
  })
})
