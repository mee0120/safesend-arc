import { useState } from 'react'
import { BookUser, X } from 'lucide-react'
import type { Address } from 'viem'
import { shortAddress } from '@/lib/format'
import type { VerifiedEntry } from '@/hooks/useSafeSendData'

/** "Choose from address book" button plus the list it opens. Picking fills the recipient field. */
export function RecipientPicker({
  entries,
  loading,
  nameOf,
  onPick,
}: {
  entries: VerifiedEntry[]
  loading: boolean
  nameOf: (address: string) => string | undefined
  onPick: (address: Address) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inner inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--accent-hover)]"
      >
        <BookUser className="size-3.5" aria-hidden /> Choose from address book
      </button>
      {open && (
        <div className="inner mt-2 w-full basis-full rounded-2xl p-1.5" role="listbox" aria-label="Verified recipients">
          <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Verified recipients</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close list" className="flex size-8 items-center justify-center rounded-lg">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {loading ? (
            <p className="px-2.5 py-3 text-sm text-[var(--muted)]">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-pretty text-[var(--muted)]">
              No verified recipients yet. They appear here after someone claims a transfer from you.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {entries.map((entry) => {
                const nickname = nameOf(entry.address)
                return (
                  <li key={entry.address}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => {
                        onPick(entry.address)
                        setOpen(false)
                      }}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2.5 text-left hover:bg-white"
                    >
                      <span className="min-w-0 truncate text-sm font-semibold">{nickname ?? 'No nickname'}</span>
                      <span className="mono shrink-0 text-xs text-[var(--muted)]">{shortAddress(entry.address)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
