import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createCardPdfBytes, mmToPt } from './exporter'

// Valid 1x1 transparent PNG
const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  )
)

describe('PDF exporter (pdf-lib)', () => {
  it('creates an exact physical mm multi-page PDF in "card" layout', async () => {
    const pdfBytes = await createCardPdfBytes(
      [ONE_PIXEL_PNG, ONE_PIXEL_PNG],
      { width: 85.6, height: 53.98 },
      { layout: 'card' }
    )

    const loaded = await PDFDocument.load(pdfBytes)
    expect(loaded.getPageCount()).toBe(2)

    const firstPage = loaded.getPage(0).getSize()
    expect(firstPage.width).toBeCloseTo(mmToPt(85.6), 2)
    expect(firstPage.height).toBeCloseTo(mmToPt(53.98), 2)
  })

  it('expands "card" PDF page size accurately when exportBleedMm is set', async () => {
    const pdfBytes = await createCardPdfBytes(
      [ONE_PIXEL_PNG],
      { width: 85.6, height: 53.98 },
      { layout: 'card', exportBleedMm: 3 }
    )

    const loaded = await PDFDocument.load(pdfBytes)
    const size = loaded.getPage(0).getSize()
    expect(size.width).toBeCloseTo(mmToPt(91.6), 2)
    expect(size.height).toBeCloseTo(mmToPt(59.98), 2)
  })

  it('creates a single printable A4 sheet PDF in "a4-sheet" layout (with bleed support)', async () => {
    const pdfBytes = await createCardPdfBytes(
      [ONE_PIXEL_PNG, ONE_PIXEL_PNG],
      { width: 85.6, height: 53.98 },
      { layout: 'a4-sheet', cropMarks: true, exportBleedMm: 2 }
    )

    const loaded = await PDFDocument.load(pdfBytes)
    expect(loaded.getPageCount()).toBe(1)

    const a4 = loaded.getPage(0).getSize()
    expect(a4.width).toBeCloseTo(mmToPt(210), 2)
    expect(a4.height).toBeCloseTo(mmToPt(297), 2)
  })
})
