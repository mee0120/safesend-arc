import { parseAbi } from 'viem'
import artifact from './safesend.artifact.json'

/** Typed ABI for the calls the app makes (mirrors contracts/SafeSend.sol). */
export const safeSendAbi = parseAbi([
  'struct Transfer { address sender; address recipient; uint256 amount; uint64 createdAt; uint8 status; string memo; }',
  'function send(address recipient, uint256 amount, string memo) returns (uint256 id)',
  'function claim(uint256 id)',
  'function cancel(uint256 id)',
  'function sendVerified(address recipient, uint256 amount, string memo)',
  'function removeVerified(address recipient)',
  'function isVerified(address sender, address recipient) view returns (bool)',
  'function idsBySender(address sender) view returns (uint256[])',
  'function idsByRecipient(address recipient) view returns (uint256[])',
  'function transfersOf(uint256[] ids) view returns (Transfer[] payments)',
  'function usdc() view returns (address)',
  'function totalPending() view returns (uint256)',
  'event Sent(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount, string memo)',
  'event Claimed(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount)',
  'event Cancelled(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount)',
  'event Verified(address indexed sender, address indexed recipient)',
  'event SentVerified(address indexed sender, address indexed recipient, uint256 amount, string memo)',
  'event VerifiedRemoved(address indexed sender, address indexed recipient)',
  'error ZeroAddress()',
  'error SelfTransfer()',
  'error ZeroAmount()',
  'error MemoTooLong()',
  'error NotPending(uint256 id)',
  'error NotRecipient(uint256 id)',
  'error NotSender(uint256 id)',
  'error NotVerified()',
])

/** Full compiled ABI and creation bytecode, used by the Deploy page. Refresh with `bun run sync:artifact`. */
export const safeSendArtifact = artifact as { abi: typeof artifact.abi; bytecode: `0x${string}` }

export const Status = { None: 0, Pending: 1, Claimed: 2, Cancelled: 3 } as const

export const MAX_MEMO_BYTES = 64
