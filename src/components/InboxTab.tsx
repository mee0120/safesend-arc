import { useAccount, useWriteContract } from 'wagmi'
import { Inbox as InboxIcon } from 'lucide-react'
import { safeSendAbi, Status } from '@/contracts/safesend'
import { useNetwork } from '@/hooks/useNetwork'
import { useTxRunner } from '@/hooks/useTxRunner'
import { useMyTransfers, useTransferById } from '@/hooks/useSafeSendData'
import { ConnectKitButton } from 'connectkit'
import { Button, Card, Empty, Notice, Spinner, TxStatus } from './ui'
import { TransferRow } from './TransferRow'


function InboxBody({ highlightId }: { highlightId?: bigint }) {
  const { address: me, isConnected } = useAccount()
  const { net, contract } = useNetwork()
  const tx = useTxRunner(net.chainId)
  const { writeContractAsync } = useWriteContract()
  const inbox = useMyTransfers('recipient', me)

  if (!contract) return <Notice tone="danger">SafeSend is not set up on {net.label} yet.</Notice>
  if (!isConnected) return <Card><Empty title="Connect your wallet" hint="Connect to see transfers waiting for you." /></Card>
  if (inbox.isLoading) return <Card><div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted)]"><Spinner /> Loading your inbox...</div></Card>
  if (inbox.isError) return <Notice tone="danger">Could not load your inbox. Check your connection and try again.</Notice>

  const all = inbox.data ?? []
  const pending = all.filter((t) => t.status === Status.Pending)
  const claimed = all.filter((t) => t.status === Status.Claimed).slice(0, 5)

  function claim(id: bigint) {
    if (!contract) return
    void tx.run([
      {
        label: 'Claim',
        send: () =>
          writeContractAsync({
            address: contract,
            abi: safeSendAbi,
            functionName: 'claim',
            args: [id],
            chainId: net.chainId,
          }),
      },
    ])
  }

  return (
    <div className="space-y-4">
      <TxStatus state={tx.state} chainId={net.chainId} />
      <Card>
        <h2 className="display mb-3 flex items-center gap-2 text-lg font-semibold">
          <InboxIcon className="size-4 text-[var(--muted)]" aria-hidden /> Waiting for you
        </h2>
        {pending.length === 0 ? (
          <Empty title="Nothing to claim" hint="When someone sends you USDC, it shows up here until you claim it." />
        ) : (
          <ul className="space-y-2.5">
            {pending.map((t) => (
              <TransferRow
                key={t.id.toString()}
                transfer={t}
                counterparty={t.sender}
                direction="from"
                chainId={net.chainId}
                highlight={highlightId !== undefined && t.id === highlightId}
                action={
                  <Button onClick={() => claim(t.id)} disabled={tx.busy} className="min-h-11 px-5">
                    Claim
                  </Button>
                }
              />
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <p className="mt-3 text-xs text-pretty text-[var(--muted)]">
            Claiming sends the full amount to your wallet and lets this sender pay you directly next time.
          </p>
        )}
      </Card>

      {claimed.length > 0 && (
        <Card>
          <h2 className="display mb-3 text-lg font-semibold">Recently claimed</h2>
          <ul className="space-y-2.5">
            {claimed.map((t) => (
              <TransferRow key={t.id.toString()} transfer={t} counterparty={t.sender} direction="from" chainId={net.chainId} showStatus />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/** Explains what a ?claim=<id> link points at, and what is needed to claim it. */
function ClaimLinkBanner({ id }: { id: bigint }) {
  const { address: me, isConnected } = useAccount()
  const { net, contract } = useNetwork()
  const { transfer, isLoading, isError } = useTransferById(id)

  if (!contract) return null
  if (isLoading) {
    return (
      <div className="inner flex items-center gap-2 rounded-2xl p-3 text-sm text-[var(--muted)]">
        <Spinner /> Looking up transfer #{id.toString()}...
      </div>
    )
  }
  if (isError) return <Notice tone="danger">Could not load transfer #{id.toString()}. Check your connection and try again.</Notice>
  if (!transfer || transfer.status === Status.None) {
    return <Notice tone="danger">Transfer #{id.toString()} was not found on {net.label}. Check that the link is for this network.</Notice>
  }
  if (transfer.status !== Status.Pending) {
    return (
      <Notice tone="info">
        Transfer #{id.toString()} was already {transfer.status === Status.Claimed ? 'claimed' : 'cancelled by the sender'}.
      </Notice>
    )
  }
  const isRecipient = !!me && me.toLowerCase() === transfer.recipient.toLowerCase()
  if (isRecipient) {
    return <Notice tone="success">Transfer #{id.toString()} is waiting for you. Press Claim below.</Notice>
  }
  return (
    <Notice tone="info">
      <div className="space-y-2">
        <p className="font-semibold">Connect the wallet 0x…{transfer.recipient.slice(-4)} to claim this</p>
        <p className="mono break-all text-[11px] text-[var(--muted)]">{transfer.recipient}</p>
        {isConnected ? (
          <p className="text-xs text-[var(--muted)]">Your connected wallet is a different address. Switch accounts in your wallet.</p>
        ) : (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <Button onClick={show} className="min-h-10 px-4">
                Connect wallet
              </Button>
            )}
          </ConnectKitButton.Custom>
        )}
      </div>
    </Notice>
  )
}

export function InboxTab({ highlightId }: { highlightId?: bigint }) {
  return (
    <div className="space-y-4">
      {highlightId !== undefined && <ClaimLinkBanner id={highlightId} />}
      <InboxBody highlightId={highlightId} />
    </div>
  )
}
