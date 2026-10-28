import { USDC_DECIMALS } from '@/onchain-facts'
import { formatUnitsFixed } from '@/onchain-money'

export const shortAddress = (a: string) => a.slice(0, 6) + '...' + a.slice(-4)

/** USDC base units to "1,234.50" (2 decimals, truncated). */
export function usd2(raw: bigint): string {
  const fixed = formatUnitsFixed(raw, USDC_DECIMALS, 2)
  const [whole, frac] = fixed.split('.')
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + frac
}

export const memoBytes = (memo: string) => new TextEncoder().encode(memo).length

/** Same first 6 and last 4 hex characters, but not the same address. */
export function looksLike(a: string, b: string): boolean {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x !== y && x.slice(2, 8) === y.slice(2, 8) && x.slice(-4) === y.slice(-4)
}

export function timeAgo(unixSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}
