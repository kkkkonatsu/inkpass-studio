import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import type { DocumentTemplateConfig } from '@/templates/schema'
import { exportTemplateZipBytes, importTemplateZip } from './template-zip'

const sampleTemplate: DocumentTemplateConfig = {
  id: 'custom-pass',
  category: 'id-card',
  organization: { en: 'Deep Cut Fan Club', ja: 'すりみ連合ファンクラブ' },
  name: { en: 'Member Pass', ja: '会員証' },
  description: { en: 'Custom fan pass' },
  thumbnail: './front.png',
  canvasSize: { width: 1011, height: 638 },
  physicalSizeMm: { width: 85.6, height: 53.98 },
  bleedMm: 3,
  fonts: [],
  defaultFontId: 'my-fan-font',
  defaultFontFamily: 'sans-serif',
  sides: [
    {
      id: 'front',
      label: { en: 'Front', ja: '表面' },
      background: './front.png',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: { en: 'Name', ja: '氏名' },
          x: 100,
          y: 120,
          width: 300,
          height: 50,
          fontSize: 32,
          color: '#0d0d0d',
          sampleValue: 'フウカ',
        },
      ],
    },
  ],
}

describe('Template ZIP packager & loader', () => {
  it('exports a self-contained zip matching public/templates/ layout and imports it back cleanly', async () => {
    const fakePng = new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' })
    const fakeFont = new Blob([Uint8Array.from([79, 84, 84, 79])], { type: 'font/otf' })

    const zipBytes = await exportTemplateZipBytes(sampleTemplate, {
      localImages: { './front.png': fakePng },
      localFonts: [
        {
          fileName: 'MyFanFont.otf',
          file: fakeFont,
          font: {
            id: 'my-fan-font',
            label: 'My Fan Font',
            family: 'MyFanFont',
            url: '/templates/_fonts/MyFanFont.otf',
          },
        },
      ],
      docs: {
        credits: 'Template Author: Deep Cut Fan',
        license: 'CC BY-NC-SA 4.0',
      },
    })

    // Inspect exact zip paths
    const rawZip = await JSZip.loadAsync(zipBytes)
    expect(rawZip.file('custom-pass/config.json')).not.toBeNull()
    expect(rawZip.file('custom-pass/front.png')).not.toBeNull()
    expect(rawZip.file('custom-pass/CREDITS.txt')).not.toBeNull()
    expect(rawZip.file('custom-pass/LICENSE.txt')).not.toBeNull()
    expect(rawZip.file('_fonts/MyFanFont.otf')).not.toBeNull()
    expect(rawZip.file('_fonts/fonts.json')).not.toBeNull()

    // Round-trip import
    const loaded = await importTemplateZip(zipBytes)
    expect(loaded.config.id).toBe('custom-pass')
    expect(loaded.config.bleedMm).toBe(3)
    expect(loaded.sourceFiles.images['./front.png']).toBeDefined()
    expect(loaded.docs?.credits?.trim()).toBe('Template Author: Deep Cut Fan')
    expect(loaded.docs?.license?.trim()).toBe('CC BY-NC-SA 4.0')
    expect(loaded.extraFonts).toHaveLength(1)
    expect(loaded.extraFonts[0]).toMatchObject({
      id: 'my-fan-font',
      label: 'My Fan Font',
      family: 'MyFanFont',
    })
  })

  it('supports flat root config.json, _font/ alias, and ignores macOS __MACOSX entries', async () => {
    const zip = new JSZip()
    zip.file('__MACOSX/._config.json', 'junk')
    zip.file('config.json', JSON.stringify(sampleTemplate))
    zip.file('front.png', Uint8Array.from([137, 80, 78, 71]))
    zip.file('_font/CustomAlt.otf', Uint8Array.from([79, 84, 84, 79]))

    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const loaded = await importTemplateZip(bytes)

    expect(loaded.config.id).toBe('custom-pass')
    expect(loaded.sourceFiles.images['./front.png']).toBeDefined()
    expect(loaded.extraFonts[0].id).toBe('customalt')
  })

  it('rejects zips missing a valid config.json', async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'hello')
    const bytes = await zip.generateAsync({ type: 'uint8array' })

    await expect(importTemplateZip(bytes)).rejects.toThrow(/config\.json/)
  })
})
