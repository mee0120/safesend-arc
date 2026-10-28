/**
 * Copies the compiled SafeSend ABI + creation bytecode into src/contracts so the
 * "Deploy contract" page can deploy from the connected wallet, and publishes the
 * Solidity source at public/SafeSend.sol for Remix users.
 *
 * Run after `forge build`:  bun run sync:artifact
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const artifactPath = 'contracts/out/SafeSend.sol/SafeSend.json'
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as {
  abi: unknown
  bytecode: { object: string }
}

mkdirSync('src/contracts', { recursive: true })
mkdirSync('public', { recursive: true })

writeFileSync(
  'src/contracts/safesend.artifact.json',
  JSON.stringify({ abi: artifact.abi, bytecode: artifact.bytecode.object }, null, 2) + '\n',
)
copyFileSync('contracts/SafeSend.sol', 'public/SafeSend.sol')

console.log('Synced SafeSend artifact (' + Math.floor((artifact.bytecode.object.length - 2) / 2) + ' bytes of creation code).')
