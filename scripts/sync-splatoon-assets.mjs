import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const sourcePublicDir = path.join(rootDir, 'node_modules', 'splatoon-ui', 'public')
const targetPublicDir = path.join(rootDir, 'public')

// Copy static assets required by splatoon-ui styles (/fonts, /_images, /svgs).
// User/template assets live in public/templates and public/card-fonts so they never collide.
const assetDirs = ['_images', 'fonts', 'svgs']

if (!existsSync(sourcePublicDir)) {
  console.log('[sync-assets] splatoon-ui not installed yet, skipping asset copy.')
  process.exit(0)
}

mkdirSync(targetPublicDir, { recursive: true })

for (const dir of assetDirs) {
  const from = path.join(sourcePublicDir, dir)
  const to = path.join(targetPublicDir, dir)
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true })
  }
}

console.log('[sync-assets] Synced splatoon-ui static assets into public/.')
