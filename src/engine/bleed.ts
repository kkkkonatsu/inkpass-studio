export interface BleedGeometry {
  templateBleedMm: number
  exportBleedMm: number
  /** Millimeters trimmed off each of the 4 edges relative to the full template artwork */
  trimMm: number
  /** Source pixel crop rectangle inside `template.canvasSize` */
  cropX: number
  cropY: number
  sourceWidth: number
  sourceHeight: number
  /** Final physical export size in millimeters (`physicalSizeMm + 2 * exportBleedMm`) */
  exportSizeMm: {
    width: number
    height: number
  }
  /** Finished trim box inside `template.canvasSize` (useful for Designer trim guides) */
  trimBoxPx: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Computes exact pixel cropping and physical millimeter output dimensions when a template
 * includes print bleed (`templateBleedMm`) and the user exports with `exportBleedMm`
 * (clamped between `0` and `templateBleedMm`).
 */
export function computeBleedGeometry(
  canvasSize: { width: number; height: number },
  physicalSizeMm: { width: number; height: number },
  templateBleedMm = 0,
  requestedExportBleedMm?: number
): BleedGeometry {
  const safeTemplateBleed = Math.max(0, Number.isFinite(templateBleedMm) ? templateBleedMm : 0)
  const rawRequested =
    requestedExportBleedMm === undefined || !Number.isFinite(requestedExportBleedMm)
      ? safeTemplateBleed
      : requestedExportBleedMm
  const exportBleedMm = Math.max(0, Math.min(safeTemplateBleed, rawRequested))

  const fullWidthMm = physicalSizeMm.width + safeTemplateBleed * 2
  const fullHeightMm = physicalSizeMm.height + safeTemplateBleed * 2
  const pxPerMmX = canvasSize.width / fullWidthMm
  const pxPerMmY = canvasSize.height / fullHeightMm

  const trimMm = safeTemplateBleed - exportBleedMm
  const cropX = trimMm * pxPerMmX
  const cropY = trimMm * pxPerMmY
  const sourceWidth = Math.max(1, canvasSize.width - cropX * 2)
  const sourceHeight = Math.max(1, canvasSize.height - cropY * 2)

  const fullTrimX = safeTemplateBleed * pxPerMmX
  const fullTrimY = safeTemplateBleed * pxPerMmY

  return {
    templateBleedMm: safeTemplateBleed,
    exportBleedMm,
    trimMm,
    cropX,
    cropY,
    sourceWidth,
    sourceHeight,
    exportSizeMm: {
      width: Number((physicalSizeMm.width + exportBleedMm * 2).toFixed(4)),
      height: Number((physicalSizeMm.height + exportBleedMm * 2).toFixed(4)),
    },
    trimBoxPx: {
      x: fullTrimX,
      y: fullTrimY,
      width: Math.max(1, canvasSize.width - fullTrimX * 2),
      height: Math.max(1, canvasSize.height - fullTrimY * 2),
    },
  }
}
