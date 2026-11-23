import * as React from 'react'
import { Wrench } from 'lucide-react'
import { Button } from 'splatoon-ui/button'
import { SegmentedControl, SegmentedControlItem } from 'splatoon-ui/segmented-control'
import { SUPPORTED_LOCALES, useI18n, type Locale } from '@/i18n'
import { buildHashPath, navigateTo, type AppRoute } from '@/router'

interface HeaderProps {
  route: AppRoute
}

export function Header({ route }: HeaderProps) {
  const { locale, setLocale, t } = useI18n()

  return (
    <header className="sticky top-0 z-50 border-b-4 border-chaos-black bg-chaos-black text-white shadow-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a
          href={buildHashPath({ page: 'home' })}
          className="font-heading flex items-center gap-2 text-xl tracking-wide text-yellow transition-transform hover:-rotate-1 sm:text-2xl"
        >
          <span>{t('app.title')}</span>
        </a>

        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Main navigation" className="flex items-center gap-2">
            <Button
              size="sm"
              variant={route.page === 'home' ? 'yellow' : 'ghost'}
              className={route.page === 'home' ? '' : 'text-white'}
              onClick={() => navigateTo({ page: 'home' })}
            >
              {t('nav.home')}
            </Button>

            <Button
              size="sm"
              variant={route.page === 'designer' ? 'blue' : 'ghost'}
              className={route.page === 'designer' ? '' : 'text-white'}
              leftIcon={<Wrench className="h-4 w-4" />}
              onClick={() => navigateTo({ page: 'designer' })}
            >
              {t('nav.designer')}
            </Button>
          </nav>

          <SegmentedControl
            appearance="track"
            density="compact"
            value={locale}
            onValueChange={(next) => setLocale(next as Locale)}
            aria-label={t('nav.language')}
            style={{ '--segmented-control-track-width': '3.5rem' } as React.CSSProperties}
          >
            {SUPPORTED_LOCALES.map((item) => (
              <SegmentedControlItem key={item.code} value={item.code}>
                {item.shortLabel}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
      </div>
    </header>
  )
}
