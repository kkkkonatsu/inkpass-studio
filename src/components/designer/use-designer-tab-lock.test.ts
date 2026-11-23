import { describe, expect, it, vi } from 'vitest'
import { createDesignerTabLock } from './use-designer-tab-lock'

/** Minimal synchronous BroadcastChannel mock for testing multi-tab coordination. */
function createMockChannelClass() {
  const peersByName = new Map<string, Set<MockChannel>>()

  class MockChannel {
    readonly name: string
    onmessage: ((event: MessageEvent) => void) | null = null
    private closed = false

    constructor(name: string) {
      this.name = name
      let set = peersByName.get(name)
      if (!set) {
        set = new Set()
        peersByName.set(name, set)
      }
      set.add(this)
    }

    postMessage(data: unknown) {
      if (this.closed) return
      const peers = peersByName.get(this.name)
      if (!peers) return
      for (const peer of peers) {
        if (peer === this || peer.closed) continue
        peer.onmessage?.({ data } as MessageEvent)
      }
    }

    close() {
      this.closed = true
      peersByName.get(this.name)?.delete(this)
    }
  }

  return MockChannel as unknown as typeof BroadcastChannel
}

describe('createDesignerTabLock', () => {
  it('blocks a second Designer tab, supports explicit takeover, and unlocks when owner closes', () => {
    vi.useFakeTimers()
    try {
      const MockChannel = createMockChannelClass()
      const statesA: boolean[] = []
      const statesB: boolean[] = []

      const tabA = createDesignerTabLock((b) => statesA.push(b), MockChannel)
      expect(tabA.isBlocked()).toBe(false)

      // Opening a second tab detects Tab A and pauses auto-save in Tab B
      const tabB = createDesignerTabLock((b) => statesB.push(b), MockChannel)
      expect(tabA.isBlocked()).toBe(false)
      expect(tabB.isBlocked()).toBe(true)
      expect(statesB).toEqual([true])

      // Tab B explicitly takes over -> Tab A becomes paused
      tabB.takeOver()
      expect(tabB.isBlocked()).toBe(false)
      expect(tabA.isBlocked()).toBe(true)
      expect(statesA).toEqual([true])

      // Tab B closes -> Tab A automatically reclaims ownership
      tabB.destroy()
      vi.advanceTimersByTime(100)
      expect(tabA.isBlocked()).toBe(false)

      tabA.destroy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('degrades gracefully when BroadcastChannel is unavailable', () => {
    const onChange = vi.fn()
    const lock = createDesignerTabLock(onChange, undefined)
    expect(lock.isBlocked()).toBe(false)
    lock.takeOver()
    lock.destroy()
    expect(onChange).not.toHaveBeenCalled()
  })
})
