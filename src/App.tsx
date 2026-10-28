import { useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { BookUser, Inbox, Send, Clock3, Rocket } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import type { Address } from 'viem'
import { NetworkProvider, useNetwork } from '@/hooks/useNetwork'
import { useMyTransfers, useUsdcBalance } from '@/hooks/useSafeSendData'
import { Status } from '@/contracts/safesend'
import { usd2 } from '@/lib/format'
import { Header } from '@/components/Header'
import { SendTab } from '@/components/SendTab'
import { InboxTab } from '@/components/InboxTab'
import { SentTab } from '@/components/SentTab'
import { AddressBookTab } from '@/components/AddressBookTab'
import { DeployPage } from '@/components/DeployPage'
import { ActivityList } from '@/components/ActivityList'
import { AddressLink, Button, Card, Notice } from '@/components/ui'

type Tab = 'send' | 'inbox' | 'sent' | 'book'

function readClaimParam(): bigint | undefined {
  const raw = new URLSearchParams(window.location.search).get('claim')
  return raw && /^\d{1,18}$/.test(raw) ? BigInt(raw) : undefined
}

function Shell() {
  const { address: me, isConnected, chainId: walletChainId } = useAccount()
  const { net, contract } = useNetwork()
  const { switchChain, isPending: switching } = useSwitchChain()
  // Opening a claim link (?claim=<id>) lands on the Inbox with that transfer highlighted.
  const [claimId] = useState<bigint | undefined>(readClaimParam)
  const [tab, setTab] = useState<Tab>(claimId !== undefined ? 'inbox' : 'send')
  const [view, setView] = useState<'app' | 'deploy'>('app')
  const [prefill, setPrefill] = useState<string | undefined>()

  const balance = useUsdcBalance(me)
  const inbox = useMyTransfers('recipient', me)
  const sent = useMyTransfers('sender', me)
  const inboxCount = (inbox.data ?? []).filter((t) => t.status === Status.Pending).length
  const sentCount = (sent.data ?? []).filter((t) => t.status === Status.Pending).length

  const tabs: { id: Tab; label: string; icon: typeof Send; count?: number }[] = [
    { id: 'send', label: 'Send', icon: Send },
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: inboxCount },
    { id: 'sent', label: 'Sent', icon: Clock3, count: sentCount },
    { id: 'book', label: 'Address book', icon: BookUser },
  ]

  const wrongNetwork = isConnected && walletChainId !== net.chainId

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[640px] space-y-4 px-4 pb-28 pt-5 sm:my-6 sm:min-h-0 sm:rounded-[2rem] sm:border sm:border-[var(--border)] sm:bg-white/50 sm:p-6 sm:pb-8 sm:shadow-[0_20px_60px_rgba(18,45,69,0.08)]">
      <Header />

      {view === 'deploy' ? (
        <DeployPage onBack={() => setView('app')} />
      ) : (
        <>
          <p className="px-1 text-sm font-medium text-pretty text-[var(--ink-2)]">
            Send → they claim → done. Wrong address? Cancel before they claim.
          </p>

          <Card>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--muted)]">Your USDC balance</span>
              <span className="text-xs text-[var(--subtle)]">{net.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="display text-4xl font-bold tabular-nums">
                {!isConnected ? '--' : balance.data === undefined ? '...' : usd2(balance.data)}
              </span>
              <span className="flex items-center gap-1 text-lg font-medium text-[var(--subtle)]">
                <TokenUSDC variant="branded" size={18} /> USDC
              </span>
            </div>
            {!isConnected && <p className="mt-1.5 text-xs text-[var(--muted)]">Connect a wallet to see your live balance.</p>}
          </Card>

          {wrongNetwork && (
            <Notice tone="info">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Your wallet is on a different network.</span>
                <Button
                  onClick={() => switchChain({ chainId: net.chainId })}
                  disabled={switching}
                  className="min-h-9 px-3"
                >
                  Switch to {net.label}
                </Button>
              </div>
            </Notice>
          )}

          {!contract && (
            <Notice tone="danger">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>SafeSend is not deployed on {net.label} yet.</span>
                <Button onClick={() => setView('deploy')} className="min-h-9 px-3">
                  Deploy contract
                </Button>
              </div>
            </Notice>
          )}

          <nav className="glass grid grid-cols-4 gap-1 rounded-3xl p-1.5" role="tablist" aria-label="SafeSend sections">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={
                  'relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold transition-colors ' +
                  (tab === id ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-2)] hover:bg-white/70')
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {!!count && (
                  <span className="absolute right-2 top-1 min-w-4 rounded-full bg-[var(--danger)] px-1 text-center text-[10px] font-bold leading-4 text-white tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div role="tabpanel">
            {tab === 'send' && <SendTab prefillTo={prefill} />}
            {tab === 'inbox' && <InboxTab highlightId={claimId} />}
            {tab === 'sent' && <SentTab />}
            {tab === 'book' && (
              <AddressBookTab
                onSendTo={(address: Address) => {
                  setPrefill(address)
                  setTab('send')
                }}
              />
            )}
          </div>

          <ActivityList chainId={net.chainId} />
        </>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 text-xs text-[var(--muted)]">
        {contract ? (
          <span className="flex items-center gap-1.5">
            Contract <AddressLink chainId={net.chainId} address={contract} />
          </span>
        ) : (
          <span>No contract on {net.label}</span>
        )}
        {view === 'app' && (
          <button onClick={() => setView('deploy')} className="inline-flex min-h-11 items-center gap-1 font-semibold text-[var(--accent-hover)]">
            <Rocket className="size-3.5" aria-hidden /> Deploy contract
          </button>
        )}
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <NetworkProvider>
      <Shell />
    </NetworkProvider>
  )
}
