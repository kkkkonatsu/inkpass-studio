import * as React from 'react'
import { createPortal } from 'react-dom'

interface HoverTooltipProps {
  text: string
  align?: 'center' | 'right' | 'left'
  children: React.ReactNode
}

interface TooltipPosition {
  top: number
  left: number
  arrowLeft: number
}

const TOOLTIP_WIDTH = 256
const VIEWPORT_PADDING = 12

export function HoverTooltip({ text, align = 'center', children }: HoverTooltipProps) {
  const tooltipId = React.useId()
  const triggerRef = React.useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<TooltipPosition | null>(null)

  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const triggerCenterX = rect.left + rect.width / 2

    let rawLeft: number
    if (align === 'right') {
      rawLeft = rect.right - TOOLTIP_WIDTH
    } else if (align === 'left') {
      rawLeft = rect.left
    } else {
      rawLeft = triggerCenterX - TOOLTIP_WIDTH / 2
    }

    const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING)
    const clampedLeft = Math.min(maxLeft, Math.max(VIEWPORT_PADDING, rawLeft))
    const arrowLeft = Math.min(TOOLTIP_WIDTH - 20, Math.max(20, triggerCenterX - clampedLeft))

    setPos({
      top: rect.bottom + 10,
      left: clampedLeft,
      arrowLeft,
    })
  }, [align])

  React.useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  const handleOpen = () => {
    updatePosition()
    setOpen(true)
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={handleOpen}
      onMouseLeave={() => setOpen(false)}
      onFocus={handleOpen}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
    >
      {children}

      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{ top: pos.top, left: pos.left, width: TOOLTIP_WIDTH }}
            className="pointer-events-none fixed z-[9999] rounded-lg border-2 border-yellow bg-chaos-black px-3 py-2 text-center text-[11px] leading-snug font-semibold text-white shadow-[3px_3px_0px_#eaff3d]"
          >
            <span
              aria-hidden="true"
              style={{ left: pos.arrowLeft }}
              className="absolute -top-[7px] h-3 w-3 -translate-x-1/2 rotate-45 border-t-2 border-l-2 border-yellow bg-chaos-black"
            />
            <span className="relative z-10">{text}</span>
          </div>,
          document.body
        )}
    </div>
  )
}
