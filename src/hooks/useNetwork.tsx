import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Address } from 'viem'
import { NETWORKS, useContractAddress, type NetworkInfo, type NetworkKey } from '@/lib/networks'

const STORAGE_KEY = 'safesend:network'

interface NetworkContextValue {
  net: NetworkInfo
  setNetworkKey: (key: NetworkKey) => void
  /** SafeSend contract address for the selected network, if configured. */
  contract: Address | undefined
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

function initialKey(): NetworkKey {
  // A shared claim link names its network (?net=testnet|mainnet).
  const fromLink = new URLSearchParams(window.location.search).get('net')
  if (fromLink === 'mainnet' || fromLink === 'testnet') return fromLink
  // Arc Mainnet is the default; a network the user picked earlier is remembered.
  try {
    return localStorage.getItem(STORAGE_KEY) === 'testnet' ? 'testnet' : 'mainnet'
  } catch {
    return 'mainnet'
  }
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<NetworkKey>(initialKey)
  const net = NETWORKS[key]
  const contract = useContractAddress(net)

  const setNetworkKey = useCallback((next: NetworkKey) => {
    setKey(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable
    }
  }, [])

  const value = useMemo(() => ({ net, setNetworkKey, contract }), [net, setNetworkKey, contract])
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used inside NetworkProvider')
  return ctx
}
