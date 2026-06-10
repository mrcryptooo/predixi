/**
 * useMiniApp
 *
 * Initialises the Farcaster / Base Mini App SDK on client mount.
 *
 * - Calls sdk.actions.ready() to dismiss the splash screen inside the
 *   Base App / Warpcast frame shell. Without this call the app will be
 *   stuck on the splash screen indefinitely.
 * - Safe to call on every page load: when running outside a frame the
 *   call resolves immediately without side effects.
 * - Exposes isInMiniApp so components can adapt their UI accordingly.
 */

'use client'

import { useEffect, useState } from 'react'
import sdk from '@farcaster/frame-sdk'

export function useMiniApp() {
  const [isInMiniApp, setIsInMiniApp] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // Check whether we are running inside a Mini App shell.
        // sdk.isInMiniApp() resolves immediately in both environments.
        const inFrame = await sdk.isInMiniApp()
        if (cancelled) return

        setIsInMiniApp(inFrame)

        // Signal that the app is ready — dismisses the splash screen.
        // Must be called even when inFrame is false (the call is a no-op
        // outside of a frame context).
        await sdk.actions.ready()
      } catch {
        // Running outside a frame or SDK not available — safe to ignore.
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  return { isInMiniApp }
}
