'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ReferralSuccessToast() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function handleEvent() {
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 4000)
      return () => clearTimeout(t)
    }
    window.addEventListener('predixi:referral-registered', handleEvent)
    return () => window.removeEventListener('predixi:referral-registered', handleEvent)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1     }}
          exit={{    opacity: 0, y: 16, scale: 0.97  }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={cn(
            'fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] pointer-events-none',
            'flex items-center gap-2.5 px-4 py-3 rounded-2xl',
            'glass-elevated border border-success/30',
            'shadow-[0_8px_32px_rgba(0,0,0,0.45)]',
          )}
        >
          <Zap size={14} className="text-success flex-shrink-0" />
          <span className="text-sm font-semibold text-white whitespace-nowrap">
            Referral activated! +200 XP on your way
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
