import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TEMPLATES, getTemplateById } from './registry'
import { resolveTemplateAssetUrl, validateTemplateConfig } from './schema'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../../public')

describe('template registry (auto-discovered from public/templates/)', () => {
  it('registers unique, schema-valid template configs', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(2)

    const seenIds = new Set<string>()
    for (const template of TEMPLATES) {
      expect(seenIds.has(template.id), `Duplicate template id: ${template.id}`).toBe(false)
      seenIds.add(template.id)

      const result = validateTemplateConfig(template)
      expect(result.errors, `Template "${template.id}" validation errors`).toEqual([])
      expect(result.valid).toBe(true)
      expect(getTemplateById(template.id)).toBe(template)
    }
  })

  it('resolves relative & absolute artwork paths to existing public files and validates barcode links', () => {
    expect(resolveTemplateAssetUrl('my-card', './front.png')).toBe('/templates/my-card/front.png')
    expect(resolveTemplateAssetUrl('my-card', 'fonts/a.otf')).toBe('/templates/my-card/fonts/a.otf')
    expect(resolveTemplateAssetUrl('my-card', '/templates/other/x.png')).toBe('/templates/other/x.png')

    for (const template of TEMPLATES) {
      const allFieldIds = new Set(template.sides.flatMap((side) => side.fields.map((f) => f.id)))

      const thumbUrl = resolveTemplateAssetUrl(template.id, template.thumbnail)
      if (thumbUrl.startsWith('/')) {
        const thumbPath = path.join(publicDir, thumbUrl.slice(1))
        expect(existsSync(thumbPath), `Missing thumbnail: ${thumbUrl}`).toBe(true)
      }

      for (const side of template.sides) {
        const bgUrl = resolveTemplateAssetUrl(template.id, side.background)
        if (bgUrl.startsWith('/')) {
          const bgPath = path.join(publicDir, bgUrl.slice(1))
          expect(existsSync(bgPath), `Missing background: ${bgUrl}`).toBe(true)
        }
        const overlayUrl = resolveTemplateAssetUrl(template.id, side.overlay)
        if (overlayUrl.startsWith('/')) {
          const overlayPath = path.join(publicDir, overlayUrl.slice(1))
          expect(existsSync(overlayPath), `Missing overlay: ${overlayUrl}`).toBe(true)
        }

        for (const field of side.fields) {
          if (field.type === 'barcode' && field.sourceFieldId) {
            expect(
              allFieldIds.has(field.sourceFieldId),
              `Barcode "${field.id}" references missing sourceFieldId "${field.sourceFieldId}"`
            ).toBe(true)
          }
        }
      }
    }
  })
})
