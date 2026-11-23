import { PDFDocument, rgb } from 'pdf-lib'

export type PdfLayoutMode = 'card' | 'a4-sheet'

export interface PhysicalSizeMm {
  width: number
  height: number
}

export interface PdfExportOptions {
  /** 'card' = exact card mm (+ bleed) per page; 'a4-sheet' = print-ready A4 sheet with crop marks */
  layout?: PdfLayoutMode
  /** Draw light corner crop marks aligned to the finished trim line on 'a4-sheet' layout (default: true) */
  cropMarks?: boolean
  /** Bleed included on each side of the rendered PNGs, in millimeters (default: 0) */
  exportBleedMm?: number
}

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

/** Converts millimeters to PDF points (1 inch = 25.4 mm = 72 pt). */
export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode canvas as PNG.'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await canvasToPngBlob(canvas)
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Draws corner crop marks aligned to the finished trim rectangle `(trimX, trimY, trimWidth, trimHeight)`,
 * offset outward past `bleedPt` so marks never overlap the printed artwork or bleed area.
 */
function drawCropMarks(
  page: ReturnType<PDFDocument['addPage']>,
  trimX: number,
  trimY: number,
  trimWidth: number,
  trimHeight: number,
  bleedPt = 0
): void {
  const markLen = mmToPt(4)
  const gap = bleedPt + mmToPt(1.5)
  const color = rgb(0.45, 0.45, 0.45)
  const thickness = 0.5

  const corners = [
    // bottom-left
    [
      [trimX - gap - markLen, trimY, trimX - gap, trimY],
      [trimX, trimY - gap - markLen, trimX, trimY - gap],
    ],
    // bottom-right
    [
      [trimX + trimWidth + gap, trimY, trimX + trimWidth + gap + markLen, trimY],
      [trimX + trimWidth, trimY - gap - markLen, trimX + trimWidth, trimY - gap],
    ],
    // top-left
    [
      [trimX - gap - markLen, trimY + trimHeight, trimX - gap, trimY + trimHeight],
      [trimX, trimY + trimHeight + gap, trimX, trimY + trimHeight + gap + markLen],
    ],
    // top-right
    [
      [
        trimX + trimWidth + gap,
        trimY + trimHeight,
        trimX + trimWidth + gap + markLen,
        trimY + trimHeight,
      ],
      [trimX + trimWidth, trimY + trimHeight + gap, trimX + trimWidth, trimY + trimHeight + gap + markLen],
    ],
  ]

  for (const pair of corners) {
    for (const [x1, y1, x2, y2] of pair) {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness,
        color,
      })
    }
  }
}

/**
 * Packages one or more high-resolution PNG byte buffers (e.g. front & back sides)
 * into a print-ready PDF using `pdf-lib`.
 */
export async function createCardPdfBytes(
  sidePngBuffers: readonly Uint8Array[],
  physicalSizeMm: PhysicalSizeMm,
  options: PdfExportOptions = {}
): Promise<Uint8Array> {
  if (sidePngBuffers.length === 0) {
    throw new Error('At least one rendered side is required to generate a PDF.')
  }

  const layout = options.layout ?? 'card'
  const showCropMarks = options.cropMarks ?? true
  const bleedMm = Math.max(0, options.exportBleedMm ?? 0)

  const trimWidthPt = mmToPt(physicalSizeMm.width)
  const trimHeightPt = mmToPt(physicalSizeMm.height)
  const bleedPt = mmToPt(bleedMm)
  const imageWidthPt = trimWidthPt + bleedPt * 2
  const imageHeightPt = trimHeightPt + bleedPt * 2

  const pdfDoc = await PDFDocument.create()
  const embeddedImages = await Promise.all(sidePngBuffers.map((bytes) => pdfDoc.embedPng(bytes)))

  if (layout === 'card') {
    for (const image of embeddedImages) {
      const page = pdfDoc.addPage([imageWidthPt, imageHeightPt])
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: imageWidthPt,
        height: imageHeightPt,
      })
    }
  } else {
    // A4 print sheet: stack all sides vertically centered with spacing & trim-aligned crop marks
    const pageWidthPt = mmToPt(A4_WIDTH_MM)
    const pageHeightPt = mmToPt(A4_HEIGHT_MM)
    const gapPt = mmToPt(14) + bleedPt * 2
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt])

    const totalStackHeight =
      embeddedImages.length * imageHeightPt + Math.max(0, embeddedImages.length - 1) * gapPt
    const startTopY = (pageHeightPt + totalStackHeight) / 2
    const imageX = (pageWidthPt - imageWidthPt) / 2

    embeddedImages.forEach((image, index) => {
      const imageY = startTopY - (index + 1) * imageHeightPt - index * gapPt
      page.drawImage(image, {
        x: imageX,
        y: imageY,
        width: imageWidthPt,
        height: imageHeightPt,
      })
      if (showCropMarks) {
        drawCropMarks(
          page,
          imageX + bleedPt,
          imageY + bleedPt,
          trimWidthPt,
          trimHeightPt,
          bleedPt
        )
      }
    })
  }

  return pdfDoc.save()
}

/** Triggers a browser file download for any Blob (PNG, PDF, JSON). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
