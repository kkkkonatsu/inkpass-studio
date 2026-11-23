import * as React from 'react'

/**
 * Simple hash router for static GitHub Pages hosting.
 * Using `#/...` guarantees browser refreshes never hit a GitHub Pages 404.
 */
export type AppRoute =
  | { page: 'home' }
  | { page: 'editor'; templateId: string }
  | { page: 'designer'; templateId?: string }

export function parseHashRoute(hash: string): AppRoute {
  const cleaned = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '')

  if (!cleaned) {
    return { page: 'home' }
  }

  if (cleaned === 'designer') {
    return { page: 'designer' }
  }

  if (cleaned.startsWith('designer/')) {
    const templateId = decodeURIComponent(cleaned.slice('designer/'.length))
    return templateId ? { page: 'designer', templateId } : { page: 'designer' }
  }

  if (cleaned.startsWith('editor/')) {
    const templateId = decodeURIComponent(cleaned.slice('editor/'.length))
    if (templateId) {
      return { page: 'editor', templateId }
    }
  }

  return { page: 'home' }
}

export function buildHashPath(route: AppRoute): string {
  switch (route.page) {
    case 'home':
      return '#/'
    case 'designer':
      return route.templateId
        ? `#/designer/${encodeURIComponent(route.templateId)}`
        : '#/designer'
    case 'editor':
      return `#/editor/${encodeURIComponent(route.templateId)}`
  }
}

export function navigateTo(route: AppRoute): void {
  const nextHash = buildHashPath(route)
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

export function useHashRoute(): AppRoute {
  const [route, setRoute] = React.useState<AppRoute>(() =>
    typeof window === 'undefined' ? { page: 'home' } : parseHashRoute(window.location.hash)
  )

  React.useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHashRoute(window.location.hash))
      window.scrollTo({ top: 0, behavior: 'auto' })
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return route
}
