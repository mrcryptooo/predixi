'use client'

import { useRef, useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Wallet, ChevronDown, LogOut, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/lib/address'
import { isBaseApp, markIntentionalDisconnect, clearIntentionalDisconnect } from '@/lib/base-app'

// ─────────────────────────────────────────────────────────────────────────────
// ConnectWallet
// Props:
//   compact — smaller variant for the mobile header
// ─────────────────────────────────────────────────────────────────────────────

interface ConnectWalletProps {
  compact?: boolean
  className?: string
}

export function ConnectWallet({ compact = false, className }: ConnectWalletProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied,       setCopied]       = useState(false)
  // mounted prevents a hydration mismatch: server always renders "disconnected",
  // but the client may reconnect immediately from wagmi storage.  Rendering a
  // neutral placeholder until after mount eliminates the flash.
  const [mounted,      setMounted]      = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // ── Copy address ────────────────────────────────────────────────────────────
  function handleCopy() {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  // ── Connect — prefer baseAccount, fall back to injected ─────────────────────
  function handleConnect() {
    // Clear intentional-disconnect flag so auto-reconnect resumes after this session
    clearIntentionalDisconnect()
    const preferred =
      connectors.find((c) => c.id === 'baseAccount') ??
      connectors.find((c) => c.id === 'injected') ??
      connectors[0]
    if (preferred) connect({ connector: preferred })
  }

  // ── Pre-mount placeholder — avoids hydration mismatch ──────────────────────
  // Render a same-size neutral skeleton until wagmi has hydrated on the client.
  if (!mounted) {
    return (
      <div className={cn(
        'rounded-xl border border-white/[0.07] bg-white/[0.03] animate-pulse',
        compact ? 'h-[30px] w-[80px]' : 'h-[42px] w-[180px]',
        className,
      )} />
    )
  }

  // ── Disconnected state ───────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        disabled={isPending}
        className={cn(
          'relative flex items-center gap-2 rounded-xl font-semibold transition-all duration-150',
          'bg-primary text-white border border-primary/60',
          'hover:bg-primary/90 hover:shadow-[0_0_16px_rgba(22,82,240,0.35)]',
          'active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed',
          compact
            ? 'text-[11px] px-2.5 py-1.5'
            : 'text-sm px-4 py-2.5',
          className
        )}
      >
        <Wallet size={compact ? 13 : 15} strokeWidth={2.2} className="flex-shrink-0" />
        {isPending
          ? 'Connecting…'
          : compact
            ? 'Connect'
            : isBaseApp()
              ? 'Connect via Base'
              : 'Connect Wallet'
        }
      </button>
    )
  }

  // ── Connected state — address pill + dropdown ────────────────────────────────
  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        onClick={() => setDropdownOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 rounded-xl font-medium transition-all duration-150',
          'bg-primary/10 border border-primary/25 text-primary',
          'hover:bg-primary/15 hover:border-primary/40',
          'active:scale-[0.97]',
          compact
            ? 'text-[11px] px-2.5 py-1.5'
            : 'text-sm px-3 py-2.5'
        )}
      >
        {/* Connected indicator dot */}
        <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
        <span className="font-mono">{address ? truncateAddress(address) : '—'}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={cn(
            'flex-shrink-0 transition-transform duration-150',
            dropdownOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div className={cn(
          'absolute z-50 mt-1.5 rounded-xl overflow-hidden',
          'bg-gradient-to-b from-[#0d1032] to-[#07091a]',
          'border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.55)]',
          compact ? 'right-0 w-44' : 'left-0 w-52'
        )}>
          {/* Address row */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-[9px] font-mono text-text-muted uppercase tracking-wider mb-1">
              Connected
            </p>
            <p className="text-[11px] font-mono text-white/80 break-all leading-snug">
              {address}
            </p>
          </div>

          <div className="h-px bg-white/[0.06] mx-3" />

          {/* Copy */}
          <button
            onClick={handleCopy}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5',
              'text-[12px] text-text-secondary hover:text-white hover:bg-white/5',
              'transition-colors duration-100'
            )}
          >
            {copied
              ? <Check size={13} className="text-success flex-shrink-0" />
              : <Copy size={13} className="flex-shrink-0" />
            }
            {copied ? 'Copied!' : 'Copy address'}
          </button>

          {/* Disconnect */}
          <button
            onClick={() => { markIntentionalDisconnect(); disconnect(); setDropdownOpen(false) }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 mb-1',
              'text-[12px] text-danger/80 hover:text-danger hover:bg-danger/5',
              'transition-colors duration-100'
            )}
          >
            <LogOut size={13} className="flex-shrink-0" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
