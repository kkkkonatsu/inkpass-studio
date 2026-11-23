import * as React from 'react'
import { Input } from 'splatoon-ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'splatoon-ui/select'
import {
  JAPANESE_ERAS,
  gregorianToJapaneseEra,
  japaneseEraToGregorian,
  parseJapaneseEraString,
  type JapaneseEraId,
} from '@/engine/japanese-era'
import { formatDateString } from '@/engine/text-layout'
import { useI18n } from '@/i18n'
import type { DateFieldConfig } from '@/templates/schema'

interface DateEraFieldProps {
  field: DateFieldConfig
  value: string
  onChange: (nextValue: string) => void
}

type DateInputMode = 'converter' | 'free'

/**
 * Bidirectional Western (西暦 YYYY-MM-DD) <-> Japanese Era (和暦 / 日本年号) date editor.
 * Editing either side immediately syncs the other and previews the exact formatted output on the card.
 */
export function DateEraField({ field, value, onChange }: DateEraFieldProps) {
  const { t } = useI18n()

  const normalizedIso = React.useMemo(() => {
    const fromEra = parseJapaneseEraString(value)
    if (fromEra) return fromEra
    return /^\d{4}-\d{1,2}-\d{1,2}$/.test(value.trim()) ? value.trim() : ''
  }, [value])

  const parsedEra = React.useMemo(
    () => (normalizedIso ? gregorianToJapaneseEra(normalizedIso) : null),
    [normalizedIso]
  )

  const [mode, setMode] = React.useState<DateInputMode>(() =>
    value && !normalizedIso ? 'free' : 'converter'
  )

  const [eraId, setEraId] = React.useState<JapaneseEraId>(parsedEra?.era ?? 'reiwa')
  const [eraYear, setEraYear] = React.useState<string>(parsedEra ? String(parsedEra.year) : '8')
  const [eraMonth, setEraMonth] = React.useState<string>(parsedEra ? String(parsedEra.month) : '4')
  const [eraDay, setEraDay] = React.useState<string>(parsedEra ? String(parsedEra.day) : '1')
  const [eraError, setEraError] = React.useState(false)

  // Keep Japanese Era inputs synchronized whenever the Western ISO date changes externally
  React.useEffect(() => {
    if (!parsedEra) return
    setEraId(parsedEra.era)
    setEraYear(String(parsedEra.year))
    setEraMonth(String(parsedEra.month))
    setEraDay(String(parsedEra.day))
    setEraError(false)
  }, [parsedEra])

  const applyEraParts = (
    nextEra: JapaneseEraId,
    nextYearStr: string,
    nextMonthStr: string,
    nextDayStr: string
  ) => {
    setEraId(nextEra)
    setEraYear(nextYearStr)
    setEraMonth(nextMonthStr)
    setEraDay(nextDayStr)

    const y = Number(nextYearStr)
    const m = Number(nextMonthStr)
    const d = Number(nextDayStr)
    const iso = japaneseEraToGregorian(nextEra, y, m, d)
    if (iso) {
      setEraError(false)
      onChange(iso)
    } else {
      setEraError(true)
    }
  }

  const formattedCardText = formatDateString(value, field.format, { fullWidth: field.fullWidth })
  const eraFirst = field.calendar === 'japanese-era' || /G|E/.test(field.format ?? '')

  const westernBlock = (
    <div className="space-y-1">
      <div className="text-xs font-bold text-chaos-black/65">{t('date.western')}</div>
      <Input
        type="date"
        value={normalizedIso}
        onChange={(e) => {
          setEraError(false)
          onChange(e.target.value)
        }}
        className="w-full"
      />
    </div>
  )

  const japaneseEraBlock = (
    <div className="space-y-1">
      <div className="text-xs font-bold text-chaos-black/65">{t('date.japaneseEra')}</div>
      <div className="grid grid-cols-4 gap-2">
        <Select
          value={eraId}
          onValueChange={(next) => {
            if (next) applyEraParts(next as JapaneseEraId, eraYear, eraMonth, eraDay)
          }}
        >
          <SelectTrigger aria-label={t('date.era')} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JAPANESE_ERAS.map((era) => (
              <SelectItem key={era.id} value={era.id}>
                {era.kanji}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={1}
          max={99}
          value={eraYear}
          aria-label={t('date.year')}
          placeholder={t('date.year')}
          onChange={(e) => applyEraParts(eraId, e.target.value, eraMonth, eraDay)}
        />
        <Input
          type="number"
          min={1}
          max={12}
          value={eraMonth}
          aria-label={t('date.month')}
          placeholder={t('date.month')}
          onChange={(e) => applyEraParts(eraId, eraYear, e.target.value, eraDay)}
        />
        <Input
          type="number"
          min={1}
          max={31}
          value={eraDay}
          aria-label={t('date.day')}
          placeholder={t('date.day')}
          onChange={(e) => applyEraParts(eraId, eraYear, eraMonth, e.target.value)}
        />
      </div>
      {eraError && <p className="text-xs font-semibold text-red">{t('date.invalidEraDate')}</p>}
    </div>
  )

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-chaos-black/15 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-chaos-black px-2 py-0.5 font-mono text-xs font-bold text-yellow">
          {formattedCardText ? t('date.cardOutput', { value: formattedCardText }) : '—'}
        </span>

        <button
          type="button"
          className="text-xs font-bold text-blue underline underline-offset-2 hover:text-chaos-black"
          onClick={() => setMode((prev) => (prev === 'converter' ? 'free' : 'converter'))}
        >
          {mode === 'converter' ? t('date.freeText') : t('date.japaneseEra')}
        </button>
      </div>

      {mode === 'free' ? (
        <Input
          type="text"
          value={value}
          placeholder="例: 令和8年4月1日 / 2026.04.01"
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      ) : (
        <div className="space-y-2.5">
          {eraFirst ? (
            <>
              {japaneseEraBlock}
              {westernBlock}
            </>
          ) : (
            <>
              {westernBlock}
              {japaneseEraBlock}
            </>
          )}
        </div>
      )}
    </div>
  )
}
