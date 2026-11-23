# Contributing Guide

Thank you for contributing to **InkPass Studio**! This codebase is designed so you can add new ID/document templates without editing a single line of TypeScript.

---

## 1. How to Contribute a New ID / Document Template

The easiest way to create and contribute a template is directly inside the built-in **Template Designer**, export it as a `.zip`, and extract it into `public/templates/`:

### Step 1 — Build the template in the Visual Designer
1. Open the live site (or run `npm run dev` locally) and go to **Template Designer** (`#/designer`).
2. Click **New** in the toolbar (or start from an existing preset via **Load ▾**).
3. In the **Template & Assets** tab:
   - Upload your **Background Image** (and optional **Overlay Image**) for each side. Uploaded filenames are standardized automatically (`./front.png`, `./back.png`, `./front-overlay.png`), and `canvasSize` auto-matches your image dimensions.
   - Upload any custom `.ttf` / `.otf` / `.woff2` fonts (or choose one of the built-in site fonts).
   - Fill in **Template Name**, **Organization**, and **Description** (use the `EN / 日本語 / 简中 / 繁中` tabs for translations).
   - Set a clean, unique **Template ID** (e.g., `splatsville-library-card`). This is used as both the folder name and `config.json` `"id"`.
   - Set the finished **Physical Width / Height (mm)** (a standard CR80 ID card is `85.6 × 53.98 mm`) and optional **Template Bleed (mm)**.
   - Click **Generate from Sample** (or upload a custom image) to create a lightweight `thumb.png` for the Home gallery.
   - *(Recommended)* Fill out **Credits & License** (`CREDITS.txt` and `LICENSE.txt` — you can insert the credits starter template and pick a license preset).
4. In the **Fields** tab:
   - Add fields (`text`, `photo`, `date`, `select-or-custom`, `splashtag-title`, `barcode`) and arrange them directly on the canvas.
   - Click **Keyboard Shortcuts** above the inspector for productivity shortcuts (`Shift` / `Alt` drag & resize, Smart Alignment Snap Guides, `Cmd/Ctrl + Z`, `C` / `V` / `D`, `W` clean preview, `[` / `]` layer order, and arrow-key nudging).

### Step 2 — Export as `.zip` & Extract into `public/templates/`
1. Click **Export ▾ → Download Template (.zip)** to download `<your-id>.zip`.
2. Extract the `<your-id>/` folder from the `.zip` into `public/templates/`:
   ```text
   public/templates/<your-id>/
     config.json
     front.png
     back.png           # optional
     front-overlay.png  # optional
     thumb.png          # optional
     CREDITS.txt        # optional
     LICENSE.txt        # optional
   ```
3. **If your `.zip` contains custom fonts in `_fonts/`:**
   - Copy any new font files not already in `public/templates/_fonts/` into `public/templates/_fonts/` (for shared fonts) or `public/templates/<your-id>/fonts/` (for a template-only font), and optionally add pretty labels in `public/templates/_fonts/fonts.json`.
   - Run `npm run sync-fonts` so `src/fonts/card-fonts.json` picks them up.
4. *(Tip)* Make sure `"id"` in `config.json` matches the folder name `<your-id>`. You can also set `"order"` in `config.json` to control where the template appears in the Home gallery.

> **Sharing without a PR:** You can also share your exported `.zip` directly with friends or the community — anyone can load it on the Home page via **Import Template (.zip)**!

### Step 3 — Verify & Open a Pull Request
Run the full check suite before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```

`src/templates/registry.test.ts` automatically discovers your folder in `public/templates/`, validates `config.json`, checks barcode `sourceFieldId` links, and verifies every referenced artwork and thumbnail file exists.

---

## 2. How to Bundle Shared Card Fonts (`public/templates/_fonts/`)

1. Drop `.woff2`, `.ttf`, `.otf`, or `.woff` font files into `public/templates/_fonts/` (or into `public/templates/<your-id>/fonts/` for a font used only by one template).
2. Run `npm run sync-fonts` (also runs automatically on `npm run dev` and `npm run build`). This updates `src/fonts/card-fonts.json`, making every font selectable in both the Card Editor and Template Designer.
3. *(Optional)* Edit `public/templates/_fonts/fonts.json` to customize display labels, IDs, or CSS family names.
4. Make sure any font you commit is appropriately licensed for redistribution, and credit it in `CREDITS.txt` / `ProjectCreditsModal.tsx`.

---

## 3. How to Add a New UI Language

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<locale-code>.json` and translate the values.
2. Register the new locale in `src/i18n/index.tsx` (`Locale`, `SUPPORTED_LOCALES`, `LOCALE_MESSAGES`, and `matchBrowserLocale`).
3. Run `npm test` — `src/i18n/i18n.test.ts` verifies every locale has the exact same set of nested keys as `en.json`.

---

## 4. Refreshing Official Splatoon 3 Presets

The Japanese Salmon Run 称号 (`src/presets/salmon-run-ranks.json`) and 二つ名 (`src/presets/splashtag-titles.json`) catalogs with English and Chinese translations come from [`Leanny/splat3`](https://github.com/Leanny/splat3). To refresh them after a game update:

```bash
npm run sync-presets
npm test
```
