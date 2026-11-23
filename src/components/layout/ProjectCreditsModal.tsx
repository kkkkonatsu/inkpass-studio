import { BookOpen, Database, HeartHandshake, Scale, Type } from 'lucide-react'
import { Button } from 'splatoon-ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'splatoon-ui/dialog'
import { useI18n } from '@/i18n'

interface ProjectCreditsModalProps {
  open: boolean
  onClose: () => void
}

interface CreditItem {
  name: string
  url: string
  meta: string
}

const LIBRARIES: readonly CreditItem[] = [
  {
    name: 'splatoon-ui',
    url: 'https://github.com/YoungSx/splatoon-ui',
    meta: 'MIT — Splatoon-inspired React component library & visual tokens',
  },
  {
    name: 'React',
    url: 'https://react.dev',
    meta: 'MIT — UI library',
  },
  {
    name: 'Vite',
    url: 'https://vite.dev',
    meta: 'MIT — Build tool & dev server',
  },
  {
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com',
    meta: 'MIT — Utility-first CSS framework',
  },
  {
    name: 'pdf-lib',
    url: 'https://pdf-lib.js.org',
    meta: 'MIT — Client-side PDF generation (card & A4 sheets)',
  },
  {
    name: 'JSZip',
    url: 'https://stuk.github.io/jszip/',
    meta: 'MIT / GPLv3 — Template .zip packaging & import',
  },
  {
    name: 'JsBarcode',
    url: 'https://lindell.me/JsBarcode/',
    meta: 'MIT — Code 128 barcode generation',
  },
  {
    name: 'react-easy-crop',
    url: 'https://github.com/ValentinH/react-easy-crop',
    meta: 'MIT — Interactive ID photo cropping',
  },
  {
    name: 'Lucide React',
    url: 'https://lucide.dev',
    meta: 'ISC — UI icons',
  },
]

const DATA_SOURCES: readonly CreditItem[] = [
  {
    name: 'Leanny/splat3',
    url: 'https://github.com/Leanny/splat3',
    meta: 'Splatoon 3 multilingual Salmon Run ranks & Splashtag title presets',
  },
]

const FONTS: readonly CreditItem[] = [
  {
    name: 'BlitzMain & SpAlterna',
    url: 'https://github.com/North-West-Wind/splatoon3-fonts',
    meta: 'Splatoon 3 display fonts (bundled via splatoon-ui)',
  },
  {
    name: 'Montserrat',
    url: 'https://fonts.google.com/specimen/Montserrat',
    meta: 'SIL Open Font License 1.1 — UI body font',
  },
  {
    name: 'Source Han Serif JP (源ノ明朝)',
    url: 'https://github.com/adobe-fonts/source-han-serif',
    meta: 'SIL Open Font License 1.1 — Adobe & Google',
  },
  {
    name: 'Wapuro Mincho (ワープロ明朝)',
    url: 'https://flopdesign.booth.pm/items/3571546',
    meta: 'Japanese Mincho card typeface',
  },
  {
    name: 'Computer Modern Unicode (cmunvt)',
    url: 'https://cm-unicode.sourceforge.io/',
    meta: 'SIL Open Font License 1.1 — Typewriter card typeface',
  },
]

function CreditList({ items }: { items: readonly CreditItem[] }) {
  return (
    <ul className="divide-y divide-chaos-black/10 rounded-lg border-2 border-chaos-black/20 bg-white">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-0.5 px-3.5 py-2 text-xs sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-extrabold text-blue underline underline-offset-2 hover:text-blue/80"
          >
            {item.name}
          </a>
          <span className="text-[11px] font-medium text-chaos-black/70 sm:text-right">
            {item.meta}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ProjectCreditsModal({ open, onClose }: ProjectCreditsModalProps) {
  const { t } = useI18n()

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto !animate-none ![transform:translate(-50%,-50%)]">
        <DialogHeader>
          <DialogTitle>{t('projectCredits.title')}</DialogTitle>
          <DialogDescription>
            {t('app.title')} — {t('footer.openSource')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Disclaimer & Usage Freedom */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-chaos-black/75 uppercase">
              <Scale className="h-4 w-4 text-blue" />
              <span>{t('projectCredits.disclaimerHeading')}</span>
            </div>
            <div className="space-y-2 rounded-lg border-2 border-chaos-black/20 bg-white p-3.5 text-xs leading-relaxed text-chaos-black/85">
              <p>{t('projectCredits.fanMadeDisclaimer')}</p>
              <p className="flex items-start gap-1.5 font-semibold text-chaos-black">
                <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-blue" />
                <span>{t('projectCredits.userFreedom')}</span>
              </p>
              <p className="text-chaos-black/75">{t('projectCredits.templateOwnership')}</p>
            </div>
          </section>

          {/* Libraries & Tools */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-chaos-black/75 uppercase">
              <BookOpen className="h-4 w-4 text-blue" />
              <span>{t('projectCredits.librariesHeading')}</span>
            </div>
            <CreditList items={LIBRARIES} />
          </section>

          {/* Fonts */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-chaos-black/75 uppercase">
              <Type className="h-4 w-4 text-blue" />
              <span>{t('projectCredits.fontsHeading')}</span>
            </div>
            <CreditList items={FONTS} />
          </section>

          {/* Game Data */}
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-chaos-black/75 uppercase">
              <Database className="h-4 w-4 text-blue" />
              <span>{t('projectCredits.dataHeading')}</span>
            </div>
            <CreditList items={DATA_SOURCES} />
          </section>

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
