import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { BadgeCheck } from 'lucide-react'
import type { Address } from 'viem'
import { safeSendAbi } from '@/contracts/safesend'
import { useNetwork } from '@/hooks/useNetwork'
import { useTxRunner } from '@/hooks/useTxRunner'
import { useVerifiedBook } from '@/hooks/useSafeSendData'
import { useNicknames } from '@/lib/nicknames'
import { shortAddress, timeAgo, usd2 } from '@/lib/format'
import { AddressLink, Button, Card, Empty, Notice, Spinner, TxStatus } from './ui'


export function AddressBookTab({ onSendTo }: { onSendTo: (address: Address) => void }) {
  const { address: me, isConnected } = useAccount()
  const { net, contract } = useNetwork()
  const tx = useTxRunner(net.chainId)
  const { writeContractAsync } = useWriteContract()
  const book = useVerifiedBook(me)
  const { nameOf, setName } = useNicknames(me)
  const [confirming, setConfirming] = useState<string | null>(null)

  if (!contract) return <Notice tone="danger">SafeSend is not set up on {net.label} yet.</Notice>
  if (!isConnected) return <Card><Empty title="Connect your wallet" hint="Connect to see your verified recipients." /></Card>
  if (book.isLoading) return <Card><div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted)]"><Spinner /> Loading your address book...</div></Card>
  if (book.isError) return <Notice tone="danger">Could not load your address book. Check your connection and try again.</Notice>

  const entries = book.data ?? []

  function remove(address: Address) {
    if (!contract) return
    setConfirming(null)
    void tx.run([
      {
        label: 'Remove verification',
        send: () =>
          writeContractAsync({
            address: contract,
            abi: safeSendAbi,
            functionName: 'removeVerified',
            args: [address],
            chainId: net.chainId,
          }),
      },
    ])
  }

  return (
    <div className="space-y-4">
      <TxStatus state={tx.state} chainId={net.chainId} />
      <Card>
        <h2 className="display mb-1 flex items-center gap-2 text-lg font-semibold">
          <BadgeCheck className="size-4 text-[var(--success)]" aria-hidden /> Verified recipients
        </h2>
        <p className="mb-3 text-xs text-pretty text-[var(--muted)]">
          People who really claimed USDC from you. Nicknames are saved only in this browser.
        </p>
        {entries.length === 0 ? (
          <Empty title="No verified recipients yet" hint="After someone claims a transfer from you, they are added here." />
        ) : (
          <ul className="space-y-2.5">
            {entries.map((entry) => (
              <li key={entry.address} className="inner rounded-2xl p-3.5">
                <input
                  defaultValue={nameOf(entry.address) ?? ''}
                  onBlur={(e) => setName(entry.address, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  maxLength={32}
                  placeholder="Add a nickname"
                  aria-label={`Nickname for ${shortAddress(entry.address)}`}
                  className="display min-h-10 w-full bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-slate-400"
                />
                <AddressLink chainId={net.chainId} address={entry.address} />
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Claimed {entry.claimedCount}x · {usd2(entry.totalClaimed)} USDC total · last {timeAgo(entry.lastClaimedAt)}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => onSendTo(entry.address)} className="flex-1">
                    Send
                  </Button>
                  {confirming === entry.address ? (
                    <Button variant="danger" onClick={() => remove(entry.address)} disabled={tx.busy} className="flex-1">
                      Confirm remove
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirming(entry.address)} disabled={tx.busy} className="flex-1">
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {entries.length > 0 && (
          <p className="mt-3 text-xs text-pretty text-[var(--muted)]">
            Removing a recipient makes your next payment to them cancellable again, until they claim.
          </p>
        )}
      </Card>
    </div>
  )
}
