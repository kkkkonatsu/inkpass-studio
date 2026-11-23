import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { I18nProvider } from '@/i18n'
import { DesignerPage } from '@/pages/DesignerPage'
import { EditorPage } from '@/pages/EditorPage'
import { HomePage } from '@/pages/HomePage'
import { useHashRoute } from '@/router'
import { RuntimeTemplatesProvider } from '@/templates/runtime-store'

function AppShell() {
  const route = useHashRoute()

  return (
    <div className="flex min-h-screen flex-col bg-white text-chaos-black">
      <Header route={route} />

      <main className="flex-1">
        {route.page === 'home' && <HomePage />}
        {route.page === 'editor' && <EditorPage templateId={route.templateId} />}
        {route.page === 'designer' && <DesignerPage initialTemplateId={route.templateId} />}
      </main>

      <Footer />
    </div>
  )
}

export function App() {
  return (
    <I18nProvider>
      <RuntimeTemplatesProvider>
        <AppShell />
      </RuntimeTemplatesProvider>
    </I18nProvider>
  )
}

export default App
