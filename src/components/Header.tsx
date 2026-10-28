import { ConnectKitButton } from 'connectkit'
import { ShieldCheck } from 'lucide-react'
import { NetworkArc } from '@web3icons/react'
import { useNetwork } from '@/hooks/useNetwork'
import { NETWORKS, type NetworkKey } from '@/lib/networks'

export function Header() {
  const { net, setNetworkKey } = useNetwork()

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
          <ShieldCheck className="size-5" aria-hidden />
        </div>
        <h1 className="display text-2xl font-bold">SafeSend</h1>
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="network">
          Network
        </label>
        <div className="glass relative flex min-h-11 items-center gap-1.5 rounded-2xl pl-3">
          <NetworkArc variant="branded" size={16} />
          <select
            id="network"
            value={net.key}
            onChange={(e) => setNetworkKey(e.target.value as NetworkKey)}
            className="min-h-11 cursor-pointer appearance-none bg-transparent py-2 pr-3 text-sm font-semibold outline-none"
          >
            {(Object.keys(NETWORKS) as NetworkKey[]).map((key) => (
              <option key={key} value={key}>
                {NETWORKS[key].label}
              </option>
            ))}
          </select>
        </div>
        <ConnectKitButton showBalance={false} />
      </div>
    </header>
  )
}
