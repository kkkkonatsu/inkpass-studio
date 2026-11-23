import * as React from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { Input } from 'splatoon-ui/input'
import { BUNDLED_CARD_FONTS, type BundledCardFont } from '@/fonts'
import { useI18n } from '@/i18n'
import type {
  BarcodeFieldConfig,
  DateFieldConfig,
  DocumentTemplateConfig,
  FieldType,
  PhotoFieldConfig,
  SelectOrCustomFieldConfig,
  SplashtagTitleFieldConfig,
  TemplateField,
  TemplateSide,
  TextAlign,
  TextFieldConfig,
  TextStyleProps,
  VerticalAlign,
} from '@/templates/schema'

interface FieldInspectorProps {
  template: DocumentTemplateConfig
  side: TemplateSide
  selectedFieldId: string | null
  extraFonts?: readonly BundledCardFont[]
  onSelectField: (fieldId: string | null) => void
  onAddField: (type: FieldType) => void
  onDuplicateField: (fieldId: string) => void
  onRenameField: (oldFieldId: string, desiredId: string) => string
  onUpdateField: (fieldId: string, patch: Partial<TemplateField>) => void
  onDeleteField: (fieldId: string) => void
  onMoveFieldOrder: (fieldId: string, direction: -1 | 1) => void
}

const FIELD_TYPES: Array<{ type: FieldType; labelKey: string }> = [
  { type: 'text', labelKey: 'designerForm.typeText' },
  { type: 'photo', labelKey: 'designerForm.typePhoto' },
  { type: 'date', labelKey: 'designerForm.typeDate' },
  { type: 'select-or-custom', labelKey: 'designerForm.typeSelect' },
  { type: 'splashtag-title', labelKey: 'designerForm.typeSplashtag' },
  { type: 'barcode', labelKey: 'designerForm.typeBarcode' },
]

const DATE_FORMAT_PRESETS = [
  'GGGEEE年M月D日',
  'GEE.MM.DD',
  'YYYY.MM.DD',
  'YYYY年M月D日',
]

function isTextLikeField(
  field: TemplateField
): field is
  | TextFieldConfig
  | DateFieldConfig
  | SelectOrCustomFieldConfig
  | SplashtagTitleFieldConfig {
  return (
    field.type === 'text' ||
    field.type === 'date' ||
    field.type === 'select-or-custom' ||
    field.type === 'splashtag-title'
  )
}

export function FieldInspector({
  template,
  side,
  selectedFieldId,
  extraFonts = [],
  onSelectField,
  onAddField,
  onDuplicateField,
  onRenameField,
  onUpdateField,
  onDeleteField,
  onMoveFieldOrder,
}: FieldInspectorProps) {
  const { t } = useI18n()
  const selectedField = side.fields.find((f) => f.id === selectedFieldId) ?? null
  const [idDraft, setIdDraft] = React.useState(selectedField?.id ?? '')
  const skipNextIdCommitRef = React.useRef(false)

  React.useEffect(() => {
    setIdDraft(selectedField?.id ?? '')
  }, [selectedField?.id])

  const commitFieldId = () => {
    if (skipNextIdCommitRef.current) {
      skipNextIdCommitRef.current = false
      return
    }
    if (!selectedField) return
    const trimmed = idDraft.trim()
    if (!trimmed || trimmed === selectedField.id) {
      setIdDraft(selectedField.id)
      return
    }
    const resolved = onRenameField(selectedField.id, trimmed)
    setIdDraft(resolved)
  }
  const uploadedFontIds = new Set(extraFonts.map((font) => font.id))
  const siteFonts = BUNDLED_CARD_FONTS.filter((font) => !uploadedFontIds.has(font.id))

  const allTextFieldIds = template.sides.flatMap((s) =>
    s.fields.filter((f) => f.type === 'text').map((f) => f.id)
  )

  const updatePatch = (patch: Partial<TemplateField>) => {
    if (!selectedField) return
    onUpdateField(selectedField.id, patch)
  }

  return (
    <div className="space-y-5">
      {/* Add Field buttons */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold tracking-wide text-chaos-black/70 uppercase">
          {t('designer.addField')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_TYPES.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddField(item.type)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border-2 border-chaos-black bg-white px-2.5 py-1 text-xs font-extrabold text-chaos-black transition-colors hover:bg-yellow"
            >
              <Plus className="h-3 w-3" />
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Field list */}
      <div className="space-y-2">
        <div className="text-xs font-extrabold tracking-wide text-chaos-black/70 uppercase">
          {t('designer.fieldList')} ({side.fields.length})
        </div>
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border-2 border-chaos-black/20 bg-white p-1.5">
          {side.fields.length === 0 ? (
            <p className="p-2 text-xs text-chaos-black/50">—</p>
          ) : (
            side.fields.map((field, idx) => {
              const active = field.id === selectedFieldId
              return (
                <div
                  key={`${field.id}-${idx}`}
                  className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-xs font-bold ${
                    active ? 'bg-blue text-white' : 'text-chaos-black hover:bg-yellow/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectField(field.id)}
                    className="flex flex-1 cursor-pointer items-center gap-2 text-left"
                  >
                    <span className="font-mono">{field.id}</span>
                    <span className="text-[10px] uppercase opacity-70">{field.type}</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDuplicateField(field.id)}
                      className="cursor-pointer rounded p-0.5 opacity-75 hover:opacity-100"
                      aria-label={t('designer.duplicateField')}
                      title={t('designer.duplicateField')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMoveFieldOrder(field.id, -1)}
                      className="rounded p-0.5 opacity-75 hover:opacity-100 disabled:opacity-25"
                      aria-label={t('designerForm.moveUp')}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === side.fields.length - 1}
                      onClick={() => onMoveFieldOrder(field.id, 1)}
                      className="rounded p-0.5 opacity-75 hover:opacity-100 disabled:opacity-25"
                      aria-label={t('designerForm.moveDown')}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Selected field properties */}
      {!selectedField ? (
        <p className="rounded-lg border-2 border-dashed border-chaos-black/20 bg-white/60 p-4 text-xs font-semibold text-chaos-black/60">
          {t('designer.noFieldSelected')}
        </p>
      ) : (
        <div className="space-y-4 rounded-lg border-2 border-chaos-black bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-chaos-black/15 pb-2">
            <span className="font-mono text-sm font-black text-blue">
              {selectedField.id} ({selectedField.type})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDuplicateField(selectedField.id)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border-2 border-chaos-black bg-yellow px-2.5 py-1 text-[11px] font-extrabold text-chaos-black transition-colors hover:bg-yellow/80"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{t('designer.duplicateField')}</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteField(selectedField.id)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border-2 border-chaos-black bg-red px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-red/90"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('designer.deleteField')}</span>
              </button>
            </div>
          </div>

          {/* Field ID & Labels */}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-bold">
              <span>{t('designerForm.fieldId')}</span>
              <Input
                value={idDraft}
                onChange={(e) => setIdDraft(e.target.value)}
                onBlur={commitFieldId}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  } else if (e.key === 'Escape') {
                    skipNextIdCommitRef.current = true
                    setIdDraft(selectedField.id)
                    e.currentTarget.blur()
                  }
                }}
              />
            </label>
            <label className="space-y-1 text-xs font-bold">
              <span>{t('designerForm.samplePreviewValue')}</span>
              <Input
                value={selectedField.sampleValue ?? ''}
                onChange={(e) => updatePatch({ sampleValue: e.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs font-bold">
              <span>{t('designerForm.labelEn')}</span>
              <Input
                value={selectedField.label.en ?? ''}
                onChange={(e) =>
                  updatePatch({ label: { ...selectedField.label, en: e.target.value } })
                }
              />
            </label>
            <label className="space-y-1 text-xs font-bold">
              <span>{t('designerForm.labelJa')}</span>
              <Input
                value={selectedField.label.ja ?? ''}
                onChange={(e) =>
                  updatePatch({ label: { ...selectedField.label, ja: e.target.value } })
                }
              />
            </label>
            <label className="space-y-1 text-xs font-bold">
              <span>{t('designerForm.labelZhHans')}</span>
              <Input
                value={selectedField.label['zh-Hans'] ?? ''}
                onChange={(e) =>
                  updatePatch({ label: { ...selectedField.label, 'zh-Hans': e.target.value } })
                }
              />
            </label>
            <label className="space-y-1 text-xs font-bold">
              <span>{t('designerForm.labelZhHant')}</span>
              <Input
                value={selectedField.label['zh-Hant'] ?? ''}
                onChange={(e) =>
                  updatePatch({ label: { ...selectedField.label, 'zh-Hant': e.target.value } })
                }
              />
            </label>
          </div>

          {/* Geometry */}
          <div className="grid grid-cols-5 gap-2">
            {(
              [
                { prop: 'x', labelKey: 'designerForm.posX' },
                { prop: 'y', labelKey: 'designerForm.posY' },
                { prop: 'width', labelKey: 'designerForm.widthShort' },
                { prop: 'height', labelKey: 'designerForm.heightShort' },
              ] as const
            ).map(({ prop, labelKey }) => (
              <label key={prop} className="space-y-1 text-xs font-bold">
                <span>{t(labelKey)}</span>
                <Input
                  type="number"
                  value={selectedField[prop]}
                  onChange={(e) => updatePatch({ [prop]: Number(e.target.value) || 0 })}
                />
              </label>
            ))}
            <label className="space-y-1 text-xs font-bold">
              <span>{t('designerForm.rotation')}</span>
              <Input
                type="number"
                value={selectedField.rotation ?? 0}
                onChange={(e) => updatePatch({ rotation: Number(e.target.value) || 0 })}
              />
            </label>
          </div>

          {/* Text-like styling */}
          {isTextLikeField(selectedField) && (
            <div className="space-y-3 border-t border-chaos-black/15 pt-3">
              <label className="block space-y-1 text-xs font-bold">
                <span>{t('designerForm.fieldFont')}</span>
                <select
                  value={selectedField.fontId ?? ''}
                  onChange={(e) =>
                    updatePatch({
                      fontId: e.target.value || undefined,
                    } as Partial<TextStyleProps>)
                  }
                  className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
                >
                  <option value="">{t('designerForm.useTemplateDefault')}</option>
                  {extraFonts.length > 0 && (
                    <optgroup label={t('designer.uploadedFontsGroup')}>
                      {extraFonts.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {siteFonts.length > 0 && (
                    <optgroup label={t('designer.siteFontsGroup')}>
                      {siteFonts.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.fontSize')}</span>
                  <Input
                    type="number"
                    min={8}
                    value={selectedField.fontSize}
                    onChange={(e) =>
                      updatePatch({
                        fontSize: Math.max(8, Number(e.target.value) || 16),
                      } as Partial<TextStyleProps>)
                    }
                  />
                </label>
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.minFontSize')}</span>
                  <Input
                    type="number"
                    min={6}
                    value={selectedField.minFontSize ?? ''}
                    onChange={(e) =>
                      updatePatch({
                        minFontSize: e.target.value ? Number(e.target.value) : undefined,
                      } as Partial<TextStyleProps>)
                    }
                  />
                </label>
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.fontWeight')}</span>
                  <Input
                    value={selectedField.fontWeight ?? '700'}
                    onChange={(e) =>
                      updatePatch({ fontWeight: e.target.value } as Partial<TextStyleProps>)
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.color')}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={selectedField.color.startsWith('#') ? selectedField.color : '#0d0d0d'}
                      onChange={(e) =>
                        updatePatch({ color: e.target.value } as Partial<TextStyleProps>)
                      }
                      className="h-9 w-9 cursor-pointer rounded border border-chaos-black/30"
                    />
                    <Input
                      value={selectedField.color}
                      onChange={(e) =>
                        updatePatch({ color: e.target.value } as Partial<TextStyleProps>)
                      }
                    />
                  </div>
                </label>

                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.align')}</span>
                  <select
                    value={selectedField.align ?? 'left'}
                    onChange={(e) =>
                      updatePatch({ align: e.target.value as TextAlign } as Partial<TextStyleProps>)
                    }
                    className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
                  >
                    <option value="left">{t('designerForm.alignLeft')}</option>
                    <option value="center">{t('designerForm.alignCenter')}</option>
                    <option value="right">{t('designerForm.alignRight')}</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.verticalAlign')}</span>
                  <select
                    value={selectedField.verticalAlign ?? 'middle'}
                    onChange={(e) =>
                      updatePatch({
                        verticalAlign: e.target.value as VerticalAlign,
                      } as Partial<TextStyleProps>)
                    }
                    className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
                  >
                    <option value="top">{t('designerForm.vAlignTop')}</option>
                    <option value="middle">{t('designerForm.vAlignMiddle')}</option>
                    <option value="bottom">{t('designerForm.vAlignBottom')}</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.scaleX')}</span>
                  <Input
                    type="number"
                    min={10}
                    max={500}
                    step={5}
                    value={selectedField.scaleX ?? 100}
                    onChange={(e) => {
                      const next = Math.min(500, Math.max(10, Number(e.target.value) || 100))
                      updatePatch({
                        scaleX: next === 100 ? undefined : next,
                      } as Partial<TextStyleProps>)
                    }}
                  />
                </label>
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.scaleY')}</span>
                  <Input
                    type="number"
                    min={10}
                    max={500}
                    step={5}
                    value={selectedField.scaleY ?? 100}
                    onChange={(e) => {
                      const next = Math.min(500, Math.max(10, Number(e.target.value) || 100))
                      updatePatch({
                        scaleY: next === 100 ? undefined : next,
                      } as Partial<TextStyleProps>)
                    }}
                  />
                </label>
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.skewX')}</span>
                  <Input
                    type="number"
                    min={-45}
                    max={45}
                    step={1}
                    value={selectedField.skewX ?? 0}
                    onChange={(e) => {
                      const raw = Number(e.target.value)
                      const next = Number.isFinite(raw) ? Math.max(-45, Math.min(45, raw)) : 0
                      updatePatch({
                        skewX: next === 0 ? undefined : next,
                      } as Partial<TextStyleProps>)
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.letterSpacing')}</span>
                  <Input
                    type="number"
                    step={0.5}
                    value={selectedField.letterSpacing ?? 0}
                    onChange={(e) =>
                      updatePatch({
                        letterSpacing: Number(e.target.value) || 0,
                      } as Partial<TextStyleProps>)
                    }
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 pt-5 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedField.multiline)}
                    onChange={(e) =>
                      updatePatch({ multiline: e.target.checked } as Partial<TextStyleProps>)
                    }
                  />
                  <span>{t('designerForm.multiline')}</span>
                </label>
              </div>
            </div>
          )}

          {/* Type-specific extras */}
          {selectedField.type === 'text' && (
            <label className="block space-y-1 text-xs font-bold">
              <span>{t('designerForm.randomPattern')}</span>
              <Input
                value={selectedField.randomPattern ?? ''}
                placeholder="e.g. AMA-2026-####"
                onChange={(e) =>
                  updatePatch({
                    randomPattern: e.target.value || undefined,
                  } as Partial<TextFieldConfig>)
                }
              />
            </label>
          )}

          {selectedField.type === 'date' && (
            <div className="space-y-2 border-t border-chaos-black/15 pt-3">
              <label className="block space-y-1 text-xs font-bold">
                <span>{t('designerForm.dateFormat')}</span>
                <Input
                  value={selectedField.format ?? 'YYYY.MM.DD'}
                  onChange={(e) =>
                    updatePatch({ format: e.target.value } as Partial<DateFieldConfig>)
                  }
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DATE_FORMAT_PRESETS.map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() =>
                      updatePatch({
                        format: fmt,
                        calendar: /G|E/.test(fmt) ? 'japanese-era' : 'gregorian',
                      } as Partial<DateFieldConfig>)
                    }
                    className="cursor-pointer rounded border border-chaos-black/30 bg-chaos-black/5 px-2 py-0.5 font-mono text-[11px] font-bold hover:bg-yellow"
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(selectedField.fullWidth)}
                  onChange={(e) =>
                    updatePatch({
                      fullWidth: e.target.checked || undefined,
                    } as Partial<DateFieldConfig>)
                  }
                />
                <span>{t('designerForm.fullWidthDate')}</span>
              </label>
            </div>
          )}

          {selectedField.type === 'select-or-custom' && (
            <div className="space-y-2 border-t border-chaos-black/15 pt-3">
              <label className="block space-y-1 text-xs font-bold">
                <span>{t('designerForm.builtInPreset')}</span>
                <select
                  value={selectedField.presetId ?? ''}
                  onChange={(e) =>
                    updatePatch({
                      presetId: (e.target.value || undefined) as SelectOrCustomFieldConfig['presetId'],
                    } as Partial<SelectOrCustomFieldConfig>)
                  }
                  className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
                >
                  <option value="">{t('designerForm.noPresetOption')}</option>
                  <option value="salmon-run-ranks">{t('designerForm.salmonRunPreset')}</option>
                </select>
              </label>

              {!selectedField.presetId && (
                <label className="block space-y-1 text-xs font-bold">
                  <span>{t('designerForm.customOptions')}</span>
                  <textarea
                    rows={4}
                    value={(selectedField.options ?? []).map((o) => o.value).join('\n')}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean)
                      updatePatch({
                        options: lines.map((value) => ({ value })),
                      } as Partial<SelectOrCustomFieldConfig>)
                    }}
                    className="w-full rounded border-2 border-chaos-black/25 bg-white p-2 text-xs font-medium"
                  />
                </label>
              )}
            </div>
          )}

          {selectedField.type === 'photo' && (
            <div className="grid grid-cols-3 gap-2 border-t border-chaos-black/15 pt-3">
              <label className="space-y-1 text-xs font-bold">
                <span>{t('designerForm.photoRadius')}</span>
                <Input
                  type="number"
                  min={0}
                  value={selectedField.borderRadius ?? 0}
                  onChange={(e) =>
                    updatePatch({
                      borderRadius: Math.max(0, Number(e.target.value) || 0),
                    } as Partial<PhotoFieldConfig>)
                  }
                />
              </label>
              <label className="space-y-1 text-xs font-bold">
                <span>{t('designerForm.photoFit')}</span>
                <select
                  value={selectedField.fit ?? 'cover'}
                  onChange={(e) =>
                    updatePatch({
                      fit: e.target.value as 'cover' | 'contain',
                    } as Partial<PhotoFieldConfig>)
                  }
                  className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
                >
                  <option value="cover">{t('designerForm.fitCover')}</option>
                  <option value="contain">{t('designerForm.fitContain')}</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 pt-5 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(selectedField.grayscale)}
                  onChange={(e) =>
                    updatePatch({ grayscale: e.target.checked } as Partial<PhotoFieldConfig>)
                  }
                />
                <span>{t('designerForm.grayscale')}</span>
              </label>
            </div>
          )}

          {selectedField.type === 'barcode' && (
            <div className="space-y-2 border-t border-chaos-black/15 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.barcodeFormat')}</span>
                  <select
                    value={selectedField.format ?? 'CODE128'}
                    onChange={(e) =>
                      updatePatch({
                        format: e.target.value as BarcodeFieldConfig['format'],
                      } as Partial<BarcodeFieldConfig>)
                    }
                    className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
                  >
                    <option value="CODE128">CODE128</option>
                    <option value="CODE39">CODE39</option>
                    <option value="EAN13">EAN13</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.linkToField')}</span>
                  <select
                    value={selectedField.sourceFieldId ?? ''}
                    onChange={(e) =>
                      updatePatch({
                        sourceFieldId: e.target.value || undefined,
                      } as Partial<BarcodeFieldConfig>)
                    }
                    className="h-10 w-full rounded border-2 border-chaos-black/25 bg-white px-2 text-xs font-bold"
                  >
                    <option value="">{t('designerForm.standaloneInput')}</option>
                    {allTextFieldIds.map((fid) => (
                      <option key={fid} value={fid}>
                        {fid}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs font-bold">
                  <span>{t('designerForm.lineColor')}</span>
                  <Input
                    value={selectedField.lineColor ?? '#0d0d0d'}
                    onChange={(e) =>
                      updatePatch({ lineColor: e.target.value } as Partial<BarcodeFieldConfig>)
                    }
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 pt-5 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedField.displayValue)}
                    onChange={(e) =>
                      updatePatch({ displayValue: e.target.checked } as Partial<BarcodeFieldConfig>)
                    }
                  />
                  <span>{t('designerForm.showBarcodeText')}</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
