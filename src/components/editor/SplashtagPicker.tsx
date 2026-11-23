import * as React from 'react'
import { Dices, Search } from 'lucide-react'
import { Input } from 'splatoon-ui/input'
import { useI18n } from '@/i18n'
import {
  loadSplashtagTitles,
  matchesPresetQuery,
  pickRandomSplashtag,
  splitSplashtagValue,
  type SplashtagCatalog,
} from '@/presets'
import type { SplashtagTitleFieldConfig } from '@/templates/schema'
import { PresetOptionText } from './PresetOptionText'

const MAX_VISIBLE_OPTIONS = 120

interface SplashtagPickerProps {
  field: SplashtagTitleFieldConfig
  value: string
  onChange: (nextValue: string) => void
}

/**
 * Searchable two-part Japanese Splatoon 3 二つ名 (Splashtag Title) picker.
 * Displays localized translations in parentheses (and lets users search in EN / ZH / JA),
 * while writing the authentic Japanese title string to the card.
 */
export function SplashtagPicker({ field, value, onChange }: SplashtagPickerProps) {
  const { locale, t } = useI18n()
  const joiner = field.joiner ?? ''
  const allowCustom = field.allowCustom ?? true

  const [catalog, setCatalog] = React.useState<SplashtagCatalog | null>(null)
  const [mode, setMode] = React.useState<'preset' | 'custom'>('preset')
  const [selectedAdj, setSelectedAdj] = React.useState('')
  const [selectedSubj, setSelectedSubj] = React.useState('')
  const [adjQuery, setAdjQuery] = React.useState('')
  const [subjQuery, setSubjQuery] = React.useState('')

  React.useEffect(() => {
    let active = true
    loadSplashtagTitles().then((loaded) => {
      if (active) setCatalog(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    if (!catalog) return
    if (!value.trim()) {
      setSelectedAdj('')
      setSelectedSubj('')
      return
    }
    const split = splitSplashtagValue(value, catalog, joiner)
    if (split) {
      setSelectedAdj(split.adjective)
      setSelectedSubj(split.subject)
    }
  }, [catalog, value, joiner])

  const filteredAdjectives = React.useMemo(() => {
    if (!catalog) return []
    return catalog.adjectives.filter((item) => matchesPresetQuery(item, adjQuery))
  }, [catalog, adjQuery])

  const filteredSubjects = React.useMemo(() => {
    if (!catalog) return []
    return catalog.subjects.filter((item) => matchesPresetQuery(item, subjQuery))
  }, [catalog, subjQuery])

  const visibleAdjectives = filteredAdjectives.slice(0, MAX_VISIBLE_OPTIONS)
  const visibleSubjects = filteredSubjects.slice(0, MAX_VISIBLE_OPTIONS)

  const updateParts = (nextAdj: string, nextSubj: string) => {
    setSelectedAdj(nextAdj)
    setSelectedSubj(nextSubj)
    onChange(`${nextAdj}${nextAdj && nextSubj ? joiner : ''}${nextSubj}`)
  }

  const handleRandom = () => {
    if (!catalog) return
    const picked = pickRandomSplashtag(catalog, joiner)
    setMode('preset')
    setSelectedAdj(picked.adjective)
    setSelectedSubj(picked.subject)
    onChange(picked.combined)
  }

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-chaos-black/15 bg-white/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('preset')}
            className={`rounded px-2.5 py-1 text-xs font-bold transition-colors ${
              mode === 'preset'
                ? 'bg-chaos-black text-yellow'
                : 'bg-chaos-black/10 text-chaos-black hover:bg-chaos-black/20'
            }`}
          >
            {t('splashtag.presetMode')}
          </button>
          {allowCustom && (
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-colors ${
                mode === 'custom'
                  ? 'bg-chaos-black text-yellow'
                  : 'bg-chaos-black/10 text-chaos-black hover:bg-chaos-black/20'
              }`}
            >
              {t('splashtag.customMode')}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleRandom}
          disabled={!catalog}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-chaos-black bg-yellow px-2.5 py-1 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Dices className="h-3.5 w-3.5" />
          <span>{t('splashtag.randomTitle')}</span>
        </button>
      </div>

      {value && (
        <div className="rounded bg-chaos-black/5 px-2.5 py-1.5 text-xs font-bold text-chaos-black">
          {t('splashtag.preview', { value })}
        </div>
      )}

      {mode === 'custom' ? (
        <Input
          type="text"
          value={value}
          placeholder={t('editor.customInputPlaceholder')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      ) : !catalog ? (
        <p className="text-xs font-medium text-chaos-black/60">{t('splashtag.loading')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Prefix (前編) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-chaos-black/70">
              <span>{t('splashtag.adjectiveLabel')}</span>
              <span className="font-mono text-[11px] font-semibold text-chaos-black/45">
                {filteredAdjectives.length}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-chaos-black/45" />
              <input
                type="text"
                value={adjQuery}
                onChange={(e) => setAdjQuery(e.target.value)}
                placeholder={t('splashtag.searchPlaceholder')}
                className="w-full rounded border-2 border-chaos-black/20 bg-white py-1.5 pr-2 pl-8 text-xs font-medium focus:border-blue focus:outline-none"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded border border-chaos-black/15 bg-white p-1">
              {visibleAdjectives.length === 0 ? (
                <p className="p-2 text-xs text-chaos-black/50">{t('splashtag.noMatches')}</p>
              ) : (
                <>
                  {visibleAdjectives.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => updateParts(item.value, selectedSubj)}
                      className={`block w-full rounded px-2 py-1 text-left text-xs font-semibold transition-colors ${
                        selectedAdj === item.value
                          ? 'bg-blue text-white'
                          : 'text-chaos-black hover:bg-yellow/50'
                      }`}
                    >
                      <PresetOptionText option={item} locale={locale} />
                    </button>
                  ))}
                  {filteredAdjectives.length > MAX_VISIBLE_OPTIONS && (
                    <p className="px-2 py-1.5 text-[11px] font-medium text-chaos-black/50">
                      {t('splashtag.showingSubset', {
                        shown: MAX_VISIBLE_OPTIONS,
                        total: filteredAdjectives.length,
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Suffix (後編) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-chaos-black/70">
              <span>{t('splashtag.subjectLabel')}</span>
              <span className="font-mono text-[11px] font-semibold text-chaos-black/45">
                {filteredSubjects.length}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-chaos-black/45" />
              <input
                type="text"
                value={subjQuery}
                onChange={(e) => setSubjQuery(e.target.value)}
                placeholder={t('splashtag.searchPlaceholder')}
                className="w-full rounded border-2 border-chaos-black/20 bg-white py-1.5 pr-2 pl-8 text-xs font-medium focus:border-blue focus:outline-none"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded border border-chaos-black/15 bg-white p-1">
              {visibleSubjects.length === 0 ? (
                <p className="p-2 text-xs text-chaos-black/50">{t('splashtag.noMatches')}</p>
              ) : (
                <>
                  {visibleSubjects.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => updateParts(selectedAdj, item.value)}
                      className={`block w-full rounded px-2 py-1 text-left text-xs font-semibold transition-colors ${
                        selectedSubj === item.value
                          ? 'bg-blue text-white'
                          : 'text-chaos-black hover:bg-yellow/50'
                      }`}
                    >
                      <PresetOptionText option={item} locale={locale} />
                    </button>
                  ))}
                  {filteredSubjects.length > MAX_VISIBLE_OPTIONS && (
                    <p className="px-2 py-1.5 text-[11px] font-medium text-chaos-black/50">
                      {t('splashtag.showingSubset', {
                        shown: MAX_VISIBLE_OPTIONS,
                        total: filteredSubjects.length,
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
