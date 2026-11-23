import * as React from 'react'
import { FileText, Scale } from 'lucide-react'
import { Button } from 'splatoon-ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'splatoon-ui/dialog'
import { useI18n } from '@/i18n'
import type { TemplateDocs } from '@/templates/template-docs'

interface TemplateDocsModalProps {
  open: boolean
  templateName: string
  docs?: TemplateDocs
  onClose: () => void
}

const URL_REGEX = /(https?:\/\/[^\s<>()[\]"']+)/g

function renderTextWithLinks(text: string): React.ReactNode {
  const parts = text.split(URL_REGEX)
  return parts.map((part, index) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      const cleaned = part.replace(/[.,;:!?]+$/, '')
      const trailing = part.slice(cleaned.length)
      return (
        <React.Fragment key={index}>
          <a
            href={cleaned}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-blue underline underline-offset-2 hover:text-blue/80"
          >
            {cleaned}
          </a>
          {trailing}
        </React.Fragment>
      )
    }
    return <React.Fragment key={index}>{part}</React.Fragment>
  })
}

export function TemplateDocsModal({
  open,
  templateName,
  docs,
  onClose,
}: TemplateDocsModalProps) {
  const { t } = useI18n()
  const creditsText = docs?.credits?.trim()
  const licenseText = docs?.license?.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto !animate-none ![transform:translate(-50%,-50%)]">
        <DialogHeader>
          <DialogTitle>{t('docsModal.title')}</DialogTitle>
          <DialogDescription>{templateName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {creditsText && (
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-chaos-black/75 uppercase">
                <FileText className="h-4 w-4 text-blue" />
                <span>{t('docsModal.creditsHeading')}</span>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-lg border-2 border-chaos-black/20 bg-white p-3.5 text-xs leading-relaxed whitespace-pre-wrap break-words text-chaos-black/90">
                {renderTextWithLinks(creditsText)}
              </div>
            </section>
          )}

          {licenseText && (
            <section className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-chaos-black/75 uppercase">
                <Scale className="h-4 w-4 text-blue" />
                <span>{t('docsModal.licenseHeading')}</span>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border-2 border-chaos-black/20 bg-white p-3.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-chaos-black/85">
                {renderTextWithLinks(licenseText)}
              </div>
            </section>
          )}

          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" variant="outline" hasChevron={false} onClick={onClose}>
              {t('docsModal.close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
