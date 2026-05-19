/**
 * Phase 4D diagnostic script — run from inside predixi/ directory.
 * node test-sign.mjs
 */

import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'

const PRIVATE_KEY = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
const account     = privateKeyToAccount(PRIVATE_KEY)
const address     = account.address

const matchId  = 'pl-001'
const outcome  = 'H'
const signedAt = new Date().toISOString()

const message = [
  'PrediXI Prediction',
  'Action: Submit prediction',
  `Wallet: ${address.toLowerCase()}`,
  `Match ID: ${matchId}`,
  `Outcome: ${outcome}`,
  `Timestamp: ${signedAt}`,
].join('\n')

console.log('=== Signing message ===')
console.log(message)
console.log('=======================')

const walletClient = createWalletClient({
  account,
  chain:     mainnet,
  transport: http(),
})

const signature = await walletClient.signMessage({ message })
console.log('\nSignature:', signature)
console.log('Wallet:   ', address)

const body = JSON.stringify({
  walletAddress:    address,
  matchId,
  predictedOutcome: outcome,
  message,
  signature,
  signedAt,
  pointsAwarded:    10,
})

console.log('\n=== POST body ===')
console.log(body)
console.log('=================')

const res  = await fetch('http://localhost:3000/api/predictions', {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
})

const data = await res.json()
console.log(`\nHTTP Status: ${res.status}`)
console.log('Response:', JSON.stringify(data, null, 2))
