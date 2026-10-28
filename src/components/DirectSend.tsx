import { useState } from 'react'
import { Info, TriangleAlert } from 'lucide-react'
import { Button, Spinner } from './ui'

/**
 * Link under the recipient field for exchanges and smart contracts, which cannot call claim().
 * Offers a plain USDC transfer from the wallet (final, not cancellable).
 */
export function DirectSend({
  ready,
  hint,
  busy,
  connected,
  onSend,
}: {
  ready: boolean
  /** Why the button is disabled, shown while the form is incomplete. */
  hint?: string
  busy: boolean
  connected: boolean
  onSend: () => void
}) {
  const [open, setOpen] = useState(false)
  const [ack, setAck] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-9 text-left text-xs font-semibold text-[var(--accent-hover)] underline-offset-2 hover:underline"
      >
        Sending to an exchange or a contract? They can&apos;t claim
      </button>

      {open && (
        <div className="inner mt-2 space-y-3 rounded-2xl p-3.5">
          <p className="flex items-start gap-2 text-sm text-pretty text-[var(--ink-2)]">
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--accent-hover)]" aria-hidden />
            <span>
              Exchange deposit addresses and most smart contracts cannot call claim, so a normal SafeSend transfer to them
              would sit pending until you cancel it. If you are sure the address accepts USDC, you can send it directly. A
              direct transfer is final: SafeSend cannot cancel or return it, and no memo is attached.
            </span>
          </p>

          <div
            className="space-y-2 rounded-2xl p-3"
            style={{
              background: 'color-mix(in srgb, var(--danger) 8%, white)',
              border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)',
            }}
          >
            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--danger)]"
              />
              <span className="flex items-start gap-1.5 text-[var(--danger)]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                I understand this sends USDC straight to the address, it cannot be cancelled, and I checked the full address.
              </span>
            </label>
          </div>

          {connected ? (
            <Button
              variant="danger"
              onClick={() => {
                onSend()
                setAck(false)
              }}
              disabled={!ack || !ready || busy}
              className="w-full"
            >
              {busy ? (
                <>
                  <Spinner /> Working...
                </>
              ) : (
                'Send directly (not cancellable)'
              )}
            </Button>
          ) : (
            <p className="text-xs text-[var(--muted)]">Connect your wallet to send.</p>
          )}
          {connected && !ready && hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}
        </div>
      )}
    </div>
  )
}
