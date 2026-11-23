import * as React from 'react'
import { useI18n } from '@/i18n'
import { ProjectCreditsModal } from './ProjectCreditsModal'

export function Footer() {
  const { t } = useI18n()
  const [creditsOpen, setCreditsOpen] = React.useState(false)

  return (
    <footer className="border-t-4 border-chaos-black bg-chaos-black text-white/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-white">
          <span>
            {t('app.title')} — {t('footer.openSource')}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setCreditsOpen(true)}
              className="cursor-pointer text-yellow underline decoration-2 underline-offset-4 hover:text-green"
            >
              {t('footer.creditsLink')}
            </button>
            <a
              href="https://github.com/kkkkonatsu/inkpass-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow underline decoration-2 underline-offset-4 hover:text-green"
            >
              GitHub
            </a>
          </div>
        </div>
        <p className="leading-relaxed text-white/55">{t('footer.disclaimer')}</p>
      </div>

      <ProjectCreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </footer>
  )
}
