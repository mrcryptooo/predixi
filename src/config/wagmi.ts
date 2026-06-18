import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { baseAccount, injected, walletConnect } from 'wagmi/connectors'

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount(),
    injected(),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId, showQrModal: true })] : []),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
