import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { shortAddress } from '@/lib/format'
import type { TxState } from '@/hooks/useTxRunner'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={'glass rounded-3xl p-4 sm:p-5 ' + className}>{children}</section>
}

type ButtonVariant = 'primary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const styles: Record<ButtonVariant, string> = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
    ghost: 'inner text-[var(--ink)] hover:bg-white',
    danger: 'bg-white text-[var(--danger)] border border-[var(--danger)]/40 hover:bg-[var(--danger)]/5',
  }
  return (
    <button
      {...rest}
      className={
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ' +
        styles[variant] +
        ' ' +
        className
      }
    >
      {children}
    </button>
  )
}

export function Spinner() {
  return <Loader2 className="size-4 animate-spin" aria-hidden />
}

export function TxLink({ chainId, hash, label = 'View on explorer' }: { chainId: number; hash: string; label?: string }) {
  return (
    <a
      href={buildTxExplorerUrl(chainId, hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-hover)] hover:underline"
    >
      {label} <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

export function AddressLink({ chainId, address, label }: { chainId: number; address: string; label?: string }) {
  return (
    <a
      href={buildAddressExplorerUrl(chainId, address)}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      className="mono inline-flex items-center gap-1 text-xs text-[var(--ink-2)] hover:underline"
    >
      {label ?? shortAddress(address)} <ExternalLink className="size-3 opacity-60" aria-hidden />
    </a>
  )
}

export function Notice({
  tone,
  children,
}: {
  tone: 'success' | 'danger' | 'info'
  children: ReactNode
}) {
  const color = tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--accent-hover)'
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? AlertTriangle : CheckCircle2
  return (
    <div
      className="flex items-start gap-2.5 rounded-2xl p-3 text-sm"
      style={{ background: `color-mix(in srgb, ${color} 9%, white)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-4 shrink-0" style={{ color }} aria-hidden />
      <div className="min-w-0 text-pretty" style={{ color: 'var(--ink)' }}>
        {children}
      </div>
    </div>
  )
}

/** Renders real wallet / receipt state for the last transaction run. */
export function TxStatus({ state, chainId }: { state: TxState; chainId: number }) {
  if (state.status === 'idle') return null
  if (state.status === 'signing') {
    return (
      <div className="inner flex items-center gap-2 rounded-2xl p-3 text-sm" role="status">
        <Spinner /> Confirm &ldquo;{state.label}&rdquo; in your wallet...
      </div>
    )
  }
  if (state.status === 'confirming') {
    return (
      <div className="inner flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-sm" role="status">
        <span className="flex items-center gap-2">
          <Spinner /> Waiting for confirmation...
        </span>
        <TxLink chainId={chainId} hash={state.hash} />
      </div>
    )
  }
  if (state.status === 'success') {
    return (
      <Notice tone="success">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">{state.label} confirmed</span>
          <TxLink chainId={chainId} hash={state.hash} />
        </div>
      </Notice>
    )
  }
  return (
    <div
      className="flex items-start gap-2.5 rounded-2xl p-3 text-sm"
      style={
        state.cancelled
          ? undefined
          : { background: 'color-mix(in srgb, var(--danger) 8%, white)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)' }
      }
      role="alert"
    >
      <XCircle className="mt-0.5 size-4 shrink-0" style={{ color: state.cancelled ? 'var(--subtle)' : 'var(--danger)' }} aria-hidden />
      <span className="text-pretty">{state.message}</span>
    </div>
  )
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="display text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-pretty text-[var(--muted)]">{hint}</p>
    </div>
  )
}

export function StatusBadge({ status }: { status: number }) {
  const map: Record<number, { text: string; color: string }> = {
    1: { text: 'Pending', color: 'var(--accent-hover)' },
    2: { text: 'Claimed', color: 'var(--success)' },
    3: { text: 'Cancelled', color: 'var(--subtle)' },
  }
  const s = map[status] ?? { text: 'Unknown', color: 'var(--subtle)' }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 12%, white)` }}
    >
      {s.text}
    </span>
  )
}
