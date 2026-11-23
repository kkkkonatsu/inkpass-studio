import * as React from 'react'
import {
  collectTemplateValues,
  type CardFieldValues,
  type DocumentTemplateConfig,
} from '@/templates/schema'

function getStorageKey(templateId: string): string {
  return `splatoon-id-studio.draft.${templateId}`
}

function readDraft(template: DocumentTemplateConfig): CardFieldValues {
  const sampleDefaults = collectTemplateValues(template, 'sample')
  if (typeof window === 'undefined') return sampleDefaults

  try {
    const raw = window.localStorage.getItem(getStorageKey(template.id))
    if (!raw) return sampleDefaults
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CardFieldValues
    }
  } catch {
    // Fall back to sample values if storage is unavailable or corrupted.
  }

  return sampleDefaults
}

/**
 * Manages a template's form values with automatic `localStorage` draft persistence
 * (excluding large uploaded photo data URLs to stay well within browser storage limits).
 */
export function useDraftValues(template: DocumentTemplateConfig | undefined) {
  const [values, setValues] = React.useState<CardFieldValues>(() =>
    template ? readDraft(template) : {}
  )

  React.useEffect(() => {
    if (!template) {
      setValues({})
      return
    }
    setValues(readDraft(template))
  }, [template])

  React.useEffect(() => {
    if (!template || typeof window === 'undefined') return

    const photoIds = new Set(
      template.sides.flatMap((side) =>
        side.fields.filter((f) => f.type === 'photo').map((f) => f.id)
      )
    )

    const serializable: CardFieldValues = {}
    for (const [key, val] of Object.entries(values)) {
      if (!photoIds.has(key)) {
        serializable[key] = val
      }
    }

    try {
      window.localStorage.setItem(getStorageKey(template.id), JSON.stringify(serializable))
    } catch {
      // Ignore quota or privacy mode errors.
    }
  }, [template, values])

  const setFieldValue = React.useCallback((fieldId: string, nextValue: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: nextValue }))
  }, [])

  const fillSample = React.useCallback(() => {
    if (!template) return
    setValues((prev) => {
      const photoIds = new Set(
        template.sides.flatMap((side) =>
          side.fields.filter((f) => f.type === 'photo').map((f) => f.id)
        )
      )
      const preservedPhotos: CardFieldValues = {}
      for (const id of photoIds) {
        if (prev[id]) preservedPhotos[id] = prev[id]
      }
      return { ...collectTemplateValues(template, 'sample'), ...preservedPhotos }
    })
  }, [template])

  const clearAll = React.useCallback(() => {
    setValues({})
  }, [])

  return { values, setFieldValue, fillSample, clearAll }
}
