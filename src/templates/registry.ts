import type { DocumentTemplateConfig } from './schema'
import {
  classifyTemplateDocFilename,
  normalizeTemplateDocs,
  type TemplateDocs,
} from './template-docs'

/**
 * Auto-discovers every `public/templates/<id>/config.json` at dev/build time,
 * along with optional `CREDITS.txt` / `LICENSE.txt` files in each template folder.
 *
 * To add a new template:
 * 1. Create a folder `public/templates/<your-id>/`
 * 2. Put your `config.json`, artwork files (e.g. `front.png`, `back.png`),
 *    and optional `CREDITS.txt` / `LICENSE.txt` inside it
 * 3. Folders starting with `_` (such as `public/templates/_fonts/`) are ignored automatically.
 */
const configModules = import.meta.glob<{ default: DocumentTemplateConfig }>(
  '../../public/templates/*/config.json',
  { eager: true }
)

const docModules = import.meta.glob<string>(
  [
    '../../public/templates/*/CREDITS.txt',
    '../../public/templates/*/credits.txt',
    '../../public/templates/*/CREDITS.md',
    '../../public/templates/*/credits.md',
    '../../public/templates/*/LICENSE.txt',
    '../../public/templates/*/license.txt',
    '../../public/templates/*/LICENSE.md',
    '../../public/templates/*/license.md',
    '../../public/templates/*/LICENSE',
  ],
  { eager: true, query: '?raw', import: 'default' }
)

function getFolderName(filePath: string): string | null {
  const match = filePath.match(/\/templates\/([^/]+)\/[^/]+$/)
  return match?.[1] ?? null
}

const folderToTemplateId = new Map<string, string>()

export const TEMPLATES: readonly DocumentTemplateConfig[] = Object.entries(configModules)
  .filter(([filePath]) => !/\/templates\/_[^/]+\/config\.json$/.test(filePath))
  .map(([filePath, mod]) => {
    const folder = getFolderName(filePath)
    if (folder) {
      folderToTemplateId.set(folder, mod.default.id)
    }
    return mod.default
  })
  .sort((a, b) => {
    const orderDiff = (a.order ?? 999) - (b.order ?? 999)
    return orderDiff !== 0 ? orderDiff : a.id.localeCompare(b.id)
  })

const builtInDocsById = new Map<string, TemplateDocs>()

for (const [filePath, rawContent] of Object.entries(docModules)) {
  if (/\/templates\/_[^/]+\//.test(filePath)) continue
  const folder = getFolderName(filePath)
  const kind = classifyTemplateDocFilename(filePath)
  if (!folder || !kind || typeof rawContent !== 'string' || !rawContent.trim()) continue

  const templateId = folderToTemplateId.get(folder) ?? folder
  const existing = builtInDocsById.get(templateId) ?? {}
  if (!existing[kind]) {
    existing[kind] = rawContent
    builtInDocsById.set(templateId, existing)
  }
}

export function getTemplateById(id: string): DocumentTemplateConfig | undefined {
  return TEMPLATES.find((template) => template.id === id)
}

export function getBuiltInTemplateDocs(id: string): TemplateDocs | undefined {
  return normalizeTemplateDocs(builtInDocsById.get(id))
}
