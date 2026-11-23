import * as React from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { Button } from 'splatoon-ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'splatoon-ui/dialog'
import { useI18n } from '@/i18n'

interface PhotoCropModalProps {
  open: boolean
  imageSrc: string | null
  aspect: number
  targetWidth: number
  targetHeight: number
  onCancel: () => void
  onApply: (croppedDataUrl: string) => void
}

async function cropImageToDataUrl(
  imageSrc: string,
  cropArea: Area,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode uploaded image.'))
    img.src = imageSrc
  })

  // Render at 2x target pixels so exported high-DPI cards stay razor sharp
  const outWidth = Math.max(200, Math.round(targetWidth * 2))
  const outHeight = Math.max(200, Math.round(targetHeight * 2))

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create crop canvas context.')

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outWidth,
    outHeight
  )

  return canvas.toDataURL('image/png')
}

export function PhotoCropModal({
  open,
  imageSrc,
  aspect,
  targetWidth,
  targetHeight,
  onCancel,
  onApply,
}: PhotoCropModalProps) {
  const { t } = useI18n()
  const [crop, setCrop] = React.useState({ x: 0, y: 0 })
  const [zoom, setZoom] = React.useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isReadyToMountCropper, setIsReadyToMountCropper] = React.useState(false)

  // Wait one animation frame after dialog opens so react-easy-crop measures the settled container rect
  React.useEffect(() => {
    if (!open || !imageSrc) {
      setIsReadyToMountCropper(false)
      return
    }
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)

    const rafId = window.requestAnimationFrame(() => {
      setIsReadyToMountCropper(true)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [open, imageSrc])

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setIsSaving(true)
    try {
      const dataUrl = await cropImageToDataUrl(
        imageSrc,
        croppedAreaPixels,
        targetWidth,
        targetHeight
      )
      onApply(dataUrl)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel()
      }}
    >
      {/* Disable DialogContent's pop-in scale & -1.5deg rotation so react-easy-crop's
          getBoundingClientRect() geometry and zoom math stay 100% accurate. */}
      <DialogContent className="max-w-lg !animate-none ![transform:translate(-50%,-50%)]">
        <DialogHeader>
          <DialogTitle>{t('cropper.title')}</DialogTitle>
          <DialogDescription>{t('cropper.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="relative h-80 w-full overflow-hidden rounded-lg border-2 border-chaos-black bg-chaos-black">
            {imageSrc && isReadyToMountCropper && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                minZoom={1}
                maxZoom={3}
                aspect={aspect}
                objectFit="contain"
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropAreaChange={(_area, pixels) => setCroppedAreaPixels(pixels)}
                onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-chaos-black">{t('cropper.zoom')}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-blue"
            />
            <span className="w-10 text-right font-mono text-xs font-bold text-chaos-black/70">
              {zoom.toFixed(1)}×
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              {t('cropper.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="blue"
              disabled={!croppedAreaPixels || isSaving}
              onClick={handleConfirm}
            >
              {t('cropper.apply')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
