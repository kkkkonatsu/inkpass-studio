import { describe, expect, it } from 'vitest'
import { buildHashPath, parseHashRoute } from './router'

describe('hash router', () => {
  it('parses home, editor, and designer hash paths', () => {
    expect(parseHashRoute('')).toEqual({ page: 'home' })
    expect(parseHashRoute('#/')).toEqual({ page: 'home' })
    expect(parseHashRoute('#/designer')).toEqual({ page: 'designer' })
    expect(parseHashRoute('#/designer/inkblot-student-id')).toEqual({
      page: 'designer',
      templateId: 'inkblot-student-id',
    })
    expect(parseHashRoute('#/editor/inkblot-student-id')).toEqual({
      page: 'editor',
      templateId: 'inkblot-student-id',
    })
  })

  it('falls back to home on unknown paths', () => {
    expect(parseHashRoute('#/unknown/page')).toEqual({ page: 'home' })
    expect(parseHashRoute('#/editor/')).toEqual({ page: 'home' })
  })

  it('builds round-trippable hash paths', () => {
    expect(buildHashPath({ page: 'home' })).toBe('#/')
    expect(buildHashPath({ page: 'designer' })).toBe('#/designer')
    expect(buildHashPath({ page: 'designer', templateId: 'grizzco-staff-id' })).toBe(
      '#/designer/grizzco-staff-id'
    )
    expect(buildHashPath({ page: 'editor', templateId: 'grizzco-staff-id' })).toBe(
      '#/editor/grizzco-staff-id'
    )
  })
})
