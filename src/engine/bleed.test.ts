import { describe, expect, it } from 'vitest'
import { computeBleedGeometry } from './bleed'

describe('bleed geometry calculations', () => {
  // CR80 (85.6 x 53.98 mm) with 3mm bleed on every side -> 91.6 x 59.98 mm at 10 px/mm
  const physical = { width: 85.6, height: 53.98 }
  const canvas = { width: 916, height: 599.8 }

  it('keeps full canvas when exporting full template bleed (3mm)', () => {
    const g = computeBleedGeometry(canvas, physical, 3, 3)
    expect(g.exportBleedMm).toBe(3)
    expect(g.cropX).toBeCloseTo(0, 4)
    expect(g.cropY).toBeCloseTo(0, 4)
    expect(g.sourceWidth).toBeCloseTo(916, 4)
    expect(g.sourceHeight).toBeCloseTo(599.8, 4)
    expect(g.exportSizeMm).toEqual({ width: 91.6, height: 59.98 })
  })

  it('trims cleanly to exact finished card size when exportBleedMm is 0', () => {
    const g = computeBleedGeometry(canvas, physical, 3, 0)
    expect(g.exportBleedMm).toBe(0)
    expect(g.cropX).toBeCloseTo(30, 4)
    expect(g.cropY).toBeCloseTo(30, 4)
    expect(g.sourceWidth).toBeCloseTo(856, 4)
    expect(g.sourceHeight).toBeCloseTo(539.8, 4)
    expect(g.exportSizeMm).toEqual({ width: 85.6, height: 53.98 })
  })

  it('supports partial bleed (1.5mm) and clamps out-of-range values to [0, templateBleedMm]', () => {
    const partial = computeBleedGeometry(canvas, physical, 3, 1.5)
    expect(partial.cropX).toBeCloseTo(15, 4)
    expect(partial.sourceWidth).toBeCloseTo(886, 4)
    expect(partial.exportSizeMm).toEqual({ width: 88.6, height: 56.98 })

    expect(computeBleedGeometry(canvas, physical, 3, 10).exportBleedMm).toBe(3)
    expect(computeBleedGeometry(canvas, physical, 3, -2).exportBleedMm).toBe(0)
    expect(computeBleedGeometry(canvas, physical, 0, 2).exportBleedMm).toBe(0)
  })
})
