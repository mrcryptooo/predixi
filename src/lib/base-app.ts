/**
 * Base App environment detection helpers.
 *
 * Safe, client-side only — reads navigator.userAgent and window.ethereum.
 * No analytics. No tracking. All functions return false/null on server (SSR).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal type — window.ethereum shape we care about
// ─────────────────────────────────────────────────────────────────────────────

type EthereumProvider = {
  isCoinbaseWallet?:  boolean
  isCoinbaseBrowser?: boolean
  isMetaMask?:        boolean
}

function getEthereum(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as Window & { ethereum?: EthereumProvider }).ethereum
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when running inside the Base App or Coinbase Wallet in-app
 * browser.  Detects via User-Agent string — no network requests.
 */
export function isBaseApp(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent ?? ''
  return /BaseApp/i.test(ua) || /CoinbaseBrowser/i.test(ua) || /CoinbaseWallet/i.test(ua)
}

/**
 * Returns true on any mobile device — UA-based, supplemented by screen width
 * as a fallback for unusual UA strings.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  if (/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    return true
  }
  // Fallback: narrow viewport is almost certainly mobile / tablet
  return window.innerWidth < 768
}

/**
 * Returns true when the injected ethereum provider is a Coinbase wallet
 * (either the mobile app in-app browser or the browser extension).
 * This means Base Account smart wallet flows are likely available.
 */
export function supportsBaseAccount(): boolean {
  const eth = getEthereum()
  if (!eth) return false
  return !!(eth.isCoinbaseWallet || eth.isCoinbaseBrowser)
}

/**
 * Returns a snapshot of the current Base App / wallet context.
 * Useful for conditional UI and for the debug logger.
 */
export function getBaseAppContext(): {
  isBaseApp:          boolean
  isMobile:           boolean
  supportsBaseAccount: boolean
  walletProvider:     string | null
} {
  const eth            = getEthereum()
  let walletProvider: string | null = null

  if (eth) {
    if (eth.isCoinbaseBrowser) walletProvider = 'coinbase-browser'
    else if (eth.isCoinbaseWallet) walletProvider = 'coinbase-wallet'
    else if (eth.isMetaMask)    walletProvider = 'metamask'
    else                        walletProvider = 'injected'
  }

  return {
    isBaseApp:           isBaseApp(),
    isMobile:            isMobileDevice(),
    supportsBaseAccount: supportsBaseAccount(),
    walletProvider,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intentional-disconnect guard
//
// When the user explicitly clicks "Disconnect", we set this flag so that the
// provider's auto-reconnect (on mount and on visibilitychange) does not silently
// re-establish the session.  The flag is cleared when the user manually taps
// "Connect", allowing normal reconnect behaviour from that point forward.
// ─────────────────────────────────────────────────────────────────────────────

const INTENTIONAL_DISCONNECT_KEY = 'predixi_wallet_intentional_disconnect'

/** Mark that the user explicitly disconnected — suppresses auto-reconnect. */
export function markIntentionalDisconnect(): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(INTENTIONAL_DISCONNECT_KEY, '1') } catch {}
}

/** Clear the flag — called before a manual connect so auto-reconnect resumes. */
export function clearIntentionalDisconnect(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(INTENTIONAL_DISCONNECT_KEY) } catch {}
}

/** Returns true if the user intentionally disconnected and has not reconnected yet. */
export function wasIntentionallyDisconnected(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(INTENTIONAL_DISCONNECT_KEY) === '1' } catch { return false }
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug logger — console only, no analytics, no tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Logs Base App context to the console.
 * Safe to call on every mount — output is grouped and collapsed by default.
 * No-op on server (SSR).
 */
export function logBaseAppContext(): void {
  if (typeof window === 'undefined') return

  const ctx          = getBaseAppContext()
  const shareSupported = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  console.groupCollapsed('[PrediXI] Environment')
  if (ctx.isBaseApp)            console.info('  Base App detected')
  if (ctx.isMobile)             console.info('  Mobile device detected')
  if (ctx.walletProvider)       console.info(`  Wallet provider: ${ctx.walletProvider}`)
  if (ctx.supportsBaseAccount)  console.info('  Base Account (Coinbase smart wallet) available')
  console.info(`  Share API supported: ${shareSupported}`)
  console.groupEnd()
}
