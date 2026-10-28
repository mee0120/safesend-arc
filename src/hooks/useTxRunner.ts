import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, usePublicClient, useSwitchChain } from 'wagmi'
import type { Hash } from 'viem'
import { describeError } from '@/lib/errors'
import { recordActivity } from '@/lib/activity'


export type TxState =
  | { status: 'idle' }
  | { status: 'signing'; label: string }
  | { status: 'confirming'; label: string; hash: Hash }
  | { status: 'success'; label: string; hash: Hash }
  | { status: 'error'; message: string; cancelled: boolean }

export interface TxStep {
  /** Shown while the wallet prompt / confirmation is pending, e.g. "Allow USDC". */
  label: string
  /** Submits the transaction and returns its hash. */
  send: () => Promise<Hash>
}

/**
 * Runs one or more wallet transactions in order on `chainId`, switching the wallet
 * network first. State only ever reflects real wallet / receipt results.
 */
export function useTxRunner(chainId: number) {
  const { isConnected, chainId: walletChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: chainId })
  const queryClient = useQueryClient()
  const [state, setState] = useState<TxState>({ status: 'idle' })

  const run = useCallback(
    async (steps: TxStep[]): Promise<boolean> => {
      if (!isConnected) {
        setState({ status: 'error', message: 'Connect your wallet to continue.', cancelled: false })
        return false
      }
      try {
        if (walletChainId !== chainId) {
          await switchChainAsync({ chainId: chainId })
        }
        for (const step of steps) {
          setState({ status: 'signing', label: step.label })
          const hash = await step.send()
          setState({ status: 'confirming', label: step.label, hash })
          const receipt = await publicClient?.waitForTransactionReceipt({ hash })
          if (!receipt) throw new Error('Network issue: no RPC client for this chain.')
          if (receipt.status !== 'success') {
            throw new Error('The transaction was reverted onchain.')
          }
          recordActivity({ hash, label: step.label, chainId })
          setState({ status: 'success', label: step.label, hash })
        }
        await queryClient.invalidateQueries()
        return true
      } catch (error) {
        const { message, cancelled } = describeError(error)
        setState({ status: 'error', message, cancelled })
        return false
      }
    },
    [isConnected, walletChainId, chainId, switchChainAsync, publicClient, queryClient],
  )

  const reset = useCallback(() => setState({ status: 'idle' }), [])
  const busy = state.status === 'signing' || state.status === 'confirming'

  return { state, run, reset, busy }
}
