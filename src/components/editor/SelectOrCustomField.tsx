import * as React from 'react'
import { Input } from 'splatoon-ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'splatoon-ui/select'
import { useI18n } from '@/i18n'
import { loadSalmonRunRanks } from '@/presets'
import type { SelectOption, SelectOrCustomFieldConfig } from '@/templates/schema'
import { PresetOptionText } from './PresetOptionText'

const CUSTOM_SENTINEL = '__splatoon_custom__'

interface SelectOrCustomFieldProps {
  field: SelectOrCustomFieldConfig
  value: string
  onChange: (nextValue: string) => void
}

/**
 * Dropdown backed by either inline template options or a shared preset (like Salmon Run 称号),
 * showing localized hints in parentheses while writing the Japanese value to the card.
 */
export function SelectOrCustomField({ field, value, onChange }: SelectOrCustomFieldProps) {
  const { locale, t } = useI18n()
  const [presetOptions, setPresetOptions] = React.useState<SelectOption[]>([])

  React.useEffect(() => {
    let active = true
    if (field.presetId === 'salmon-run-ranks') {
      loadSalmonRunRanks().then((loaded) => {
        if (active) setPresetOptions(loaded)
      })
    }
    return () => {
      active = false
    }
  }, [field.presetId])

  const options = React.useMemo(
    () => (field.options && field.options.length > 0 ? field.options : presetOptions),
    [field.options, presetOptions]
  )

  const allowCustom = field.allowCustom ?? true
  const matchesOption = options.some((opt) => opt.value === value)
  const [isCustomMode, setIsCustomMode] = React.useState(
    () => Boolean(value) && options.length > 0 && !matchesOption
  )

  React.useEffect(() => {
    if (options.length === 0) return
    if (value && !options.some((opt) => opt.value === value)) {
      setIsCustomMode(true)
    } else if (matchesOption) {
      setIsCustomMode(false)
    }
  }, [options, value, matchesOption])

  const selectValue = isCustomMode ? CUSTOM_SENTINEL : matchesOption ? value : ''
  const selectedOption = options.find((opt) => opt.value === value)
  const triggerDisplay = isCustomMode ? (
    t('editor.customOption')
  ) : selectedOption ? (
    <PresetOptionText option={selectedOption} locale={locale} />
  ) : undefined

  return (
    <div className="space-y-2">
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (!next) return
          if (next === CUSTOM_SENTINEL) {
            setIsCustomMode(true)
          } else {
            setIsCustomMode(false)
            onChange(next)
          }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('editor.customInputPlaceholder')}>
            {triggerDisplay}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <PresetOptionText option={opt} locale={locale} />
            </SelectItem>
          ))}
          {allowCustom && <SelectItem value={CUSTOM_SENTINEL}>{t('editor.customOption')}</SelectItem>}
        </SelectContent>
      </Select>

      {allowCustom && isCustomMode && (
        <Input
          type="text"
          value={value}
          placeholder={t('editor.customInputPlaceholder')}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        />
      )}
    </div>
  )
}
