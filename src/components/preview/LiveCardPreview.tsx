import * as React from 'react'
import { renderSideToCanvas } from '@/engine/canvas-renderer'
import type { BundledCardFont } from '@/fonts'
import type {
  CardFieldValues,
  DocumentTemplateConfig,
  TemplateSide,
} from '@/templates/schema'

interface LiveCardPreviewProps {
  template: DocumentTemplateConfig
  side: TemplateSide
  values: CardFieldValues
  mode: 'filled' | 'blank'
  exportBleedMm?: number
  showTrimGuide?: boolean
  fontFamilyOverride?: string
  assetOverrides?: Record<string, string>
  extraFonts?: readonly BundledCardFont[]
  showDebugBoxes?: boolean
}

/**
 * Renders the active template side in real time using the shared Canvas 2D engine.
 * Preview can optionally display the dashed trim guide when bleed is active (never baked into exports).
 */
export function LiveCardPreview({
  template,
  side,
  values,
  mode,
  exportBleedMm,
  showTrimGuide = false,
  fontFamilyOverride,
  assetOverrides,
  extraFonts,
  showDebugBoxes = false,
}: LiveCardPreviewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    const frameId = window.requestAnimationFrame(() => {
      renderSideToCanvas(template, side, values, {
        mode,
        scale: 1,
        exportBleedMm,
        showTrimGuide,
        fontFamilyOverride,
        assetOverrides,
        extraFonts,
        showDebugBoxes,
        targetCanvas: canvas,
      }).catch((err) => {
        if (!cancelled) {
          console.error('[LiveCardPreview] Render failed:', err)
        }
      })
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frameId)
    }
  }, [
    template,
    side,
    values,
    mode,
    exportBleedMm,
    showTrimGuide,
    fontFamilyOverride,
    assetOverrides,
    extraFonts,
    showDebugBoxes,
  ])

  return (
    <div className="overflow-hidden rounded-xl border-4 border-chaos-black bg-white shadow-[6px_6px_0px_#0d0d0d]">
      <canvas
        ref={canvasRef}
        width={template.canvasSize.width}
        height={template.canvasSize.height}
        className="block h-auto w-full"
      />
    </div>
  )
}
