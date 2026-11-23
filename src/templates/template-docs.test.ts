import { describe, expect, it } from 'vitest'
import {
  CREDITS_STARTER_TEMPLATE,
  LICENSE_PRESETS,
  classifyTemplateDocFilename,
  hasTemplateDocs,
  normalizeTemplateDocs,
} from './template-docs'

describe('template docs helpers & presets', () => {
  it('classifies credits and license filenames case-insensitively', () => {
    expect(classifyTemplateDocFilename('CREDITS.txt')).toBe('credits')
    expect(classifyTemplateDocFilename('my-card/credits.md')).toBe('credits')
    expect(classifyTemplateDocFilename('LICENSE.txt')).toBe('license')
    expect(classifyTemplateDocFilename('my-card/LICENSE')).toBe('license')
    expect(classifyTemplateDocFilename('licence.txt')).toBe('license')
    expect(classifyTemplateDocFilename('config.json')).toBeNull()
    expect(classifyTemplateDocFilename('front.png')).toBeNull()
  })

  it('normalizes empty or whitespace-only docs cleanly', () => {
    expect(hasTemplateDocs(undefined)).toBe(false)
    expect(hasTemplateDocs({ credits: '   ', license: '' })).toBe(false)
    expect(normalizeTemplateDocs({ credits: '  ', license: '' })).toBeUndefined()

    expect(hasTemplateDocs({ credits: 'Author: Inkling' })).toBe(true)
    expect(normalizeTemplateDocs({ credits: 'Author: Inkling', license: '  ' })).toEqual({
      credits: 'Author: Inkling',
    })
  })

  it('provides a credits starter template and localized license presets', () => {
    expect(CREDITS_STARTER_TEMPLATE).toContain('Template Author:')
    expect(LICENSE_PRESETS.length).toBeGreaterThanOrEqual(6)
    for (const preset of LICENSE_PRESETS) {
      expect(preset.name.trim().length).toBeGreaterThan(0)
      expect(preset.text.trim().length).toBeGreaterThan(20)
      expect(preset.summary.en).toBeTruthy()
      expect(preset.summary.ja).toBeTruthy()
      expect(preset.summary['zh-Hans']).toBeTruthy()
      expect(preset.summary['zh-Hant']).toBeTruthy()
    }
  })
})
