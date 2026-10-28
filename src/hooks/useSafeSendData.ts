import { useQuery } from '@tanstack/react-query'
import { useReadContract, usePublicClient } from 'wagmi'
import { erc20Abi, type Address } from 'viem'
import { safeSendAbi, Status } from '@/contracts/safesend'
import { useNetwork } from '@/hooks/useNetwork'


export interface TransferView {
  id: bigint
  sender: Address
  recipient: Address
  amount: bigint
  createdAt: number
  status: number
  memo: string
}

const REFETCH_MS = 10_000

export function useUsdcBalance(owner: Address | undefined) {
  const { net } = useNetwork()
  return useReadContract({
    address: net.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    chainId: net.chainId,
    query: { enabled: !!owner, refetchInterval: REFETCH_MS },
  })
}

export function useAllowance(owner: Address | undefined) {
  const { net, contract } = useNetwork()
  return useReadContract({
    address: net.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner && contract ? [owner, contract] : undefined,
    chainId: net.chainId,
    query: { enabled: !!owner && !!contract, refetchInterval: REFETCH_MS },
  })
}

export function useIsVerified(owner: Address | undefined, recipient: Address | undefined) {
  const { net, contract } = useNetwork()
  return useReadContract({
    address: contract,
    abi: safeSendAbi,
    functionName: 'isVerified',
    args: owner && recipient ? [owner, recipient] : undefined,
    chainId: net.chainId,
    query: { enabled: !!contract && !!owner && !!recipient, refetchInterval: REFETCH_MS },
  })
}

/** All escrowed transfers I sent ('sender') or that are addressed to me ('recipient'), newest first. */
export function useMyTransfers(role: 'sender' | 'recipient', owner: Address | undefined) {
  const { net, contract } = useNetwork()
  const client = usePublicClient({ chainId: net.chainId })

  return useQuery({
    queryKey: ['safesend', 'transfers', net.chainId, contract, role, owner],
    enabled: !!client && !!contract && !!owner,
    refetchInterval: REFETCH_MS,
    queryFn: async (): Promise<TransferView[]> => {
      if (!client || !contract || !owner) return []
      const ids = await client.readContract({
        address: contract,
        abi: safeSendAbi,
        functionName: role === 'sender' ? 'idsBySender' : 'idsByRecipient',
        args: [owner],
      })
      if (ids.length === 0) return []
      const payments = await client.readContract({
        address: contract,
        abi: safeSendAbi,
        functionName: 'transfersOf',
        args: [ids],
      })
      return payments
        .map((p, i) => ({
          id: ids[i],
          sender: p.sender,
          recipient: p.recipient,
          amount: p.amount,
          createdAt: Number(p.createdAt),
          status: p.status,
          memo: p.memo,
        }))
        .reverse()
    },
  })
}

export interface VerifiedEntry {
  address: Address
  claimedCount: number
  totalClaimed: bigint
  lastClaimedAt: number
}

/**
 * My verified recipients. The contract has no list getter, so candidates come from my
 * claimed transfers and each one is confirmed with isVerified (removals drop out).
 */
export function useVerifiedBook(owner: Address | undefined) {
  const { net, contract } = useNetwork()
  const client = usePublicClient({ chainId: net.chainId })
  const sent = useMyTransfers('sender', owner)

  const claimed = (sent.data ?? []).filter((t) => t.status === Status.Claimed)
  const candidates = [...new Set(claimed.map((t) => t.recipient))]

  return useQuery({
    queryKey: ['safesend', 'book', net.chainId, contract, owner, candidates.join(',')],
    enabled: !!client && !!contract && !!owner && sent.isSuccess,
    refetchInterval: REFETCH_MS,
    queryFn: async (): Promise<VerifiedEntry[]> => {
      if (!client || !contract || !owner) return []
      const flags = await Promise.all(
        candidates.map((recipient) =>
          client.readContract({
            address: contract,
            abi: safeSendAbi,
            functionName: 'isVerified',
            args: [owner, recipient],
          }),
        ),
      )
      return candidates
        .filter((_, i) => flags[i])
        .map((address) => {
          const mine = claimed.filter((t) => t.recipient === address)
          return {
            address,
            claimedCount: mine.length,
            totalClaimed: mine.reduce((sum, t) => sum + t.amount, 0n),
            lastClaimedAt: Math.max(...mine.map((t) => t.createdAt)),
          }
        })
    },
  })
}

/** One transfer by id (public read, works without a connected wallet). Undefined while loading. */
export function useTransferById(id: bigint | undefined) {
  const { net, contract } = useNetwork()
  const query = useReadContract({
    address: contract,
    abi: safeSendAbi,
    functionName: 'transfersOf',
    args: id !== undefined ? [[id]] : undefined,
    chainId: net.chainId,
    query: { enabled: !!contract && id !== undefined, refetchInterval: REFETCH_MS },
  })
  const p = query.data?.[0]
  const transfer: Omit<TransferView, 'id'> | undefined = p
    ? { sender: p.sender, recipient: p.recipient, amount: p.amount, createdAt: Number(p.createdAt), status: p.status, memo: p.memo }
    : undefined
  return { transfer, isLoading: query.isLoading, isError: query.isError }
}
