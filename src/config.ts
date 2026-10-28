/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { NETWORKS } from './lib/networks'

const arcTestnet = NETWORKS.testnet.chain
const arcMainnet = NETWORKS.mainnet.chain

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arcMainnet.id, arcMainnet.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arcTestnet, arcMainnet, mainnet], // Ethereum mainnet kept for ENS resolution
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
    [arcMainnet.id]: http(),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
