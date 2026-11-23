import * as React from 'react'
import { Keyboard, Layers, MousePointer2, Scissors } from 'lucide-react'
import { Button } from 'splatoon-ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'splatoon-ui/dialog'
import { useI18n } from '@/i18n'

interface DesignerShortcutsModalProps {
  open: boolean
  onClose: () => void
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border-2 border-chaos-black/80 bg-[#f5f0e8] px-1.5 py-0.5 font-mono text-[11px] leading-none font-black text-chaos-black shadow-[1px_1px_0px_#0d0d0d]">
      {children}
    </kbd>
  )
}

interface ShortcutRow {
  keys: string[]
  labelKey: string
}

function ShortcutGroup({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode
  title: string
  rows: ShortcutRow[]
}) {
  const { t } = useI18n()
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-chaos-black/75 uppercase">
        {icon}
        <span>{title}</span>
      </div>
      <ul className="divide-y divide-chaos-black/10 rounded-lg border-2 border-chaos-black/20 bg-white">
        {rows.map((row) => (
          <li
            key={row.labelKey}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
          >
            <span className="font-semibold text-chaos-black/85">{t(row.labelKey)}</span>
            <span className="flex shrink-0 items-center gap-1">
              {row.keys.map((key, idx) => (
                <React.Fragment key={`${row.labelKey}-${idx}`}>
                  {idx > 0 && <span className="text-[10px] font-bold text-chaos-black/45">+</span>}
                  <KeyCap>{key}</KeyCap>
                </React.Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DesignerShortcutsModal({ open, onClose }: DesignerShortcutsModalProps) {
  const { t } = useI18n()
  const isMac = React.useMemo(() => isMacPlatform(), [])
  const mod = isMac ? '⌘' : 'Ctrl'
  const alt = isMac ? '⌥' : 'Alt'
  const del = isMac ? '⌫' : 'Del'

  const canvasRows: ShortcutRow[] = [
    { keys: ['Shift', 'Drag'], labelKey: 'shortcutsModal.shiftDrag' },
    { keys: [alt, 'Drag'], labelKey: 'shortcutsModal.altDrag' },
    { keys: ['Shift', 'Resize'], labelKey: 'shortcutsModal.shiftResize' },
    { keys: [alt, 'Resize'], labelKey: 'shortcutsModal.altResize' },
    { keys: [mod, 'Drag'], labelKey: 'shortcutsModal.disableSnap' },
    { keys: ['← ↑ ↓ →'], labelKey: 'shortcutsModal.nudge1px' },
    { keys: ['Shift', '← ↑ ↓ →'], labelKey: 'shortcutsModal.nudge10px' },
  ]

  const editRows: ShortcutRow[] = [
    { keys: [mod, 'Z'], labelKey: 'shortcutsModal.undo' },
    { keys: [mod, 'Shift', 'Z'], labelKey: 'shortcutsModal.redo' },
    { keys: [mod, 'C'], labelKey: 'shortcutsModal.copyField' },
    { keys: [mod, 'V'], labelKey: 'shortcutsModal.pasteField' },
    { keys: [mod, 'D'], labelKey: 'shortcutsModal.duplicateField' },
    { keys: [del], labelKey: 'shortcutsModal.deleteField' },
    { keys: ['Esc'], labelKey: 'shortcutsModal.deselect' },
  ]

  const viewRows: ShortcutRow[] = [
    { keys: ['W'], labelKey: 'shortcutsModal.togglePreview' },
    { keys: ['['], labelKey: 'shortcutsModal.sendBackward' },
    { keys: [']'], labelKey: 'shortcutsModal.bringForward' },
    { keys: [mod, 'Shift', '< / >'], labelKey: 'shortcutsModal.adjustFontSize' },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto !animate-none ![transform:translate(-50%,-50%)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-blue" />
            <span>{t('shortcutsModal.title')}</span>
          </DialogTitle>
          <DialogDescription>{t('shortcutsModal.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <ShortcutGroup
            icon={<MousePointer2 className="h-4 w-4 text-blue" />}
            title={t('shortcutsModal.groupCanvas')}
            rows={canvasRows}
          />
          <ShortcutGroup
            icon={<Scissors className="h-4 w-4 text-blue" />}
            title={t('shortcutsModal.groupEditing')}
            rows={editRows}
          />
          <ShortcutGroup
            icon={<Layers className="h-4 w-4 text-blue" />}
            title={t('shortcutsModal.groupView')}
            rows={viewRows}
          />

          <p className="text-[11px] font-medium text-chaos-black/60">
            {t('shortcutsModal.inputNote')}
          </p>

          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" variant="outline" hasChevron={false} onClick={onClose}>
              {t('docsModal.close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
