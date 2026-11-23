import { describe, expect, it } from 'vitest'
import { validateTemplateConfig, type FieldType, type TemplateField } from '@/templates/schema'
import {
  buildStandardImagePath,
  clampFieldRect,
  computeSmartSnap,
  createBlankTemplate,
  createDefaultField,
  deduplicateTemplateFieldIds,
  duplicateTemplateField,
  formatRelativeTimeAgo,
  nudgeField,
  resolveUniqueFieldId,
  scaleTemplateFieldsToCanvas,
  serializeTemplateConfig,
} from './designer-helpers'

describe('Template Designer helpers', () => {
  it('creates a valid blank template config', () => {
    const blank = createBlankTemplate()
    expect(validateTemplateConfig(blank)).toEqual({ valid: true, errors: [] })
  })

  it('creates valid unique fields for all 6 field types', () => {
    const blank = createBlankTemplate()
    const types: FieldType[] = [
      'text',
      'date',
      'select-or-custom',
      'splashtag-title',
      'photo',
      'barcode',
    ]

    const fields: TemplateField[] = []
    for (const type of types) {
      fields.push(createDefaultField(type, fields, blank.canvasSize))
    }
    // Adding a second text field gets text_2
    const secondText = createDefaultField('text', fields, blank.canvasSize)
    expect(secondText.id).toBe('text_2')
    fields.push(secondText)

    const updated = {
      ...blank,
      sides: [{ ...blank.sides[0], fields }],
    }
    expect(validateTemplateConfig(updated)).toEqual({ valid: true, errors: [] })

    // Round-trip serialize -> parse
    const parsed = JSON.parse(serializeTemplateConfig(updated))
    expect(validateTemplateConfig(parsed)).toEqual({ valid: true, errors: [] })
  })

  it('clamps and nudges field rectangles inside canvas bounds', () => {
    const canvasSize = { width: 1000, height: 600 }
    expect(clampFieldRect({ x: -25, y: 580, width: 100, height: 50 }, canvasSize)).toEqual({
      x: 0,
      y: 550,
      width: 100,
      height: 50,
    })

    const field = createDefaultField('text', [], canvasSize)
    const nudged = nudgeField(field, 10, -5, canvasSize)
    expect(nudged.x).toBe(field.x + 10)
    expect(nudged.y).toBe(field.y - 5)
  })

  it('proportionally scales field boxes, font sizes, and photo radii for a new canvas size', () => {
    const sides = [
      {
        id: 'front',
        label: { en: 'Front' },
        fields: [
          {
            id: 'name',
            type: 'text' as const,
            label: { en: 'Name' },
            x: 100,
            y: 50,
            width: 300,
            height: 40,
            fontSize: 28,
            minFontSize: 14,
            letterSpacing: 1.5,
            color: '#0d0d0d',
          },
          {
            id: 'photo',
            type: 'photo' as const,
            label: { en: 'Photo' },
            x: 20,
            y: 30,
            width: 120,
            height: 150,
            borderRadius: 8,
          },
        ],
      },
    ]

    const scaled = scaleTemplateFieldsToCanvas(
      sides,
      { width: 1000, height: 600 },
      { width: 2000, height: 1200 }
    )

    expect(scaled[0].fields[0]).toMatchObject({
      x: 200,
      y: 100,
      width: 600,
      height: 80,
      fontSize: 56,
      minFontSize: 28,
      letterSpacing: 3,
    })
    expect(scaled[0].fields[1]).toMatchObject({
      x: 40,
      y: 60,
      width: 240,
      height: 300,
      borderRadius: 16,
    })
  })

  it('duplicates a field with a unique sequential ID, deep-cloned label, and offset rect', () => {
    const canvasSize = { width: 1000, height: 600 }
    const original = {
      ...createDefaultField('text', [], canvasSize),
      id: 'student_name',
      x: 100,
      y: 120,
      fontSize: 32,
    }

    const firstCopy = duplicateTemplateField(original, [original], canvasSize)
    expect(firstCopy.id).toBe('student_name_2')
    expect(firstCopy.x).toBe(116)
    expect(firstCopy.y).toBe(136)
    expect(firstCopy.type === 'text' && firstCopy.fontSize).toBe(32)
    expect(firstCopy.label).not.toBe(original.label)

    const secondCopy = duplicateTemplateField(firstCopy, [original, firstCopy], canvasSize)
    expect(secondCopy.id).toBe('student_name_3')
  })

  it('snaps dragged fields to canvas center and sibling field edges with guide coordinates', () => {
    const canvasSize = { width: 1000, height: 600 }
    const anchor = {
      ...createDefaultField('text', [], canvasSize),
      id: 'anchor',
      x: 120,
      y: 200,
      width: 200,
      height: 40,
    }

    // Near sibling left edge (x: 123 vs 120) and canvas vertical center (y+h/2: 302 vs 300)
    const snapped = computeSmartSnap({ x: 123, y: 282, width: 100, height: 40 }, [anchor], canvasSize)
    expect(snapped.x).toBe(120)
    expect(snapped.y).toBe(280)
    expect(snapped.guides).toEqual([
      { axis: 'x', position: 120 },
      { axis: 'y', position: 300 },
    ])
  })

  it('auto-suffixes colliding field IDs and deduplicates existing templates across sides', () => {
    expect(resolveUniqueFieldId('name', new Set(['other']))).toBe('name')
    expect(resolveUniqueFieldId('name', new Set(['name']))).toBe('name_2')
    expect(resolveUniqueFieldId('name', new Set(['name', 'name_2']))).toBe('name_3')
    expect(resolveUniqueFieldId('name_2', new Set(['name', 'name_2']))).toBe('name_3')

    const blank = createBlankTemplate()
    const f1 = { ...createDefaultField('text', [], blank.canvasSize), id: 'title' }
    const f2 = { ...createDefaultField('text', [], blank.canvasSize), id: 'title' }
    const f3 = { ...createDefaultField('text', [], blank.canvasSize), id: 'title' }
    const broken = {
      ...blank,
      sides: [
        { ...blank.sides[0], fields: [f1, f2] },
        { id: 'back', label: { en: 'Back' }, fields: [f3] },
      ],
    }

    const fixed = deduplicateTemplateFieldIds(broken)
    expect(fixed.sides[0].fields.map((f) => f.id)).toEqual(['title', 'title_2'])
    expect(fixed.sides[1].fields.map((f) => f.id)).toEqual(['title_3'])
    expect(validateTemplateConfig(fixed)).toEqual({ valid: true, errors: [] })
  })

  it('formats relative draft auto-save timestamps across seconds, minutes, hours, and days', () => {
    const base = 1_700_000_000_000
    expect(formatRelativeTimeAgo(base, base + 2_000, 'en')).toBeNull()
    expect(formatRelativeTimeAgo(base, base + 12_000, 'en')).toBe('12 seconds ago')
    expect(formatRelativeTimeAgo(base, base + 5 * 60_000, 'en')).toBe('5 minutes ago')
    expect(formatRelativeTimeAgo(base, base + 2 * 3600_000, 'en')).toBe('2 hours ago')
    expect(formatRelativeTimeAgo(base, base + 2 * 86400_000, 'en')).toBe('2 days ago')
  })

  it('standardizes uploaded image filenames by asset kind and side ID', () => {
    expect(buildStandardImagePath('background', 'front', 'Screenshot 2026.PNG')).toBe('./front.png')
    expect(buildStandardImagePath('background', 'back', 'card-back.jpeg')).toBe('./back.jpg')
    expect(buildStandardImagePath('overlay', 'front', 'seal.webp')).toBe('./front-overlay.webp')
    expect(buildStandardImagePath('thumbnail', 'front', 'preview-v2.png')).toBe('./thumb.png')
    expect(buildStandardImagePath('thumbnail', 'front', 'no-ext', 'image/jpeg')).toBe('./thumb.jpg')
  })
})
