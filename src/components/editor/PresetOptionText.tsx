import type { Locale } from '@/i18n'
import { getPresetTranslation } from '@/presets'
import type { SelectOption } from '@/templates/schema'

interface PresetOptionTextProps {
  option: SelectOption
  locale: Locale
}

/**
 * Renders a Japanese preset value prominently with its localized translation
 * subtly muted and slightly smaller in parentheses.
 */
export function PresetOptionText({ option, locale }: PresetOptionTextProps) {
  const translation = getPresetTranslation(option, locale)

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1">
      <span>{option.value}</span>
      {translation && (
        <span className="text-[0.82em] font-normal opacity-55">({translation})</span>
      )}
    </span>
  )
}
