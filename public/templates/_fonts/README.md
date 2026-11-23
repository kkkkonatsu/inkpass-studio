# Shared Template Fonts (`public/templates/_fonts/`)

Drop any `.woff2`, `.ttf`, `.otf`, or `.woff` font files into this folder to make them available across all templates:
1. As selectable **Card Fonts** for users in the Card Editor.
2. As a **Template Default Font** (`defaultFontId`) or **Per-Field Font** (`fontId`) in any template's `config.json` (and in `#/designer`).

*(If a font is only used by one specific document, you can alternatively put it inside `public/templates/<template-id>/fonts/`.)*

After adding or removing font files here, run:

```bash
npm run sync-fonts
```

*(This also runs automatically when you run `npm run dev` or `npm run build`.)*

## Optional Pretty Names (`fonts.json`)

By default, font display names are derived from the filename (e.g. `NotoSansJP-Bold.woff2` → `NotoSansJP Bold`).
You can customize IDs, display labels, or CSS family names in `public/templates/_fonts/fonts.json`:

```json
{
  "wapuro-mincho.otf": {
    "id": "wapuro-mincho",
    "label": "ワープロ明朝 (Wapuro Mincho)",
    "family": "WapuroMincho"
  }
}
```
