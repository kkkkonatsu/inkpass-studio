import JsBarcode from 'jsbarcode'

export interface BarcodeRenderOptions {
  format?: 'CODE128' | 'CODE39' | 'EAN13'
  width: number
  height: number
  lineColor?: string
  backgroundColor?: string
  displayValue?: boolean
  fontSize?: number
}

/**
 * Renders a crisp barcode onto an offscreen HTMLCanvasElement using `jsbarcode`.
 * Returns `null` if the input string is empty or cannot be encoded in the requested format.
 */
export function renderBarcodeCanvas(
  value: string,
  options: BarcodeRenderOptions
): HTMLCanvasElement | null {
  const trimmed = value.trim()
  if (!trimmed || typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  const format = options.format ?? 'CODE128'
  const background =
    !options.backgroundColor || options.backgroundColor === 'transparent'
      ? 'rgba(0,0,0,0)'
      : options.backgroundColor

  try {
    JsBarcode(canvas, trimmed, {
      format,
      lineColor: options.lineColor ?? '#0d0d0d',
      background,
      displayValue: options.displayValue ?? false,
      fontSize: options.fontSize ?? 18,
      margin: 4,
      width: 2,
      height: Math.max(24, Math.round(options.height)),
    })
    return canvas
  } catch (error) {
    console.warn(`[barcode] Failed to render "${trimmed}" as ${format}:`, error)
    return null
  }
}
