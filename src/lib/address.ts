/**
 * Truncates an Ethereum address to the form 0x1234…abcd.
 */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
