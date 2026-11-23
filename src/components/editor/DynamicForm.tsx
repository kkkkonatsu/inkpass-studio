import * as React from 'react'
import { Barcode, Dices, Trash2, Upload } from 'lucide-react'
import { Button } from 'splatoon-ui/button'
import { Input } from 'splatoon-ui/input'
import { Label } from 'splatoon-ui/label'
import { generateRandomPattern } from '@/engine/text-layout'
import { useI18n } from '@/i18n'
import {
  getLocalizedText,
  type CardFieldValues,
  type DocumentTemplateConfig,
  type PhotoFieldConfig,
  type TemplateField,
  type TemplateSide,
} from '@/templates/schema'
import { DateEraField } from './DateEraField'
import { PhotoCropModal } from './PhotoCropModal'
import { SelectOrCustomField } from './SelectOrCustomField'
import { SplashtagPicker } from './SplashtagPicker'

interface DynamicFormProps {
  template: DocumentTemplateConfig
  side: TemplateSide
  values: CardFieldValues
  onChange: (fieldId: string, nextValue: string) => void
}

/**
 * Generates an accessible form automatically from a template side's `fields` array.
 * Adding a new field in `config.json` automatically renders its matching editor control here.
 */
export function DynamicForm({ template, side, values, onChange }: DynamicFormProps) {
  const { locale, t } = useI18n()

  const [cropTarget, setCropTarget] = React.useState<{
    field: PhotoFieldConfig
    rawSrc: string
  } | null>(null)

  const allFieldsMap = React.useMemo(() => {
    const map = new Map<string, TemplateField>()
    for (const s of template.sides) {
      for (const f of s.fields) map.set(f.id, f)
    }
    return map
  }, [template])

  const handlePhotoSelect = (field: PhotoFieldConfig, file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropTarget({ field, rawSrc: reader.result })
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-5">
      {side.fields.map((field) => {
        const label = getLocalizedText(field.label, locale) || field.id
        const placeholder = getLocalizedText(field.placeholder, locale)
        const helpText = getLocalizedText(field.helpText, locale)
        const value = values[field.id] ?? ''

        // Linked barcode fields automatically mirror another field (e.g. employeeId / studentId)
        if (field.type === 'barcode' && field.sourceFieldId) {
          const sourceField = allFieldsMap.get(field.sourceFieldId)
          const sourceLabel = sourceField
            ? getLocalizedText(sourceField.label, locale)
            : field.sourceFieldId

          return (
            <div
              key={field.id}
              className="flex items-center gap-2 rounded-lg border border-dashed border-chaos-black/25 bg-white/60 px-3 py-2 text-xs font-semibold text-chaos-black/70"
            >
              <Barcode className="h-4 w-4 shrink-0 text-blue" />
              <span>
                {label}: {t('editor.barcodeAutoLinked', { field: sourceLabel })}
              </span>
            </div>
          )
        }

        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={`field-${field.id}`} className="text-chaos-black">
              {label}
            </Label>

            {field.type === 'photo' && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-chaos-black/15 bg-white/80 p-3">
                {value && (
                  <img
                    src={value}
                    alt={label}
                    className="h-16 w-14 rounded border-2 border-chaos-black object-cover"
                  />
                )}

                <label className="cursor-pointer">
                  <input
                    id={`field-${field.id}`}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      handlePhotoSelect(field, e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  <span className="inline-flex items-center gap-2 rounded-md border-2 border-chaos-black bg-yellow px-3 py-2 text-xs font-extrabold text-chaos-black shadow-[2px_2px_0px_#0d0d0d] transition-transform hover:-translate-y-0.5">
                    <Upload className="h-4 w-4" />
                    {value ? t('editor.changePhoto') : t('editor.uploadPhoto')}
                  </span>
                </label>

                {value && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => onChange(field.id, '')}
                  >
                    {t('editor.removePhoto')}
                  </Button>
                )}
              </div>
            )}

            {field.type === 'text' && (
              <div className="flex items-center gap-2">
                <Input
                  id={`field-${field.id}`}
                  type="text"
                  value={value}
                  placeholder={placeholder}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className="w-full"
                />
                {field.randomPattern && (
                  <Button
                    type="button"
                    size="sm"
                    variant="yellow"
                    leftIcon={<Dices className="h-4 w-4" />}
                    onClick={() => onChange(field.id, generateRandomPattern(field.randomPattern!))}
                  >
                    {t('editor.randomize')}
                  </Button>
                )}
              </div>
            )}

            {field.type === 'barcode' && !field.sourceFieldId && (
              <div className="flex items-center gap-2">
                <Input
                  id={`field-${field.id}`}
                  type="text"
                  value={value}
                  placeholder={placeholder}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className="w-full"
                />
                {field.randomPattern && (
                  <Button
                    type="button"
                    size="sm"
                    variant="yellow"
                    leftIcon={<Dices className="h-4 w-4" />}
                    onClick={() => onChange(field.id, generateRandomPattern(field.randomPattern!))}
                  >
                    {t('editor.randomize')}
                  </Button>
                )}
              </div>
            )}

            {field.type === 'date' && (
              <DateEraField
                field={field}
                value={value}
                onChange={(next) => onChange(field.id, next)}
              />
            )}

            {field.type === 'select-or-custom' && (
              <SelectOrCustomField
                field={field}
                value={value}
                onChange={(next) => onChange(field.id, next)}
              />
            )}

            {field.type === 'splashtag-title' && (
              <SplashtagPicker
                field={field}
                value={value}
                onChange={(next) => onChange(field.id, next)}
              />
            )}

            {helpText && <p className="text-xs text-chaos-black/60">{helpText}</p>}
          </div>
        )
      })}

      <PhotoCropModal
        open={Boolean(cropTarget)}
        imageSrc={cropTarget?.rawSrc ?? null}
        aspect={cropTarget ? cropTarget.field.width / cropTarget.field.height : 4 / 5}
        targetWidth={cropTarget?.field.width ?? 300}
        targetHeight={cropTarget?.field.height ?? 375}
        onCancel={() => setCropTarget(null)}
        onApply={(croppedDataUrl) => {
          if (cropTarget) {
            onChange(cropTarget.field.id, croppedDataUrl)
          }
          setCropTarget(null)
        }}
      />
    </div>
  )
}
