'use client'

import { useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet, Globe } from 'lucide-react'
import { useConnect } from 'wagmi'
import { cn } from '@/lib/utils'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { clearIntentionalDisconnect } from '@/lib/base-app'
import type { Connector } from 'wagmi'

interface WalletModalProps {
  open: boolean
  onClose: () => void
}

const CONNECTOR_ORDER: Record<string, number> = {
  baseAccount:   0,
  'app.base.account': 0,
  'com.coinbase.wallet': 1,
  'io.metamask': 2,
  'io.rabby':    3,
  injected:      90,
  walletConnect: 100,
}

const CONNECTOR_LABELS: Record<string, string> = {
  baseAccount:   'Coinbase Wallet',
  walletConnect: 'WalletConnect',
  injected:      'Browser Wallet',
}

function getOrder(c: Connector): number {
  if (c.id in CONNECTOR_ORDER) return CONNECTOR_ORDER[c.id]
  if (c.rdns && typeof c.rdns === 'string' && c.rdns in CONNECTOR_ORDER)
    return CONNECTOR_ORDER[c.rdns]
  return 50
}

function getLabel(c: Connector): string {
  if (c.id in CONNECTOR_LABELS) return CONNECTOR_LABELS[c.id]
  return c.name
}

function getDescription(c: Connector): string {
  if (c.id === 'baseAccount') return 'Smart Wallet + Extension'
  if (c.id === 'walletConnect') return 'QR code · Mobile wallets'
  if (c.id === 'injected') return 'Detected browser extension'
  if (c.rdns === 'io.metamask' || c.name?.toLowerCase().includes('metamask'))
    return 'Browser extension'
  if (c.rdns === 'io.rabby' || c.name?.toLowerCase().includes('rabby'))
    return 'Browser extension'
  return 'Browser extension'
}

export function WalletModal({ open, onClose }: WalletModalProps) {
  const { connect, connectors, isPending } = useConnect()

  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const displayConnectors = useMemo(() => {
    const seen = new Set<string>()
    const result: Connector[] = []

    for (const c of connectors) {
      const key = c.rdns && typeof c.rdns === 'string' ? c.rdns : c.id
      if (seen.has(key)) continue

      if (c.id === 'injected') {
        const hasEip6963 = connectors.some(
          (other) => other.id !== 'injected' && other.id !== 'baseAccount' &&
            other.id !== 'walletConnect' && other.type === 'injected',
        )
        if (hasEip6963) continue
      }

      seen.add(key)
      result.push(c)
    }

    return result.sort((a, b) => getOrder(a) - getOrder(b))
  }, [connectors])

  function handleSelect(connector: Connector) {
    clearIntentionalDisconnect()
    connect({ connector }, { onSuccess: () => onClose() })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="wallet-modal-backdrop"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
        >
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" />

          <motion.div
            key="wallet-modal-panel"
            className={cn(
              'relative z-10 w-full sm:max-w-sm bg-surface border border-border',
              'rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden',
            )}
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex items-center gap-2.5">
                <Wallet size={16} className="text-primary" />
                <h2 className="text-sm font-bold text-text-primary">Connect Wallet</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex w-8 h-8 rounded-xl bg-elevated border border-border items-center justify-center hover:border-primary/30 transition-colors text-text-muted hover:text-text-primary"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mx-5 border-t border-border" />

            {/* Connector list */}
            <div className="p-3 space-y-1.5">
              {displayConnectors.map((c) => (
                <button
                  key={c.uid}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSelect(c)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl',
                    'border border-transparent transition-all duration-150',
                    'hover:bg-white/[0.04] hover:border-white/[0.08]',
                    'active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait',
                  )}
                >
                  <ConnectorIcon connector={c} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-semibold text-white/90 truncate">
                      {getLabel(c)}
                    </p>
                    <p className="text-[10px] text-white/40 font-mono truncate">
                      {getDescription(c)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-2">
              <p className="text-[10px] text-white/25 font-mono text-center leading-relaxed">
                Base Mainnet only
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ConnectorIcon({ connector }: { connector: Connector }) {
  const size = 'w-9 h-9'

  if (connector.icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={connector.icon}
        alt={connector.name}
        className={cn(size, 'rounded-xl object-contain flex-shrink-0')}
      />
    )
  }

  if (connector.id === 'walletConnect') {
    return (
      <div className={cn(size, 'rounded-xl bg-[#3B99FC]/15 border border-[#3B99FC]/25 flex items-center justify-center flex-shrink-0')}>
        <Globe size={18} className="text-[#3B99FC]" />
      </div>
    )
  }

  return (
    <div className={cn(size, 'rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0')}>
      <Wallet size={18} className="text-primary/60" />
    </div>
  )
}
