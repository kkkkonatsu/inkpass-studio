import * as React from 'react'

const CHANNEL_NAME = 'inkpass-designer-tab-lock'

type LockMessage =
  | { type: 'hello'; tabId: string }
  | { type: 'active'; tabId: string }
  | { type: 'claim'; tabId: string }
  | { type: 'release'; tabId: string }

function createTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export interface DesignerTabLockController {
  readonly tabId: string
  isBlocked: () => boolean
  takeOver: () => void
  destroy: () => void
}

/**
 * Coordinates single-tab ownership of the shared Designer draft across browser tabs
 * via `BroadcastChannel`. Only one tab actively auto-saves at a time; other open
 * Designer tabs pause auto-save until the user explicitly switches to them or the
 * active tab closes.
 */
export function createDesignerTabLock(
  onBlockedChange: (blocked: boolean) => void,
  ChannelCtor: typeof BroadcastChannel | undefined = typeof BroadcastChannel !== 'undefined'
    ? BroadcastChannel
    : undefined
): DesignerTabLockController {
  const tabId = createTabId()
  let blocked = false
  let destroyed = false
  let reclaimTimer: ReturnType<typeof setTimeout> | null = null

  const clearReclaimTimer = () => {
    if (reclaimTimer !== null) {
      clearTimeout(reclaimTimer)
      reclaimTimer = null
    }
  }

  const setBlocked = (next: boolean) => {
    if (blocked === next) return
    blocked = next
    onBlockedChange(next)
  }

  if (!ChannelCtor) {
    return {
      tabId,
      isBlocked: () => false,
      takeOver: () => {},
      destroy: () => {
        destroyed = true
      },
    }
  }

  const channel = new ChannelCtor(CHANNEL_NAME)

  const post = (msg: LockMessage) => {
    if (destroyed) return
    try {
      channel.postMessage(msg)
    } catch {
      // Ignore closed channel errors during teardown.
    }
  }

  channel.onmessage = (event: MessageEvent<LockMessage>) => {
    const msg = event.data
    if (!msg || msg.tabId === tabId) return

    switch (msg.type) {
      case 'hello':
        // If we are currently the active owner, tell the newcomer to pause auto-save.
        if (!blocked) {
          post({ type: 'active', tabId })
        }
        break
      case 'active':
      case 'claim':
        // Another tab owns or explicitly claimed the lock.
        clearReclaimTimer()
        setBlocked(true)
        break
      case 'release':
        // The active tab closed or navigated away; reclaim after a brief jitter so
        // if 3+ tabs are open, only one wins cleanly.
        if (blocked && reclaimTimer === null) {
          const jitterMs = 15 + Math.floor(Math.random() * 40)
          reclaimTimer = setTimeout(() => {
            reclaimTimer = null
            if (destroyed || !blocked) return
            setBlocked(false)
            post({ type: 'active', tabId })
          }, jitterMs)
        }
        break
    }
  }

  const releaseIfOwner = () => {
    if (!blocked) {
      post({ type: 'release', tabId })
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', releaseIfOwner)
    window.addEventListener('pagehide', releaseIfOwner)
  }

  // Announce presence so an already-open active tab can respond.
  post({ type: 'hello', tabId })

  return {
    tabId,
    isBlocked: () => blocked,
    takeOver: () => {
      clearReclaimTimer()
      setBlocked(false)
      post({ type: 'claim', tabId })
    },
    destroy: () => {
      if (destroyed) return
      clearReclaimTimer()
      releaseIfOwner()
      destroyed = true
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', releaseIfOwner)
        window.removeEventListener('pagehide', releaseIfOwner)
      }
      try {
        channel.close()
      } catch {
        // Ignore teardown errors.
      }
    },
  }
}

export function useDesignerTabLock(): {
  isBlockedByOtherTab: boolean
  takeOverTab: () => void
} {
  const [isBlockedByOtherTab, setIsBlockedByOtherTab] = React.useState(false)
  const controllerRef = React.useRef<DesignerTabLockController | null>(null)

  React.useEffect(() => {
    const controller = createDesignerTabLock(setIsBlockedByOtherTab)
    controllerRef.current = controller
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  const takeOverTab = React.useCallback(() => {
    controllerRef.current?.takeOver()
  }, [])

  return { isBlockedByOtherTab, takeOverTab }
}
