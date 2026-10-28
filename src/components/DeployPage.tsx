import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useDeployContract, usePublicClient } from 'wagmi'
import { getAddress, isAddress, isAddressEqual, type Hash } from 'viem'
import { ArrowLeft, Download, ExternalLink, TriangleAlert } from 'lucide-react'
import { safeSendAbi, safeSendArtifact } from '@/contracts/safesend'
import { useNetwork } from '@/hooks/useNetwork'
import { useTxRunner } from '@/hooks/useTxRunner'
import { NETWORKS, setSavedContractAddress, useAddressSource } from '@/lib/networks'
import { describeError } from '@/lib/errors'
import { requireChain } from '@/onchain-facts'
import { AddressLink, Button, Card, Notice, Spinner, TxStatus } from './ui'


export function DeployPage({ onBack }: { onBack: () => void }) {
  const { isConnected } = useAccount()
  const { net, contract, setNetworkKey } = useNetwork()
  const source = useAddressSource(net)
  const chainFact = requireChain(net.chainId)
  const client = usePublicClient({ chainId: net.chainId })
  const tx = useTxRunner(net.chainId)
  const { deployContractAsync } = useDeployContract()

  const [ack, setAck] = useState(false)
  const [manual, setManual] = useState('')
  const [manualMsg, setManualMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [deployMsg, setDeployMsg] = useState<string | null>(null)

  const needsAck = !net.isTestnet
  const canDeploy = isConnected && (!needsAck || ack)

  async function deploy() {
    setDeployMsg(null)
    let deployedHash: Hash | undefined
    const ok = await tx.run([
      {
        label: 'Deploy SafeSend',
        send: async () => {
          const hash = await deployContractAsync({
            abi: safeSendArtifact.abi,
            bytecode: safeSendArtifact.bytecode,
            args: [net.usdc],
            chainId: net.chainId,
          })
          deployedHash = hash
          return hash
        },
      },
    ])
    if (!ok || !deployedHash || !client) return
    try {
      const receipt = await client.getTransactionReceipt({ hash: deployedHash })
      if (!receipt.contractAddress) throw new Error('No contract address in the receipt.')
      setSavedContractAddress(net.chainId, getAddress(receipt.contractAddress))
      setDeployMsg('Deployed and saved for ' + net.label + '. The app is now connected to it.')
    } catch (error) {
      setDeployMsg(describeError(error).message)
    }
  }

  async function saveManual() {
    setManualMsg(null)
    const value = manual.trim()
    if (!isAddress(value)) {
      setManualMsg({ ok: false, text: 'That is not a valid address.' })
      return
    }
    if (!client) return
    setChecking(true)
    try {
      const address = getAddress(value)
      const token = await client.readContract({ address, abi: safeSendAbi, functionName: 'usdc' })
      if (!isAddressEqual(token, net.usdc)) {
        setManualMsg({ ok: false, text: `This contract uses a different token (${token}), not USDC on ${net.label}.` })
        return
      }
      setSavedContractAddress(net.chainId, address)
      setManual('')
      setManualMsg({ ok: true, text: 'Saved. The app now uses this contract on ' + net.label + '.' })
    } catch {
      setManualMsg({ ok: false, text: `No SafeSend contract found at that address on ${net.label}.` })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--accent-hover)]">
        <ArrowLeft className="size-4" aria-hidden /> Back to SafeSend
      </button>

      <Card className="space-y-4">
        <div>
          <h2 className="display text-2xl font-bold">Deploy contract</h2>
          <p className="mt-1 text-sm text-pretty text-[var(--muted)]">
            Deploys your own SafeSend from the connected wallet. The contract has no owner, no fees and no admin keys.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Network">
          {(['testnet', 'mainnet'] as const).map((key) => (
            <button
              key={key}
              role="radio"
              aria-checked={net.key === key}
              onClick={() => {
                setNetworkKey(key)
                setAck(false)
                setDeployMsg(null)
                tx.reset()
              }}
              className={
                'min-h-11 rounded-2xl px-3 text-sm font-semibold transition-colors ' +
                (net.key === key ? 'bg-[var(--accent)] text-white' : 'inner text-[var(--ink)]')
              }
            >
              {NETWORKS[key].label}
            </button>
          ))}
        </div>

        <dl className="inner space-y-2 rounded-2xl p-3.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--muted)]">Chain ID</dt>
            <dd className="tabular-nums">{net.chainId}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--muted)]">USDC (constructor argument)</dt>
            <dd><AddressLink chainId={net.chainId} address={net.usdc} /></dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--muted)]">Current SafeSend</dt>
            <dd>
              {contract ? (
                <span className="flex items-center gap-2">
                  <AddressLink chainId={net.chainId} address={contract} />
                  <span className="text-[11px] text-[var(--subtle)]">{source === 'saved' ? 'saved in this browser' : 'from app config'}</span>
                </span>
              ) : (
                <span className="text-[var(--subtle)]">Not set</span>
              )}
            </dd>
          </div>
        </dl>

        {needsAck && (
          <div className="space-y-2 rounded-2xl p-3.5" style={{ background: 'color-mix(in srgb, var(--danger) 8%, white)', border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)' }}>
            <p className="flex items-start gap-2 text-sm font-semibold text-[var(--danger)]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Mainnet uses real funds
            </p>
            <p className="text-xs text-pretty text-[var(--ink-2)]">
              Transactions on mainnet are irreversible. Arc Studio does not deploy or transact on mainnet for you. This
              page sends the deployment from your own wallet. Test on Arc Testnet and get an independent audit first.
            </p>
            <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--danger)]" />
              <span>I reviewed the contract and understand this deploys to Arc Mainnet from my wallet.</span>
            </label>
          </div>
        )}

        {isConnected ? (
          <Button onClick={() => void deploy()} disabled={!canDeploy || tx.busy} className="w-full">
            {tx.busy ? <><Spinner /> Working...</> : `Deploy to ${net.label}`}
          </Button>
        ) : (
          <ConnectKitButton.Custom>
            {({ show }) => <Button onClick={show} className="w-full">Connect wallet</Button>}
          </ConnectKitButton.Custom>
        )}
        <TxStatus state={tx.state} chainId={net.chainId} />
        {deployMsg && <Notice tone={deployMsg.startsWith('Deployed') ? 'success' : 'danger'}>{deployMsg}</Notice>}
      </Card>

      <Card className="space-y-3">
        <h3 className="display text-lg font-semibold">Already deployed? Use that address</h3>
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="0x... SafeSend contract"
          spellCheck={false}
          aria-label="SafeSend contract address"
          className="inner mono min-h-12 w-full rounded-2xl px-4 text-sm outline-none placeholder:text-slate-400"
        />
        <div className="flex gap-2">
          <Button onClick={() => void saveManual()} disabled={!manual.trim() || checking} className="flex-1">
            {checking ? <Spinner /> : `Use on ${net.label}`}
          </Button>
          {source === 'saved' && (
            <Button variant="ghost" onClick={() => { setSavedContractAddress(net.chainId, null); setManualMsg(null) }}>
              Clear saved
            </Button>
          )}
        </div>
        {manualMsg && <Notice tone={manualMsg.ok ? 'success' : 'danger'}>{manualMsg.text}</Notice>}
        <p className="text-xs text-pretty text-[var(--muted)]">
          Addresses are stored per network in this browser. To make one permanent for everyone who opens the app, set{' '}
          <span className="mono">{net.isTestnet ? 'VITE_SAFESEND_ADDRESS_TESTNET' : 'VITE_SAFESEND_ADDRESS_MAINNET'}</span> in the
          project&apos;s <span className="mono">.env</span> file.
        </p>
      </Card>

      <Card className="space-y-3">
        <details>
          <summary className="display flex min-h-11 cursor-pointer items-center text-lg font-semibold">Deploy with Remix and MetaMask</summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-pretty text-[var(--ink-2)]">
            <li>
              Download{' '}
              <a href="/SafeSend.sol" download className="inline-flex items-center gap-1 font-semibold text-[var(--accent-hover)] hover:underline">
                SafeSend.sol <Download className="size-3" aria-hidden />
              </a>{' '}
              and open{' '}
              <a href="https://remix.ethereum.org" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--accent-hover)] hover:underline">
                remix.ethereum.org <ExternalLink className="size-3" aria-hidden />
              </a>
              . Create a file named SafeSend.sol and paste the code.
            </li>
            <li>
              In the Solidity compiler tab choose version 0.8.28, EVM version cancun, enable the optimizer with 200 runs,
              then compile. Remix fetches the OpenZeppelin imports itself.
            </li>
            <li>
              In MetaMask add the network if needed: name {chainFact.name}, chain ID {net.chainId}, RPC{' '}
              <span className="mono break-all">{chainFact.rpcUrls[0]}</span>, currency USDC, explorer{' '}
              <span className="mono break-all">{chainFact.explorerBase}</span>.
            </li>
            <li>
              In Deploy &amp; run, set Environment to &ldquo;Injected Provider - MetaMask&rdquo;, pick SafeSend, and enter{' '}
              <span className="mono break-all">{net.usdc}</span> as the constructor argument (the USDC address).
            </li>
            <li>Click Deploy, confirm in MetaMask, then paste the new contract address into the box above.</li>
          </ol>
        </details>
      </Card>
    </div>
  )
}
