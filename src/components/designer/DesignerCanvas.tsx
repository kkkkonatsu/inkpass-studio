import * as React from 'react'
import { renderSideToCanvas } from '@/engine/canvas-renderer'
import type { BundledCardFont } from '@/fonts'
import {
  collectTemplateValues,
  type DocumentTemplateConfig,
  type TemplateField,
  type TemplateSide,
} from '@/templates/schema'
import { clampFieldRect, computeSmartSnap, nudgeField, type SnapGuide } from './designer-helpers'

interface DesignerCanvasProps {
  template: DocumentTemplateConfig
  side: TemplateSide
  selectedFieldId: string | null
  onSelectField: (fieldId: string | null) => void
  onUpdateField: (fieldId: string, patch: Partial<TemplateField>) => void
  onDuplicateFieldAtOrigin?: (fieldId: string) => TemplateField | null
  assetOverrides: Record<string, string>
  extraFonts?: readonly BundledCardFont[]
  fontFamilyOverride?: string
  showBoxes: boolean
}

interface DragState {
  mode: 'move' | 'resize'
  fieldId: string
  startClientX: number
  startClientY: number
  originRect: { x: number; y: number; width: number; height: number }
}

/**
 * Interactive visual canvas for calibrating field coordinates (x, y, width, height).
 * Reuses the exact same Canvas 2D engine as the Card Editor so preview matches exports 1:1.
 */
export function DesignerCanvas({
  template,
  side,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  onDuplicateFieldAtOrigin,
  assetOverrides,
  extraFonts,
  fontFamilyOverride,
  showBoxes,
}: DesignerCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const [drag, setDrag] = React.useState<DragState | null>(null)
  const [snapGuides, setSnapGuides] = React.useState<SnapGuide[]>([])

  const sampleValues = React.useMemo(() => collectTemplateValues(template, 'sample'), [template])

  // Render live sample preview onto the canvas
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let cancelled = false
    const rafId = window.requestAnimationFrame(() => {
      renderSideToCanvas(template, side, sampleValues, {
        mode: 'filled',
        scale: 1,
        fontFamilyOverride,
        extraFonts,
        assetOverrides,
        showTrimGuide: showBoxes,
        showDebugBoxes: false,
        targetCanvas: canvas,
      }).catch((err) => {
        if (!cancelled) console.error('[DesignerCanvas] Render failed:', err)
      })
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
    }
  }, [template, side, sampleValues, fontFamilyOverride, extraFonts, assetOverrides, showBoxes])

  // Pointer drag / resize listeners (supports Shift axis/aspect lock, Alt center-resize, & Smart Snap)
  React.useEffect(() => {
    if (!drag) return

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const scaleX = template.canvasSize.width / rect.width
      const scaleY = template.canvasSize.height / rect.height
      let dx = (e.clientX - drag.startClientX) * scaleX
      let dy = (e.clientY - drag.startClientY) * scaleY

      if (drag.mode === 'move') {
        if (e.shiftKey) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            dy = 0
          } else {
            dx = 0
          }
        }

        const rawRect = clampFieldRect(
          {
            x: drag.originRect.x + dx,
            y: drag.originRect.y + dy,
            width: drag.originRect.width,
            height: drag.originRect.height,
          },
          template.canvasSize
        )

        // Hold Cmd/Ctrl while dragging to bypass smart alignment snapping
        if (e.metaKey || e.ctrlKey) {
          setSnapGuides([])
          onUpdateField(drag.fieldId, rawRect)
        } else {
          const otherFields = side.fields.filter((f) => f.id !== drag.fieldId)
          const snapped = computeSmartSnap(rawRect, otherFields, template.canvasSize)
          setSnapGuides(snapped.guides)
          onUpdateField(drag.fieldId, {
            ...rawRect,
            x: snapped.x,
            y: snapped.y,
          })
        }
        return
      }

      // Resize mode: Shift locks aspect ratio, Alt resizes symmetrically from center
      const origin = drag.originRect
      const aspect = origin.width / Math.max(1, origin.height)
      let nextWidth = e.altKey ? origin.width + dx * 2 : origin.width + dx
      let nextHeight = e.altKey ? origin.height + dy * 2 : origin.height + dy

      if (e.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          nextHeight = nextWidth / aspect
        } else {
          nextWidth = nextHeight * aspect
        }
      }

      const nextX = e.altKey ? origin.x + (origin.width - nextWidth) / 2 : origin.x
      const nextY = e.altKey ? origin.y + (origin.height - nextHeight) / 2 : origin.y

      const nextRect = clampFieldRect(
        { x: nextX, y: nextY, width: nextWidth, height: nextHeight },
        template.canvasSize
      )

      setSnapGuides([])
      onUpdateField(drag.fieldId, nextRect)
    }

    const handlePointerUp = () => {
      setDrag(null)
      setSnapGuides([])
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [drag, side.fields, template.canvasSize, onUpdateField])

  // Arrow-key 1px (or Shift+10px) fine nudging when a field is selected
  React.useEffect(() => {
    if (!selectedFieldId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }

      const step = e.shiftKey ? 10 : 1
      let dx = 0
      let dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      else if (e.key === 'ArrowRight') dx = step
      else if (e.key === 'ArrowUp') dy = -step
      else if (e.key === 'ArrowDown') dy = step
      else return

      const field = side.fields.find((f) => f.id === selectedFieldId)
      if (!field) return

      e.preventDefault()
      const nudged = nudgeField(field, dx, dy, template.canvasSize)
      onUpdateField(selectedFieldId, { x: nudged.x, y: nudged.y })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFieldId, side.fields, template.canvasSize, onUpdateField])

  const startDrag = (
    e: React.PointerEvent,
    field: TemplateField,
    mode: 'move' | 'resize'
  ) => {
    e.stopPropagation()
    e.preventDefault()

    // Option/Alt + Drag peels off an instant duplicate right where the original sits
    if (mode === 'move' && e.altKey && onDuplicateFieldAtOrigin) {
      const copy = onDuplicateFieldAtOrigin(field.id)
      if (copy) {
        onSelectField(copy.id)
        setDrag({
          mode: 'move',
          fieldId: copy.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          originRect: { x: copy.x, y: copy.y, width: copy.width, height: copy.height },
        })
        return
      }
    }

    onSelectField(field.id)
    setDrag({
      mode,
      fieldId: field.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originRect: { x: field.x, y: field.y, width: field.width, height: field.height },
    })
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={() => onSelectField(null)}
      className="relative select-none overflow-hidden rounded-xl border-4 border-chaos-black bg-white shadow-[6px_6px_0px_#0d0d0d]"
    >
      <canvas
        ref={canvasRef}
        width={template.canvasSize.width}
        height={template.canvasSize.height}
        className="block h-auto w-full"
      />

      {showBoxes && (
        <div className="pointer-events-none absolute inset-0">
          {/* Smart alignment snap guide lines */}
          {snapGuides.map((guide, index) =>
            guide.axis === 'x' ? (
              <div
                key={`x-${guide.position}-${index}`}
                style={{ left: `${(guide.position / template.canvasSize.width) * 100}%` }}
                className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-[#ff2e97] shadow-[0_0_2px_rgba(255,46,151,0.75)]"
              />
            ) : (
              <div
                key={`y-${guide.position}-${index}`}
                style={{ top: `${(guide.position / template.canvasSize.height) * 100}%` }}
                className="pointer-events-none absolute right-0 left-0 z-30 h-px bg-[#ff2e97] shadow-[0_0_2px_rgba(255,46,151,0.75)]"
              />
            )
          )}

          {side.fields.map((field) => {
            const isSelected = field.id === selectedFieldId
            const left = `${(field.x / template.canvasSize.width) * 100}%`
            const top = `${(field.y / template.canvasSize.height) * 100}%`
            const width = `${(field.width / template.canvasSize.width) * 100}%`
            const height = `${(field.height / template.canvasSize.height) * 100}%`

            return (
              <div
                key={field.id}
                onPointerDown={(e) => startDrag(e, field, 'move')}
                style={{
                  left,
                  top,
                  width,
                  height,
                  transform: field.rotation ? `rotate(${field.rotation}deg)` : undefined,
                }}
                className={`pointer-events-auto absolute cursor-move border-2 transition-colors ${
                  isSelected
                    ? 'z-20 border-blue bg-blue/15 shadow-[0_0_0_2px_rgba(234,255,61,0.9)]'
                    : 'z-10 border-dashed border-red/85 bg-red/10 hover:border-blue hover:bg-blue/10'
                }`}
              >
                <span
                  className={`pointer-events-none absolute -top-5 left-0 rounded px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold whitespace-nowrap text-white ${
                    isSelected ? 'bg-blue' : 'bg-red/90'
                  }`}
                >
                  {field.id}
                </span>

                {/* Bottom-right resize handle */}
                <button
                  type="button"
                  aria-label={`Resize ${field.id}`}
                  onPointerDown={(e) => startDrag(e, field, 'resize')}
                  className={`absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-xs border-2 border-chaos-black ${
                    isSelected ? 'bg-yellow' : 'bg-white'
                  }`}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
