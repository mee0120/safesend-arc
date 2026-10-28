import { useMemo, useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { erc20Abi, getAddress, isAddress, parseEventLogs, type Address, type Hash } from 'viem'
import { AlertTriangle, BadgeCheck, ShieldAlert, UserPlus } from 'lucide-react'
import { safeSendAbi, MAX_MEMO_BYTES } from '@/contracts/safesend'
import { useNetwork } from '@/hooks/useNetwork'
import { useTxRunner } from '@/hooks/useTxRunner'
import { useAllowance, useIsVerified, useUsdcBalance, useVerifiedBook } from '@/hooks/useSafeSendData'
import { useNicknames } from '@/lib/nicknames'
import { looksLike, memoBytes, shortAddress, usd2 } from '@/lib/format'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { Button, Card, Notice, Spinner, TxStatus } from './ui'
import { ClaimLinkCard } from './ClaimLinkCard'
import { DirectSend } from './DirectSend'
import { RecipientPicker } from './RecipientPicker'


function parseAmountSafe(value: string): bigint | undefined {
  if (!value.trim()) return undefined
  try {
    const raw = parseUsdc(value)
    return raw > 0n ? raw : undefined
  } catch {
    return undefined
  }
}

export function SendTab({ prefillTo }: { prefillTo?: string }) {
  const { address: me, isConnected } = useAccount()
  const { net, contract } = useNetwork()
  const tx = useTxRunner(net.chainId)
  const { writeContractAsync } = useWriteContract()
  const client = usePublicClient({ chainId: net.chainId })

  const [to, setTo] = useState(prefillTo ?? '')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [ack, setAck] = useState(false)
  const [claim, setClaim] = useState<{ id: bigint; recipient: Address } | undefined>()

  // Adopt a recipient chosen elsewhere (e.g. the address book) without an effect.
  const [seenPrefill, setSeenPrefill] = useState(prefillTo)
  if (prefillTo !== seenPrefill) {
    setSeenPrefill(prefillTo)
    if (prefillTo) {
      setTo(prefillTo)
      setAck(false)
    }
  }

  const trimmed = to.trim()
  const recipient: Address | undefined = isAddress(trimmed) ? getAddress(trimmed) : undefined
  const addressError =
    trimmed && !recipient
      ? 'Not a valid address. Check that you pasted all 42 characters.'
      : recipient && me && recipient.toLowerCase() === me.toLowerCase()
        ? 'That is your own address.'
        : undefined

  const amountRaw = parseAmountSafe(amount)
  const amountError =
    amount.trim() && amountRaw === undefined ? 'Enter an amount above 0 with up to 6 decimals.' : undefined
  const bytes = memoBytes(memo)
  const memoError = bytes > MAX_MEMO_BYTES ? `Memo is ${bytes} bytes. The limit is ${MAX_MEMO_BYTES}.` : undefined

  const balance = useUsdcBalance(me)
  const allowance = useAllowance(me)
  const verifiedQuery = useIsVerified(me, addressError ? undefined : recipient)
  const book = useVerifiedBook(me)
  const { nameOf } = useNicknames(me)

  const isVerified = verifiedQuery.data === true
  const lookalike = useMemo(() => {
    if (!recipient) return undefined
    return (book.data ?? []).find((v) => looksLike(v.address, recipient))
  }, [book.data, recipient])
  const lookalikeName = lookalike ? (nameOf(lookalike.address) ?? shortAddress(lookalike.address)) : ''

  const insufficient = amountRaw !== undefined && balance.data !== undefined && amountRaw > balance.data
  const needsAck = !!lookalike
  const ready =
    !!contract &&
    !!recipient &&
    !addressError &&
    amountRaw !== undefined &&
    !memoError &&
    !insufficient &&
    !verifiedQuery.isLoading &&
    (!needsAck || ack)

  async function submit() {
    if (!contract || !recipient || amountRaw === undefined) return
    const chainId = net.chainId
    const steps = []
    let sendHash: Hash | undefined
    setClaim(undefined)
    if ((allowance.data ?? 0n) < amountRaw) {
      steps.push({
        label: 'Allow USDC',
        send: () =>
          writeContractAsync({
            address: net.usdc,
            abi: erc20Abi,
            functionName: 'approve',
            args: [contract, amountRaw],
            chainId,
          }),
      })
    }
    if (isVerified) {
      steps.push({
        label: 'Send now',
        send: () =>
          writeContractAsync({
            address: contract,
            abi: safeSendAbi,
            functionName: 'sendVerified',
            args: [recipient, amountRaw, memo],
            chainId,
          }),
      })
    } else {
      steps.push({
        label: 'Send',
        send: async () => {
          const hash = await writeContractAsync({
            address: contract,
            abi: safeSendAbi,
            functionName: 'send',
            args: [recipient, amountRaw, memo],
            chainId,
          })
          sendHash = hash
          return hash
        },
      })
    }
    const ok = await tx.run(steps)
    if (ok) {
      setAmount('')
      setMemo('')
      setTo('')
      setAck(false)
      if (sendHash && client) {
        // The new transfer id comes from the Sent event in the confirmed receipt.
        try {
          const receipt = await client.getTransactionReceipt({ hash: sendHash })
          const sent = parseEventLogs({ abi: safeSendAbi, eventName: 'Sent', logs: receipt.logs }).find(
            (log) => log.address.toLowerCase() === contract.toLowerCase(),
          )
          if (sent) setClaim({ id: sent.args.id, recipient })
        } catch {
          // the transfer is still pending; it can be found in the Sent tab
        }
      }
    }
  }

  async function sendDirect() {
    if (!recipient || amountRaw === undefined) return
    setClaim(undefined)
    const ok = await tx.run([
      {
        label: 'Send directly',
        send: () =>
          writeContractAsync({
            address: net.usdc,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [recipient, amountRaw],
            chainId: net.chainId,
          }),
      },
    ])
    if (ok) {
      setAmount('')
      setMemo('')
      setTo('')
      setAck(false)
    }
  }

  const directReady =
    !!recipient && !addressError && amountRaw !== undefined && !insufficient && (!needsAck || ack)
  const directHint = !recipient || addressError
    ? 'Enter a valid recipient address first.'
    : amountRaw === undefined
      ? 'Enter an amount first.'
      : insufficient
        ? 'Your balance is too low for this amount.'
        : needsAck && !ack
          ? 'Tick the look-alike confirmation above first.'
          : undefined

  const cta = isVerified ? 'Send now' : 'Send (cancellable)'

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="to" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Recipient address
            </label>
            <RecipientPicker
              entries={book.data ?? []}
              loading={book.isLoading}
              nameOf={nameOf}
              onPick={(address) => {
                setTo(address)
                setAck(false)
                tx.reset()
              }}
            />
          </div>
          <input
            id="to"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setAck(false)
              tx.reset()
            }}
            placeholder="0x..."
            spellCheck={false}
            autoComplete="off"
            className="inner mono mt-1.5 min-h-12 w-full rounded-2xl px-4 text-sm outline-none placeholder:text-slate-400"
          />
          {addressError && <p className="mt-1.5 text-xs text-[var(--danger)]">{addressError}</p>}
          <div className="mt-1">
            <DirectSend
              ready={directReady}
              hint={directHint}
              busy={tx.busy}
              connected={isConnected}
              onSend={() => void sendDirect()}
            />
          </div>
        </div>

        {recipient && !addressError && contract && (
          <>
            {verifiedQuery.isLoading ? (
              <div className="inner flex items-center gap-2 rounded-2xl p-3 text-sm text-[var(--muted)]">
                <Spinner /> Checking your address book...
              </div>
            ) : isVerified ? (
              <Notice tone="success">
                <span className="flex items-center gap-1.5 font-semibold">
                  <BadgeCheck className="size-4" aria-hidden /> Verified: claimed from you before
                </span>
                {nameOf(recipient) && <span className="text-sm text-[var(--muted)]">{nameOf(recipient)}</span>}
              </Notice>
            ) : (
              <Notice tone="info">
                <span className="flex items-center gap-1.5">
                  <UserPlus className="size-4 shrink-0" aria-hidden />
                  New recipient: this transfer stays cancellable until they claim it
                </span>
              </Notice>
            )}

            {lookalike && (
              <div
                className="space-y-3 rounded-2xl p-3.5"
                style={{
                  background: 'color-mix(in srgb, var(--danger) 9%, white)',
                  border: '1px solid color-mix(in srgb, var(--danger) 45%, transparent)',
                }}
                role="alert"
              >
                <p className="flex items-start gap-2 text-sm font-semibold text-[var(--danger)]">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  This looks like {lookalikeName} but it is a DIFFERENT address
                </p>
                <div className="mono space-y-1 break-all text-[11px] leading-relaxed text-[var(--ink-2)]">
                  <p>
                    <span className="font-semibold text-[var(--success)]">Verified:</span> {lookalike.address}
                  </p>
                  <p>
                    <span className="font-semibold text-[var(--danger)]">Pasted:</span> {recipient}
                  </p>
                </div>
                <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--danger)]"
                  />
                  <span>I checked the full address and I want to send to this different address anyway.</span>
                </label>
              </div>
            )}
          </>
        )}

        <div className="inner rounded-2xl p-4">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if (/^\d*\.?\d*$/.test(v)) {
                setAmount(v)
                tx.reset()
              }
            }}
            aria-label="Amount in USDC"
            placeholder="0.00"
            className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-[var(--subtle)]">USDC</span>
            <button
              type="button"
              disabled={balance.data === undefined}
              onClick={() => balance.data !== undefined && setAmount(formatUsdc(balance.data))}
              className="min-h-8 text-xs font-semibold text-[var(--accent-hover)] disabled:opacity-40"
            >
              {balance.data !== undefined ? `Balance: ${usd2(balance.data)} · Max` : 'Balance unavailable'}
            </button>
          </div>
          {amountError && <p className="mt-1 text-xs text-[var(--danger)]">{amountError}</p>}
          {insufficient && balance.data !== undefined && (
            <p className="mt-1 text-xs text-[var(--danger)]">
              Insufficient balance. You have {usd2(balance.data)} USDC.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="memo" className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Memo (optional)
            </label>
            <span className={'text-xs tabular-nums ' + (memoError ? 'text-[var(--danger)]' : 'text-[var(--subtle)]')}>
              {bytes}/{MAX_MEMO_BYTES}
            </span>
          </div>
          <input
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="What is this for?"
            className="inner mt-1.5 min-h-12 w-full rounded-2xl px-4 text-sm outline-none placeholder:text-slate-400"
          />
          {memoError && <p className="mt-1.5 text-xs text-[var(--danger)]">{memoError}</p>}
        </div>

        {!contract ? (
          <Notice tone="danger">
            SafeSend is not set up on {net.label} yet. Use the Deploy contract page to add it.
          </Notice>
        ) : !isConnected ? (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <Button onClick={show} className="w-full">
                Connect wallet
              </Button>
            )}
          </ConnectKitButton.Custom>
        ) : (
          <Button onClick={() => void submit()} disabled={!ready || tx.busy} className="w-full">
            {tx.busy ? (
              <>
                <Spinner /> Working...
              </>
            ) : (
              cta
            )}
          </Button>
        )}

        {needsAck && !ack && recipient && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--danger)]">
            <AlertTriangle className="size-3.5" aria-hidden /> Tick the confirmation above to continue.
          </p>
        )}

        {isVerified ? (
          <p className="text-xs text-pretty text-[var(--muted)]">
            Verified recipients are paid in one step. This payment cannot be taken back.
          </p>
        ) : (
          <p className="text-xs text-pretty text-[var(--muted)]">
            USDC is held by the contract until they claim it. You can cancel any time before that. The first time, your
            wallet may ask you to allow USDC first.
          </p>
        )}

        <TxStatus state={tx.state} chainId={net.chainId} />

        {claim && <ClaimLinkCard id={claim.id} recipient={claim.recipient} network={net.key} />}
      </Card>
    </div>
  )
}
