/**
 * useBodyScrollLock — prevents document body scroll while a modal is open.
 *
 * Ref-counted: safe to use from multiple concurrent overlays without
 * prematurely restoring scroll.
 *
 * Also sets touch-action: none on iOS to prevent rubber-band scrolling
 * behind the modal in Base App / Coinbase Wallet embedded webview.
 *
 * Usage:
 *   useBodyScrollLock(isOpen)
 */
import { useEffect } from 'react'

// Module-level counter — survives re-renders, safe across concurrent overlays
let lockCount = 0

export function useBodyScrollLock(active: boolean = true): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return

    lockCount++

    if (lockCount === 1) {
      // Capture current scroll position to prevent content jump on lock
      const scrollY = window.scrollY
      document.body.style.overflow         = 'hidden'
      document.body.style.overscrollBehavior = 'none'  // prevents pull-to-refresh without blocking inner scroll
      document.body.style.position         = 'fixed'
      document.body.style.top              = `-${scrollY}px`
      document.body.style.width            = '100%'
      // Note: touchAction is intentionally NOT set here — setting it on the body
      // cascades into modal scroll containers and blocks inner scroll on iOS webview.
    }

    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) {
        const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10))
        document.body.style.overflow           = ''
        document.body.style.overscrollBehavior = ''
        document.body.style.position           = ''
        document.body.style.top                = ''
        document.body.style.width              = ''
        // Restore scroll position exactly where the user was
        window.scrollTo(0, scrollY)
      }
    }
  }, [active])
}
