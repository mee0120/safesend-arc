# SafeSend

> Built with Arc Studio - money-powered apps in minutes

Project memory for future agents and humans.

## What This App Does

SafeSend makes the first USDC payment to a new address reversible. `send` escrows USDC; the recipient `claim`s it (which also marks them verified for that sender) or the sender `cancel`s. Verified recipients can be paid directly with `sendVerified`. The app has four tabs (Send, Inbox, Sent, Address book) and a Deploy contract page that deploys from the connected wallet.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS (Arc Light tokens in `src/index.css`)
- Web3: wagmi v2, viem v2, ConnectKit, injected wallet
- Contracts: Solidity 0.8.28 + Foundry. `contracts/SafeSend.sol`, tests in `contracts/test/SafeSend.t.sol` (35 passing).
- Chains: Arc Testnet (5042002) and Arc Mainnet (5042). Chain data comes from `src/onchain-facts.ts`.

## Deployments

- Arc Testnet: `0x9234c8accf12ff43b9c430ec6502b4b77c6c7030` (constructor arg: USDC `0x3600000000000000000000000000000000000000`)
- Arc Mainnet: `0x77704333686A4F2CdE8fe0688a77738d3bf82EA5` (deployed by the user from their own wallet; runtime code matches this repo build apart from the USDC immutable). Arc Mainnet is the app default; testnet stays selectable.

## Key Files

- `src/App.tsx` - shell, tabs, deploy view
- `src/components/` - SendTab, InboxTab, SentTab, AddressBookTab, DeployPage, Header, ui
- `src/lib/networks.ts` - per-network chain info and contract address config (`VITE_SAFESEND_ADDRESS_TESTNET|MAINNET`, browser override)
- `src/contracts/safesend.ts` - typed ABI, artifact import (`safesend.artifact.json`, refresh with `bun run sync:artifact`)
- `src/hooks/` - network context, transaction runner, contract reads
- `src/lib/nicknames.ts` - nicknames in localStorage

## Notes

- Styling is plain CSS in `src/styles.css`, generated from `src/index.css` (Tailwind source) with `bun run build:css`. Run it after adding new utility classes.
- Claim links are `?claim=<id>&net=<testnet|mainnet>`, built with `buildShareLink` in `src/lib/share.ts`; the Inbox reads them on load.
- "Send directly" is a plain USDC `transfer` (no contract involved) for exchanges and contracts.
- The contract has no list getter for verified recipients; the address book derives candidates from claimed transfers and confirms with `isVerified`.
- Amounts: always use `@/onchain-money`; USDC shown with 2 decimals.
- After editing `.env`, restart the dev server.

## To Run

```bash
bun install
bun run dev
```
