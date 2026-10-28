import { useAccount, useWriteContract } from 'wagmi'
import { Send as SendIcon } from 'lucide-react'
import { safeSendAbi, Status } from '@/contracts/safesend'
import { useNetwork } from '@/hooks/useNetwork'
import { useTxRunner } from '@/hooks/useTxRunner'
import { useMyTransfers } from '@/hooks/useSafeSendData'
import { useNicknames } from '@/lib/nicknames'
import { Button, Card, Empty, Notice, Spinner, TxStatus } from './ui'
import { TransferRow } from './TransferRow'


export function SentTab() {
  const { address: me, isConnected } = useAccount()
  const { net, contract } = useNetwork()
  const tx = useTxRunner(net.chainId)
  const { writeContractAsync } = useWriteContract()
  const sent = useMyTransfers('sender', me)
  const { nameOf } = useNicknames(me)

  if (!contract) return <Notice tone="danger">SafeSend is not set up on {net.label} yet.</Notice>
  if (!isConnected) return <Card><Empty title="Connect your wallet" hint="Connect to see the transfers you sent." /></Card>
  if (sent.isLoading) return <Card><div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--muted)]"><Spinner /> Loading your transfers...</div></Card>
  if (sent.isError) return <Notice tone="danger">Could not load your transfers. Check your connection and try again.</Notice>

  const all = sent.data ?? []
  const pending = all.filter((t) => t.status === Status.Pending)
  const history = all.filter((t) => t.status !== Status.Pending)

  function cancel(id: bigint) {
    if (!contract) return
    void tx.run([
      {
        label: 'Cancel transfer',
        send: () =>
          writeContractAsync({
            address: contract,
            abi: safeSendAbi,
            functionName: 'cancel',
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
          <SendIcon className="size-4 text-[var(--muted)]" aria-hidden /> Pending
        </h2>
        {pending.length === 0 ? (
          <Empty title="No pending transfers" hint="Transfers to new recipients stay here, and can be cancelled, until they claim." />
        ) : (
          <ul className="space-y-2.5">
            {pending.map((t) => (
              <TransferRow
                key={t.id.toString()}
                transfer={t}
                counterparty={t.recipient}
                direction="to"
                chainId={net.chainId}
                nickname={nameOf(t.recipient)}
                action={
                  <Button variant="danger" onClick={() => cancel(t.id)} disabled={tx.busy} className="min-h-11 px-5">
                    Cancel
                  </Button>
                }
              />
            ))}
          </ul>
        )}
        {pending.length > 0 && (
          <p className="mt-3 text-xs text-pretty text-[var(--muted)]">
            Cancelling returns the full amount to your wallet. It stops working once the recipient claims.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="display mb-3 text-lg font-semibold">History</h2>
        {history.length === 0 ? (
          <Empty title="No history yet" hint="Claimed and cancelled transfers appear here." />
        ) : (
          <ul className="space-y-2.5">
            {history.map((t) => (
              <TransferRow
                key={t.id.toString()}
                transfer={t}
                counterparty={t.recipient}
                direction="to"
                chainId={net.chainId}
                nickname={nameOf(t.recipient)}
                showStatus
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
