import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanAllTemplateFonts, scanCardFontsDir } from '../../scripts/sync-card-fonts.mjs'
import { buildCardFontStack } from './index'

describe('bundled card fonts (public/templates/_fonts/ and per-template fonts/)', () => {
  it('scans font files, ignores non-fonts, and applies optional fonts.json overrides', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'splatoon-card-fonts-'))
    try {
      writeFileSync(path.join(tmpDir, 'README.md'), '# ignore me')
      writeFileSync(path.join(tmpDir, 'NotoSansJP-Bold.woff2'), 'dummy')
      writeFileSync(path.join(tmpDir, 'InkblotMincho.ttf'), 'dummy')
      writeFileSync(
        path.join(tmpDir, 'fonts.json'),
        JSON.stringify({
          'InkblotMincho.ttf': {
            id: 'inkblot-mincho',
            label: 'Inkblot Mincho (明朝)',
            family: 'InkblotMincho',
            weight: '700',
          },
        })
      )

      const results = scanCardFontsDir(tmpDir)
      expect(results).toEqual([
        {
          id: 'inkblot-mincho',
          family: 'InkblotMincho',
          label: 'Inkblot Mincho (明朝)',
          url: '/templates/_fonts/InkblotMincho.ttf',
          weight: '700',
        },
        {
          id: 'notosansjp-bold',
          family: 'CardFont_NotoSansJP-Bold',
          label: 'NotoSansJP Bold',
          url: '/templates/_fonts/NotoSansJP-Bold.woff2',
        },
      ])
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('indexes both shared _fonts/ and optional per-template fonts/ folders', () => {
    const tmpTemplates = mkdtempSync(path.join(os.tmpdir(), 'splatoon-templates-root-'))
    try {
      mkdirSync(path.join(tmpTemplates, '_fonts'), { recursive: true })
      mkdirSync(path.join(tmpTemplates, 'my-card', 'fonts'), { recursive: true })
      writeFileSync(path.join(tmpTemplates, '_fonts', 'Shared.otf'), 'dummy')
      writeFileSync(path.join(tmpTemplates, 'my-card', 'fonts', 'CardOnly.ttf'), 'dummy')

      const all = scanAllTemplateFonts(tmpTemplates)
      expect(all.map((f) => f.url)).toEqual([
        '/templates/_fonts/Shared.otf',
        '/templates/my-card/fonts/CardOnly.ttf',
      ])
    } finally {
      rmSync(tmpTemplates, { recursive: true, force: true })
    }
  })

  it('builds a clean CSS font-family stack preserving CJK fallbacks', () => {
    expect(buildCardFontStack('InkblotMincho', "'Hiragino Sans', sans-serif")).toBe(
      "'InkblotMincho', 'Hiragino Sans', sans-serif"
    )
    expect(buildCardFontStack(undefined, "'Hiragino Sans', sans-serif")).toBe(
      "'Hiragino Sans', sans-serif"
    )
  })
})
