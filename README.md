# SafeSend

Reversible USDC transfers. The first payment to any new address is held by the contract until the recipient claims it, so a wrong or look-alike address can be caught and cancelled in time. Once someone has really claimed from you, they become a verified recipient you can pay in one step.

Built with [Arc Studio](https://studio.arc.io)

## Live app and contract

- App: https://arc-studio-17d19eca7fd44f8cbb1a1907.vercel.app
- Arc Mainnet contract: [`0x77704333686A4F2CdE8fe0688a77738d3bf82EA5`](https://explorer.arc.io/address/0x77704333686A4F2CdE8fe0688a77738d3bf82EA5)
- Example mainnet claim transaction: [`0x9ba6bef39cc6c6b2f94efe6723a570aa89ad9c132d64e1f6420b322edef9fa8b`](https://explorer.arc.io/tx/0x9ba6bef39cc6c6b2f94efe6723a570aa89ad9c132d64e1f6420b322edef9fa8b)

Mainnet transactions use real USDC and cannot be reversed. Try a small amount first. The contract has no owner, no fees and no admin keys: funds can only go to the named recipient or back to the sender. It has not had a third-party audit.

## What SafeSend does

Sending USDC to a wrong address is normally permanent, and look-alike addresses ("address poisoning") exploit people who only check the first and last few characters. SafeSend changes that:

- Payments to a new address are held until the recipient claims them. Until then you can cancel and get the full amount back.
- When the recipient claims, they are added to your verified list. Later payments to them go straight through in one step.
- If you paste an address that matches the start and end of a verified one but is different, the app shows a red warning and asks you to confirm before sending.

## How to use it

1. Open the app and connect your wallet. Pick Arc Mainnet (the default) or Arc Testnet from the network switcher.
2. **Send:** paste the recipient address, enter an amount and an optional memo.
   - A verified recipient shows a green badge and a "Send now" button. This payment is final.
   - A new recipient shows "New recipient: this transfer stays cancellable until they claim it". Your wallet may first ask you to allow USDC.
   - After sending, copy the claim link and share it with the recipient.
3. **Inbox:** the recipient opens the link (or this tab), connects the receiving wallet and presses Claim.
4. **Sent:** your pending transfers show a Cancel button until they are claimed. Claimed and cancelled transfers are listed below as history.
5. **Address book:** your verified recipients. Give each a nickname (stored only in your browser), send to them again, or remove their verified status.

Other options on the Send tab: "Choose from address book" fills the recipient field, and a "Send directly (not cancellable)" option handles exchanges and contract addresses that cannot claim.

All transactions link to the Arc block explorer (explorer.arc.io on mainnet, explorer.testnet.arc.io on testnet).

## Tech stack

- React 18, Vite, TypeScript
- wagmi, viem, ConnectKit (browser wallet)
- Solidity 0.8.28 with Foundry and OpenZeppelin
- Arc Mainnet and Arc Testnet, USDC

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
cp .env.example .env   # then fill in the contract addresses
bun run dev
```

Contract and styling commands:

```bash
bun run contracts:build   # compile
bun run contracts:test    # run the Foundry tests
bun run sync:artifact     # refresh the ABI and bytecode used by the Deploy contract page
bun run build:css         # regenerate src/styles.css after adding new utility classes
```

### Environment variables

Both are public contract addresses, not secrets. No private keys or API keys are needed to run the app.

- `VITE_SAFESEND_ADDRESS_TESTNET`: SafeSend contract address on Arc Testnet.
- `VITE_SAFESEND_ADDRESS_MAINNET`: SafeSend contract address on Arc Mainnet.

An address saved from the in-app Deploy contract page (stored in the browser) takes priority over these values. Restart the dev server after changing `.env`.

## Deploying your own contract

Open the app, choose a network, and use the Deploy contract page to deploy from your connected wallet, or follow the Remix and MetaMask steps shown there. Test on Arc Testnet and get an independent audit before using mainnet.
