import { useSyncExternalStore } from 'react'
import { defineChain, getAddress, isAddress, type Address, type Chain } from 'viem'
import { ONCHAIN_CHAINS, requireChain } from '@/onchain-facts'

export type NetworkKey = 'testnet' | 'mainnet'

export interface NetworkInfo {
  key: NetworkKey
  label: string
  chainId: number
  chain: Chain
  isTestnet: boolean
  usdc: Address
}

function build(key: NetworkKey, isTestnet: boolean): NetworkInfo {
  const fact = ONCHAIN_CHAINS.find((c) => c.family === 'arc' && c.isTestnet === isTestnet)
  if (!fact) throw new Error('Arc ' + key + ' is missing from the onchain facts registry')
  const c = requireChain(fact.chainId)
  if (!c.usdc) throw new Error(c.name + ' has no USDC in the onchain facts registry')
  const chain = defineChain({
    id: c.chainId,
    name: c.name,
    nativeCurrency: { name: 'USDC', symbol: c.nativeCurrency.symbol, decimals: c.nativeCurrency.decimals },
    rpcUrls: { default: { http: [...c.rpcUrls] } },
    blockExplorers: { default: { name: 'Arc Explorer', url: c.explorerBase } },
    testnet: c.isTestnet,
  })
  return {
    key,
    label: isTestnet ? 'Arc Testnet' : 'Arc Mainnet',
    chainId: c.chainId,
    chain,
    isTestnet,
    usdc: getAddress(c.usdc.address),
  }
}

export const NETWORKS: Record<NetworkKey, NetworkInfo> = {
  testnet: build('testnet', true),
  mainnet: build('mainnet', false),
}

// ---------------------------------------------------------------------------
// SafeSend contract address, configurable per network.
// Priority: address saved in this browser (set by the Deploy page) > .env value.
//   VITE_SAFESEND_ADDRESS_TESTNET / VITE_SAFESEND_ADDRESS_MAINNET
// ---------------------------------------------------------------------------

const ENV_ADDRESS: Record<NetworkKey, string | undefined> = {
  testnet: import.meta.env.VITE_SAFESEND_ADDRESS_TESTNET as string | undefined,
  mainnet: import.meta.env.VITE_SAFESEND_ADDRESS_MAINNET as string | undefined,
}

const storageKey = (chainId: number) => 'safesend:contract:' + chainId
const listeners = new Set<() => void>()

function readSaved(chainId: number): string | null {
  try {
    return localStorage.getItem(storageKey(chainId))
  } catch {
    return null
  }
}

export type AddressSource = 'saved' | 'env' | 'none'

export function getContractAddress(net: NetworkInfo): Address | undefined {
  const raw = readSaved(net.chainId) || ENV_ADDRESS[net.key]
  return raw && isAddress(raw) ? getAddress(raw) : undefined
}

export function getAddressSource(net: NetworkInfo): AddressSource {
  const saved = readSaved(net.chainId)
  if (saved && isAddress(saved)) return 'saved'
  const env = ENV_ADDRESS[net.key]
  return env && isAddress(env) ? 'env' : 'none'
}

export function setSavedContractAddress(chainId: number, address: Address | null): void {
  try {
    if (address) localStorage.setItem(storageKey(chainId), address)
    else localStorage.removeItem(storageKey(chainId))
  } catch {
    // storage unavailable: address simply will not persist
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useContractAddress(net: NetworkInfo): Address | undefined {
  return useSyncExternalStore(subscribe, () => getContractAddress(net))
}

export function useAddressSource(net: NetworkInfo): AddressSource {
  return useSyncExternalStore(subscribe, () => getAddressSource(net))
}
