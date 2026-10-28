import { BaseError, ContractFunctionRevertedError } from 'viem'

const REVERTS: Record<string, string> = {
  ZeroAddress: 'The recipient cannot be the zero address.',
  SelfTransfer: 'You cannot send to your own address.',
  ZeroAmount: 'The amount must be greater than zero.',
  MemoTooLong: 'The memo is longer than 64 bytes.',
  NotPending: 'This transfer is no longer pending. It was already claimed or cancelled.',
  NotRecipient: 'Only the recipient can claim this transfer.',
  NotSender: 'Only the sender can cancel this transfer.',
  NotVerified: 'This address is not in your verified list.',
}

export interface DescribedError {
  message: string
  /** True when the user simply closed the wallet prompt. */
  cancelled: boolean
}

export function describeError(error: unknown): DescribedError {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase()
  const code = (error as { code?: number } | null)?.code

  if (
    code === 4001 ||
    text.includes('user rejected') ||
    text.includes('user denied') ||
    text.includes('rejected the request')
  ) {
    return { message: 'Cancelled in your wallet. Nothing was sent.', cancelled: true }
  }

  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName
      if (name && REVERTS[name]) return { message: REVERTS[name], cancelled: false }
      const reason = revert.reason ?? revert.shortMessage
      if (/balance|insufficient/i.test(reason)) {
        return { message: 'Insufficient USDC balance for this amount.', cancelled: false }
      }
      if (/allowance/i.test(reason)) {
        return { message: 'USDC allowance is too low. Approve the amount and try again.', cancelled: false }
      }
      return { message: 'The transaction would fail: ' + reason, cancelled: false }
    }
  }

  if (text.includes('insufficient funds') || text.includes('exceeds balance')) {
    return { message: 'Not enough USDC to pay for gas. Add funds and try again.', cancelled: false }
  }
  if (text.includes('network') || text.includes('timeout') || text.includes('fetch')) {
    return { message: 'Network issue. Check your connection and try again.', cancelled: false }
  }
  const short = error instanceof BaseError ? error.shortMessage : undefined
  return { message: short ?? 'Something went wrong. Please try again.', cancelled: false }
}
