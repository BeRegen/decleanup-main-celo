import { HypercertClient, TransferRestrictions } from '@hypercerts-org/sdk'
import { createWalletClient, custom, type WalletClient } from 'viem'
import { celo } from 'viem/chains'

/**
 * Get Hypercerts client instance
 * Requires wallet to be connected
 * 
 * Note: API key is OPTIONAL - only needed for advanced features (REST/GraphQL queries).
 * Basic minting works without an API key.
 */
export async function getHypercertsClient(): Promise<HypercertClient> {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('Wallet not available. Please connect your wallet first.')
    }

    const walletClient = createWalletClient({
        chain: celo,
        transport: custom(window.ethereum),
    }) as WalletClient

    // Get environment (testnet or mainnet)
    const network = process.env.NEXT_PUBLIC_HYPERCERTS_NETWORK || 'celo-sepolia'
    const environment = network.includes('sepolia') || network.includes('testnet') ? 'test' : 'production'

    // Initialize client - API key is optional (only needed for REST/GraphQL APIs)
    const clientConfig: any = {
        walletClient,
        chainId: celo.id,
        environment,
    }

    // Add API key only if provided (optional)
    const apiKey = process.env.NEXT_PUBLIC_HYPERCERTS_API_KEY
    if (apiKey) {
        clientConfig.apiKey = apiKey
    }

    const client = new HypercertClient(clientConfig)

    return client
}

export { TransferRestrictions }
