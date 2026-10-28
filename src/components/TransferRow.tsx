import { useEffect, useRef, type ReactNode } from 'react'
import type { Address } from 'viem'
import { shortAddress, timeAgo, usd2 } from '@/lib/format'
import type { TransferView } from '@/hooks/useSafeSendData'
import { AddressLink, StatusBadge } from './ui'

export function TransferRow({
  transfer,
  counterparty,
  direction,
  chainId,
  nickname,
  action,
  showStatus,
  highlight,
}: {
  transfer: TransferView
  counterparty: Address
  direction: 'from' | 'to'
  chainId: number
  nickname?: string
  action?: ReactNode
  showStatus?: boolean
  highlight?: boolean
}) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlight])

  return (
    <li
      ref={ref}
      id={'transfer-' + transfer.id.toString()}
      className="inner rounded-2xl p-3.5"
      style={highlight ? { boxShadow: '0 0 0 2px var(--accent-hover)', background: 'color-mix(in srgb, var(--accent-hover) 7%, white)' } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[var(--muted)]">
            {direction === 'from' ? 'From' : 'To'}{' '}
            {nickname ? <span className="font-semibold text-[var(--ink)]">{nickname}</span> : null}
          </p>
          <AddressLink chainId={chainId} address={counterparty} label={nickname ? shortAddress(counterparty) : undefined} />
        </div>
        <div className="shrink-0 text-right">
          <p className="display text-xl font-bold tabular-nums">{usd2(transfer.amount)}</p>
          <p className="text-[11px] uppercase tracking-wider text-[var(--subtle)]">USDC</p>
        </div>
      </div>
      {transfer.memo && <p className="mt-2 text-sm text-pretty text-[var(--ink-2)]">&ldquo;{transfer.memo}&rdquo;</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-[var(--subtle)]">
          {showStatus && <StatusBadge status={transfer.status} />}
          <span className="tabular-nums">#{transfer.id.toString()}</span>
          <span>{timeAgo(transfer.createdAt)}</span>
        </span>
        {action}
      </div>
    </li>
  )
}
