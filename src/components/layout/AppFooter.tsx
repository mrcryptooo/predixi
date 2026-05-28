import Link from 'next/link'

const LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms',   label: 'Terms'   },
  { href: '/support', label: 'Support' },
]

export function AppFooter() {
  return (
    <footer className="mt-10 border-t border-white/[0.05] px-4 py-5">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-[10px] font-mono text-white/20 tracking-widest uppercase select-none">
          PrediXI Beta · Built on Base
        </p>
        <nav className="flex items-center gap-5" aria-label="Legal">
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-[11px] font-mono text-white/25 hover:text-white/55 active:text-white/70 transition-colors duration-150"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
