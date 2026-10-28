import { useMemo } from 'react'
import { parseActivity, useActivityRaw } from '@/lib/activity'
import { Card, TxLink } from './ui'

export function ActivityList({ chainId }: { chainId: number }) {
  const raw = useActivityRaw()
  const items = useMemo(() => parseActivity(raw).filter((i) => i.chainId === chainId).slice(0, 6), [raw, chainId])
  if (items.length === 0) return null

  return (
    <Card>
      <h2 className="display mb-2 text-base font-semibold">Your recent transactions</h2>
      <ul className="divide-y divide-[var(--border)]">
        {items.map((item) => (
          <li key={item.hash} className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>{item.label}</span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-[var(--subtle)]">{new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <TxLink chainId={item.chainId} hash={item.hash} label="Explorer" />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
