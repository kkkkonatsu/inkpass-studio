import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function resolveBasePath(): string {
  const raw = process.env.VITE_BASE_PATH?.trim()
  if (raw) {
    if (raw === './' || raw === '.') return './'
    const withLeading = raw.startsWith('/') ? raw : `/${raw}`
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
  }
  // Default to '/' (Cloudflare Pages, custom domains, local dev); GitHub Actions passes VITE_BASE_PATH.
  return '/'
}

/**
 * Rewrites hardcoded root-relative `/fonts/` and `/_images/` URLs bundled from `splatoon-ui`
 * so they resolve properly when deployed under a GitHub Pages subpath (e.g. `/inkpass-studio/`).
 */
function rewriteSplatoonAssetBase(base: string): Plugin {
  return {
    name: 'rewrite-splatoon-asset-base',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (base === '/') return
      const cssPrefix = base === './' ? '../' : base
      const jsPrefix = base

      for (const output of Object.values(bundle)) {
        if (output.type === 'asset' && output.fileName.endsWith('.css') && typeof output.source === 'string') {
          output.source = output.source.replace(
            /url\((['"]?)\/(fonts|_images|svgs)\//g,
            `url($1${cssPrefix}$2/`
          )
        } else if (output.type === 'chunk' && output.fileName.endsWith('.js')) {
          output.code = output.code.replace(
            /(['"`])\/(_images|fonts|svgs)(?=\/|['"`])/g,
            `$1${jsPrefix}$2`
          )
        }
      }
    },
  }
}

export default defineConfig(() => {
  const base = resolveBasePath()
  return {
    base,
    plugins: [react(), tailwindcss(), rewriteSplatoonAssetBase(base)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
