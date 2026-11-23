# AGENTS.md — InkPass Studio

Guidance for AI coding agents working in this repository.

## Project Overview

**InkPass Studio** (`inkpass-studio`) is a 100% client-side, config-driven React 19 + TypeScript + Vite + Tailwind CSS v4 web app styled with `splatoon-ui` for creating fictional *Splatoon 3* ID cards, hosted statically on GitHub Pages (`#/...` hash routing).

- **Pure rendering & packaging engine (`src/engine/`):** Zero React dependencies. `canvas-renderer.ts` is shared across the Card Editor preview, Template Designer canvas, and PNG/PDF exporter so previews match exports 1:1.
- **Auto-discovered templates (`public/templates/<id>/`):** `src/templates/registry.ts` auto-discovers `config.json` and optional `CREDITS.txt` / `LICENSE.txt` files via `import.meta.glob`. Folders starting with `_` (such as `_fonts/`) are excluded from template discovery.
- **Bundled card fonts (`public/templates/_fonts/`):** Indexed into `src/fonts/card-fonts.json` by `scripts/sync-card-fonts.mjs` (runs automatically on `npm run dev` and `npm run build`).

## Verification Commands

Always run these after code changes:

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run (unit tests, i18n key parity, template registry checks)
npm run build       # sync-card-fonts + tsc --noEmit + vite build
```

## Key Invariants & Gotchas

1. **Preserve user artwork & fonts in `public/templates/`**
   - Never overwrite or delete real artwork, configs, or font binaries inside `public/templates/grizzco-staff-id/`, `public/templates/inkblot-student-id/`, or `public/templates/_fonts/` unless explicitly requested.

2. **Strict 4-locale i18n parity**
   - All UI strings live in `src/i18n/locales/{en,ja,zh-Hans,zh-Hant}.json`.
   - `src/i18n/i18n.test.ts` fails if any locale is missing or has extra nested keys — always update all 4 JSON files together.

3. **IndexedDB persistence (`src/engine/template-storage.ts`)**
   - Keep existing database/store names (`splatoon-id-studio-db`, `templates`, `drafts`, `designer-draft`) and `localStorage` draft keys intact so users don't lose saved templates or drafts.
   - Always serialize `Blob`s to plain `{ __inkpassBlob: true, type, bytes: ArrayBuffer }` via `serializeRecordForStorage` before `put()`, and deserialize (detaching legacy raw `Blob`s too) via `deserializeRecordFromStorage`. Re-saving IndexedDB-backed `Blob` handles over the same key throws Firefox/Safari `UnknownError`.
   - Always resolve IndexedDB write transactions on `tx.oncomplete` (not `req.onsuccess`) and reject on `tx.onerror` / `tx.onabort`.

4. **Template Designer lifecycle (`src/pages/DesignerPage.tsx`)**
   - **Clean vs. dirty drafts:** Loading a template or saving to browser persists `designer-draft` with `hasUnsavedChanges: false` so page refreshes keep the active template without triggering `Overwrite Unsaved Draft?`. Edits and `.json`/`.zip` imports persist `hasUnsavedChanges: true`.
   - **Mount restore guard:** Plain `#/designer` must only restore `designer-draft` once on mount (`loadedPlainDesignerRef`), never re-triggering when `importedPackages` or `isHydrating` changes during `Save to Browser`.
   - **Multi-tab safety:** `useDesignerTabLock` (`src/components/designer/use-designer-tab-lock.ts`) coordinates single-tab draft ownership via `BroadcastChannel`; never write or clear `designer-draft` while `isBlockedByOtherTab` is `true`.
   - **Unique field IDs:** Field ID edits in `FieldInspector.tsx` use a local draft committed on blur/Enter through `renameField` + `resolveUniqueFieldId`; `deduplicateTemplateFieldIds` heals duplicates on load.
   - **Standardized upload filenames:** Uploaded artwork is named `./<side-id>.<ext>`, `./<side-id>-overlay.<ext>`, and `./thumb.<ext>` via `buildStandardImagePath`, pruning unreferenced old blobs from `localImages`.
   - **Undo/Redo & Shortcuts:** 50-step history stack with 450ms coalescing for drags/nudges; global shortcuts pause when focus is inside `INPUT`/`TEXTAREA`/`SELECT`/`contentEditable` or when a modal is open. Keep `DesignerShortcutsModal.tsx` in sync if adding shortcuts.

5. **Canvas text rendering (vertical alignment & letter spacing) & print bleed**
   - `drawTextField` in `src/engine/canvas-renderer.ts` uses `ctx.textBaseline = 'alphabetic'` + `measureAlphabeticCenterOffset` (measured on `'H'`) instead of `textBaseline = 'middle'` so CJK fonts with differing `hhea` vs `OS/2 sTypo` metrics (like `SourceHanSerifJP-Heavy.otf`) render identically across Firefox, Chrome, and Safari.
   - `drawTextField` renders non-zero `letterSpacing` manually grapheme-by-grapheme (via `Intl.Segmenter`) instead of `ctx.letterSpacing`, because Safari doesn't support `ctx.letterSpacing` and setting it before `measureText` double-counted spacing during auto-fit.
   - `EditorPage.tsx` defaults `exportBleedMm` to `0`.
   - `LiveCardPreview` passes `showTrimGuide={previewBleed.exportBleedMm > 0}` so the dashed cyan trim line appears only when bleed is active and is never baked into downloaded PNG/PDF exports.

6. **`splatoon-ui` styling quirks**
   - Modals using `splatoon-ui/dialog` (`DialogContent`) must include `!animate-none ![transform:translate(-50%,-50%)]` to suppress the default tilted pop-in animation.
   - `splatoon-ui/section` creates a stacking context (`z-[var(--z-deco)]`), so hover tooltips (`src/components/ui/HoverTooltip.tsx`) portal to `document.body` with `fixed z-[9999]` and viewport clamping.
   - Full-width `splatoon-ui/button` wrapping and symmetric CJK/Latin button padding overrides live in `src/index.css`.
