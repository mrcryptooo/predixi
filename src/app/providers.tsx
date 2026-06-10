'use client'

import { type ReactNode, useState, useEffect } from 'react'
import { MotionConfig }                        from 'framer-motion'
import { WagmiProvider }                       from 'wagmi'
import { reconnect }                           from 'wagmi/actions'
import { QueryClient, QueryClientProvider }    from '@tanstack/react-query'
import { wagmiConfig }                         from '@/config/wagmi'
import { logBaseAppContext, wasIntentionallyDisconnected } from '@/lib/base-app'
import { isShareSupported }                                from '@/lib/base-app-actions'
import { useReferralCapture }                              from '@/hooks/useReferralCapture'
import { useMiniApp }                                      from '@/hooks/useMiniApp'

// ─────────────────────────────────────────────────────────────────────────────
// App-wide side effects that need wagmi context
// Rendered once inside WagmiProvider + QueryClientProvider — never unmounts.
// ─────────────────────────────────────────────────────────────────────────────

function AppEffects() {
  useReferralCapture()
  useMiniApp()   // calls sdk.actions.ready() — dismisses Base Mini App splash screen
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Wallet/profile data stays fresh for 60 s — avoids redundant refetches
        // on mobile where network transitions are common.
        staleTime: 60_000,
      },
    },
  }))

  useEffect(() => {
    // ── Initial reconnect ───────────────────────────────────────────────────
    // Explicitly trigger wagmi reconnect after client mount.
    // With ssr:true wagmi serialises connection state to localStorage and
    // restores it here.  Calling reconnect() manually ensures this fires even
    // in embedded webview environments (Base App / Coinbase Wallet) where the
    // storage event may not fire reliably.
    // Skipped if the user intentionally disconnected — prevents silent re-auth.
    if (!wasIntentionallyDisconnected()) {
      reconnect(wagmiConfig)
        .then(() => console.info('[PrediXI] Reconnect: restored'))
        .catch(() => console.info('[PrediXI] Reconnect: first visit or cleared'))
    }

    // ── Visibility-change reconnect ─────────────────────────────────────────
    // In Base App / Coinbase Wallet, navigating away and back puts the webview
    // into hidden state then visible again.  Re-triggering reconnect here
    // prevents stale "disconnected" UI when the user returns.
    // Skipped if the user intentionally disconnected — prevents the app from
    // silently re-connecting after an explicit disconnect + app background.
    let visibilityReconnectScheduled = false
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (wasIntentionallyDisconnected()) return
      if (visibilityReconnectScheduled) return
      visibilityReconnectScheduled = true
      // Small delay — let the page paint before triggering RPC work
      setTimeout(() => {
        reconnect(wagmiConfig).catch(() => {/* silent */})
        visibilityReconnectScheduled = false
      }, 400)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // ── Debug context ───────────────────────────────────────────────────────
    logBaseAppContext()
    console.info(`[PrediXI] Share API supported: ${isShareSupported()}`)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return (
    // reducedMotion="user" makes every Framer Motion animation respect
    // the OS "prefers-reduced-motion" setting without touching individual components.
    <MotionConfig reducedMotion="user">
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <AppEffects />
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </MotionConfig>
  )
}
