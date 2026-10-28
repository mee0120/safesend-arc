import { useEffect, useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Address } from 'viem'
import { buildShareLink } from '@/lib/share'
import { shortAddress } from '@/lib/format'
import type { NetworkKey } from '@/lib/networks'
import { Button } from './ui'

export function claimPath(id: bigint, network: NetworkKey): string {
  return `/?claim=${id.toString()}&net=${network}`
}

/** Shown after a successful send(): a link that opens the recipient's Inbox on this transfer. */
export function ClaimLinkCard({
  id,
  recipient,
  network,
}: {
  id: bigint
  recipient: Address
  network: NetworkKey
}) {
  // Resolved after mount (the share base needs a handshake); never stored, rebuilt from the id.
  const [link, setLink] = useState<string | undefined>()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    void buildShareLink(claimPath(id, network)).then((url) => {
      if (live) setLink(url)
    })
    return () => {
      live = false
    }
  }, [id, network])

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Claim link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.')
    }
  }

  return (
    <div
      className="space-y-3 rounded-2xl p-3.5"
      style={{
        background: 'color-mix(in srgb, var(--success) 8%, white)',
        border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
      }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Link2 className="size-4 text-[var(--success)]" aria-hidden />
        Share this claim link with the recipient
      </p>
      <p className="text-xs text-pretty text-[var(--muted)]">
        Transfer #{id.toString()} to {shortAddress(recipient)} is waiting. The link opens their Inbox on this transfer.
      </p>
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={link ?? 'Preparing link...'}
          aria-label="Claim link"
          onFocus={(e) => e.currentTarget.select()}
          className="inner mono min-h-11 min-w-0 flex-1 rounded-2xl px-3 text-xs outline-none"
        />
        <Button onClick={() => void copy()} disabled={!link} className="px-4">
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
