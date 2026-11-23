# InkPass Studio

A 100% client-side, config-driven React web app for generating fictional *Splatoon 3* ID cards—including the **Inkblot Art Academy Student ID (海女美術大学 学生証明書)** and **Grizzco Industries Staff ID (クマサン商会 社員証)**—styled with [`splatoon-ui`](https://github.com/YoungSx/splatoon-ui) and hosted statically on GitHub Pages.

- **Live Site:** [inkpass.wenky.net](https://inkpass.wenky.net) · [kkkkonatsu.github.io/inkpass-studio](https://kkkkonatsu.github.io/inkpass-studio)
- **Repository:** [github.com/kkkkonatsu/inkpass-studio](https://github.com/kkkkonatsu/inkpass-studio)

> **Disclaimer:** Non-commercial fan-made project. Not affiliated with, authorized by, or endorsed by Nintendo Co., Ltd. *Splatoon* and all related names and motifs are trademarks or property of Nintendo Co., Ltd. All generated documents are fictional props. Individual templates belong to their respective authors and remain subject to their own licenses.

## Features

- **100% Client-Side & Private:** Runs purely in the browser via HTML5 Canvas 2D, `pdf-lib`, and IndexedDB. Uploaded photos, custom templates, and text never leave your device.
- **Config-Driven Templates & Shareable `.zip` Packages:** Every ID/document is defined by a self-contained folder (`config.json`, artwork, optional `CREDITS.txt` / `LICENSE.txt`, and fonts). Import community `.zip` templates directly on the Home page into your browser's **My Templates** section, or drop them into `public/templates/` to bundle them as built-in presets.
- **Built-In Visual Template Designer (`#/designer`):**
  - Upload backgrounds, foreground overlays, thumbnails (or auto-generate `thumb.png` from sample data), and custom `.ttf` / `.otf` / `.woff2` fonts — uploaded image filenames are standardized automatically (`front.png`, `front-overlay.png`, `thumb.png`).
  - Place, duplicate, reorder, and style fields visually with InDesign / Photoshop / Figma-style shortcuts (`Shift` / `Alt` drag & resize, Smart Alignment Snap Guides, Undo/Redo, Copy/Paste/Duplicate, `W` clean preview, `[` / `]` layer order, font size nudging) and an in-app **Keyboard Shortcuts** guide.
  - Supports multi-language template metadata (`EN / 日本語 / 简中 / 繁中`), horizontal/vertical text scaling (`scaleX` / `scaleY`), faux-italic skew (`skewX`), full-width (`全角`) dates, and optional `CREDITS.txt` / `LICENSE.txt` with license presets.
  - Auto-saves working drafts to IndexedDB (with cross-tab protection), saves finished templates directly to your browser, and exports self-contained `.zip` packages.
- **Splatoon 3 Presets:** Built-in official *Splatoon 3* Japanese **Salmon Run 称号** and **1,000+ 二つ名 (Splashtag Titles)** with localized search/hints and custom free-text override.
- **Western ↔ Japanese Era (和暦) Date Converter:** Enter either `YYYY-MM-DD` or `令和/平成/昭和/大正/明治` and watch both stay synchronized.
- **Flexible Print-Ready Exports:** Export as high-DPI **PNG** or **PDF** (exact physical mm card size OR printable A4 sheet with corner crop marks), **Filled** or **Blank Template**, with adjustable print bleed (`0 mm` trimmed default up to full template bleed, previewed with dashed trim guides).
- **4-Language UI:** English, 日本語, 简体中文, 繁體中文 — easy to extend to more languages.

## Quick Start

```bash
npm install
npm run dev
```

`npm install` automatically syncs `splatoon-ui` static assets and indexes bundled card fonts via `postinstall`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Sync card fonts and start the Vite dev server |
| `npm run build` | Sync card fonts, type-check, and build static `dist/` for GitHub Pages |
| `npm test` | Run Vitest unit, i18n parity, and template registry validation tests |
| `npm run typecheck` | Run TypeScript strict type-checking |
| `npm run sync-assets` | Re-copy `splatoon-ui` static assets into `public/` |
| `npm run sync-fonts` | Re-index bundled card fonts from `public/templates/` into `src/fonts/card-fonts.json` |
| `npm run sync-presets` | Refresh official Splatoon 3 称号 & 二つ名 JSONs from `Leanny/splat3` |

## Project Structure

```text
public/
  templates/
    _fonts/               # Shared card fonts (.woff2 / .otf / .ttf) + fonts.json
    <template-id>/        # 1 self-contained folder per document (auto-discovered!)
      config.json         # Layout, bleed, fonts, fields (uses relative ./ paths)
      front.png           # Artwork (+ optional back.png, front-overlay.png, thumb.png)
      CREDITS.txt         # Optional author/asset credits shown in the Card Editor
      LICENSE.txt         # Optional license terms shown in the Card Editor
src/
  engine/                 # Pure TypeScript rendering, export & packaging (zero React dependency)
    canvas-renderer.ts    # Shared Canvas 2D renderer (Editor + Designer + Exporter)
    bleed.ts              # Print bleed cropping & physical mm geometry
    exporter.ts           # PNG & pdf-lib export (exact card mm + A4 print sheet)
    template-zip.ts       # Self-contained template .zip exporter & importer
    template-storage.ts   # IndexedDB persistence for browser templates & Designer drafts
    japanese-era.ts       # Bidirectional 西暦 <-> 和暦 converter
    barcode.ts            # jsbarcode wrapper
    font-loader.ts        # Browser FontFace API loader
  presets/                # Official Japanese 称号 & 二つ名 catalogs (lazy-loaded)
  templates/              # Schema, auto-discovery registry, docs/licenses, runtime store
  i18n/                   # Lightweight JSON-based UI translations (en, ja, zh-Hans, zh-Hant)
  components/             # Modular UI pieces (layout, editor, preview, designer, ui)
  pages/                  # HomePage, EditorPage, DesignerPage
```

## Deploying to GitHub Pages

1. Push to `main` and enable **Settings → Pages → Source: GitHub Actions**.
2. Optionally add a custom domain in **Settings → Pages** (and commit `public/CNAME`).
3. `.github/workflows/deploy.yml` runs tests, builds `dist/`, and publishes automatically.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for step-by-step guides on contributing new ID templates, bundled fonts, or UI languages.
