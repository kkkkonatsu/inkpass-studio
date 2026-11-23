import { describe, expect, it } from 'vitest'
import {
  collectTemplateValues,
  getLocalizedText,
  validateTemplateConfig,
  withBaseUrl,
  type DocumentTemplateConfig,
} from './schema'

const validSampleConfig: DocumentTemplateConfig = {
  id: 'sample-card',
  category: 'id-card',
  organization: { en: 'Grizzco', ja: 'クマサン商会' },
  name: { en: 'Staff ID', ja: '社員証' },
  description: { en: 'Test card' },
  canvasSize: { width: 1011, height: 638 },
  physicalSizeMm: { width: 85.6, height: 53.98 },
  fonts: [],
  defaultFontFamily: 'sans-serif',
  sides: [
    {
      id: 'front',
      label: { en: 'Front', ja: '表面' },
      backgroundColor: '#ffffff',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: { en: 'Name', ja: '氏名' },
          x: 100,
          y: 120,
          width: 300,
          height: 48,
          fontSize: 28,
          color: '#0d0d0d',
          sampleValue: 'イカ 太郎',
        },
        {
          id: 'barcode',
          type: 'barcode',
          label: { en: 'Barcode' },
          x: 100,
          y: 500,
          width: 320,
          height: 80,
          defaultValue: 'GRZ-0001',
        },
      ],
    },
  ],
}

describe('template schema validation', () => {
  it('accepts a valid template config', () => {
    expect(validateTemplateConfig(validSampleConfig)).toEqual({ valid: true, errors: [] })
  })

  it('catches invalid dimensions, duplicate field IDs, and unknown field types', () => {
    const broken = {
      ...validSampleConfig,
      canvasSize: { width: 0, height: -10 },
      sides: [
        {
          id: 'front',
          label: { en: 'Front' },
          fields: [
            { id: 'dup', type: 'text', label: { en: 'A' }, x: 0, y: 0, width: 10, height: 10 },
            { id: 'dup', type: 'unknown', label: { en: 'B' }, x: 0, y: 0, width: -5, height: 10 },
          ],
        },
      ],
    }

    const result = validateTemplateConfig(broken)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('canvasSize'))).toBe(true)
    expect(result.errors.some((e) => e.includes('Duplicate field id'))).toBe(true)
    expect(result.errors.some((e) => e.includes('unsupported type'))).toBe(true)
  })

  it('resolves localized labels with fallback and collects sample/default values', () => {
    expect(getLocalizedText({ en: 'Staff ID', ja: '社員証' }, 'ja')).toBe('社員証')
    expect(getLocalizedText({ en: 'Staff ID', ja: '社員証' }, 'zh-Hans')).toBe('Staff ID')
    expect(collectTemplateValues(validSampleConfig, 'sample')).toEqual({
      name: 'イカ 太郎',
      barcode: 'GRZ-0001',
    })
    expect(collectTemplateValues(validSampleConfig, 'default')).toEqual({
      barcode: 'GRZ-0001',
    })
  })

  it('prefixes root-relative public asset URLs with configured Vite base path', () => {
    expect(withBaseUrl('/templates/card/front.png', '/')).toBe('/templates/card/front.png')
    expect(withBaseUrl('/templates/card/front.png', '/inkpass-studio/')).toBe(
      '/inkpass-studio/templates/card/front.png'
    )
    expect(withBaseUrl('/inkpass-studio/templates/card/front.png', '/inkpass-studio/')).toBe(
      '/inkpass-studio/templates/card/front.png'
    )
    expect(withBaseUrl('/templates/card/front.png', './')).toBe('./templates/card/front.png')
    expect(withBaseUrl('blob:https://example.com/123', '/inkpass-studio/')).toBe(
      'blob:https://example.com/123'
    )
  })
})
