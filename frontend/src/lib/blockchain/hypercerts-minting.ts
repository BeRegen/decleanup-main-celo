import { getHypercertsClient, TransferRestrictions } from './hypercerts'
import { buildHypercertMetadata } from './hypercerts-metadata'
import { aggregateCleanupData } from './hypercerts-data'
import { uploadJSONToIPFS } from './ipfs'
import { CONTRACT_ADDRESSES } from './contracts'
import { generateHypercertImages } from '@/lib/utils/hypercert-image-generator'

/**
 * Custom error classes for better error handling
 */
export class HypercertMintingError extends Error {
    constructor(message: string, public code?: string, public originalError?: unknown) {
        super(message)
        this.name = 'HypercertMintingError'
    }
}

export class IPFSError extends HypercertMintingError {
    constructor(message: string, originalError?: unknown) {
        super(message, 'IPFS_ERROR', originalError)
        this.name = 'IPFSError'
    }
}

export class NetworkError extends HypercertMintingError {
    constructor(message: string, originalError?: unknown) {
        super(message, 'NETWORK_ERROR', originalError)
        this.name = 'NetworkError'
    }
}

export class ContractError extends HypercertMintingError {
    constructor(message: string, originalError?: unknown) {
        super(message, 'CONTRACT_ERROR', originalError)
        this.name = 'ContractError'
    }
}

export class SDKError extends HypercertMintingError {
    constructor(message: string, originalError?: unknown) {
        super(message, 'SDK_ERROR', originalError)
        this.name = 'SDKError'
    }
}

/**
 * Mint a Hypercert for a user's cleanup milestone
 * Called when user reaches 10, 20, 30... verified cleanups
 * 
 * Process:
 * 1. Aggregate cleanup data from last 10 cleanups (including IPFS impact reports)
 * 2. Build hypercert metadata
 * 3. Upload metadata to IPFS
 * 4. Mint hypercert with IPFS metadata reference
 * 5. Attempt to claim reward (if contract allows)
 */
export async function mintHypercert(
    userAddress: string,
    hypercertNumber: number
): Promise<{ txHash: string; metadataHash: string; rewardClaimed: boolean }> {
    let metadataHash: string | null = null
    
    try {
        console.log(`🎯 Starting Hypercert mint for user ${userAddress}, certificate #${hypercertNumber}`)

        // Step 1: Calculate cleanup ID range (last 10 cleanups)
        const toCleanupId = BigInt(hypercertNumber * 10)
        const fromCleanupId = toCleanupId - BigInt(9)

        // Step 2: Aggregate data from last 10 cleanups (with IPFS impact report fetching)
        console.log(`📊 Aggregating cleanup data from ${fromCleanupId} to ${toCleanupId}...`)
        let cleanupData
        try {
            cleanupData = await aggregateCleanupData(userAddress, fromCleanupId, toCleanupId)
        } catch (error) {
            throw new NetworkError(
                'Failed to aggregate cleanup data. Please check your connection and try again.',
                error
            )
        }

        if (cleanupData.cleanupIds.length === 0) {
            throw new HypercertMintingError(
                'No verified cleanups found in range. Please ensure all cleanups are verified before minting.'
            )
        }

        console.log(`✅ Aggregated ${cleanupData.cleanupIds.length} cleanups`)
        console.log(`   - Total weight: ${cleanupData.totalWeight}kg`)
        console.log(`   - Total area: ${cleanupData.totalArea}m²`)
        console.log(`   - Total hours: ${cleanupData.totalHours}h`)
        console.log(`   - Waste types: ${Array.from(cleanupData.wasteTypes).join(', ') || 'None'}`)
        console.log(`   - Photos: ${cleanupData.beforePhotos.length} before, ${cleanupData.afterPhotos.length} after`)

        // Step 3: Generate images (logo, banner, main image)
        console.log('🎨 Generating Hypercert images...')
        let images
        try {
            images = await generateHypercertImages(cleanupData, hypercertNumber)
            console.log('✅ Images generated and uploaded to IPFS')
        } catch (error) {
            console.warn('⚠️  Failed to generate images, using fallback:', error)
            // Continue with fallback (single photo)
            images = undefined
        }

        // Step 4: Build Hypercert metadata
        console.log('📝 Building Hypercert metadata...')
        let metadata
        try {
            metadata = buildHypercertMetadata(userAddress, cleanupData, hypercertNumber, images)
        } catch (error) {
            throw new HypercertMintingError(
                'Failed to build hypercert metadata. Please try again.',
                'METADATA_BUILD_ERROR',
                error
            )
        }

        // Step 5: Upload metadata to IPFS first
        console.log('📤 Uploading metadata to IPFS...')
        try {
            const ipfsResult = await uploadJSONToIPFS(metadata, `hypercert-${hypercertNumber}-${userAddress.slice(0, 10)}`)
            metadataHash = ipfsResult.hash
            console.log(`✅ Metadata uploaded to IPFS: ${metadataHash}`)
            console.log(`   IPFS URL: ${ipfsResult.url}`)
        } catch (error) {
            throw new IPFSError(
                'Failed to upload metadata to IPFS. Please check your connection and try again.',
                error
            )
        }

        // Update metadata image to use IPFS hash
        const metadataWithIPFS = {
            ...metadata,
            image: metadata.image || `ipfs://${metadataHash}`,
            // Add IPFS metadata reference
            external_url: `ipfs://${metadataHash}`,
        }

        // Step 6: Initialize Hypercerts client
        console.log('🔗 Initializing Hypercerts client...')
        let client
        try {
            client = await getHypercertsClient()
        } catch (error) {
            throw new SDKError(
                'Failed to initialize Hypercerts client. Please check your API key and network configuration.',
                error
            )
        }

        // Step 7: Mint Hypercert with IPFS metadata
        // Total units: 100,000,000 (allows for 6 decimal precision in fractions)
        const totalUnits = BigInt(100_000_000)

        console.log('⛏️  Minting Hypercert...')
        console.log('   Metadata IPFS hash:', metadataHash)
        console.log('   Total units:', totalUnits.toString())

        let txHash: string
        try {
            txHash = await client.mintClaim({
                metaData: metadataWithIPFS,
                totalUnits,
                transferRestrictions: TransferRestrictions.FromCreatorOnly, // User controls transfers
            } as any) // Using 'as any' temporarily until SDK types are confirmed
        } catch (error) {
            throw new SDKError(
                'Failed to mint hypercert. Please check your wallet connection and try again.',
                error
            )
        }

        if (!txHash) {
            throw new SDKError('Minting transaction returned no hash. Please try again.')
        }

        console.log('✅ Hypercert minted successfully!')
        console.log('   Transaction hash:', txHash)
        console.log('   Metadata IPFS hash:', metadataHash)
        console.log('   View on Hypercerts:', `https://hypercerts.org/app/view/${txHash}`)

        // Step 8: Claim reward (10 $cDCU) - users can claim their own reward
        let rewardClaimed = false
        if (CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
            try {
                console.log(`💰 Claiming hypercert reward (10 $cDCU) for hypercert #${hypercertNumber}...`)
                const { claimHypercertReward } = await import('./contracts')
                const rewardTxHash = await claimHypercertReward(hypercertNumber)
                console.log('✅ Hypercert reward claimed successfully!')
                console.log('   Transaction hash:', rewardTxHash)
                rewardClaimed = true
            } catch (error) {
                console.warn('⚠️  Could not claim reward automatically:', error)
                // Don't fail the minting if reward claim fails - user can claim manually later
                rewardClaimed = false
            }
        } else {
            console.log('ℹ️  Reward distributor contract not configured. Reward must be claimed manually.')
        }

        return {
            txHash,
            metadataHash: metadataHash!,
            rewardClaimed,
        }
    } catch (error) {
        // Enhanced error handling with user-friendly messages
        if (error instanceof HypercertMintingError) {
            console.error(`❌ ${error.name}:`, error.message)
            throw error
        }

        // Handle unknown errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        console.error('❌ Unexpected error minting Hypercert:', error)
        
        // Try to categorize the error
        if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
            throw new NetworkError('Network error occurred. Please check your internet connection and try again.', error)
        }
        
        if (errorMessage.includes('IPFS') || errorMessage.includes('ipfs')) {
            throw new IPFSError('IPFS error occurred. Please try again in a moment.', error)
        }
        
        if (errorMessage.includes('contract') || errorMessage.includes('transaction')) {
            throw new ContractError('Blockchain transaction error. Please check your wallet and try again.', error)
        }

        throw new HypercertMintingError(
            `Failed to mint hypercert: ${errorMessage}. Please try again or contact support if the issue persists.`,
            'UNKNOWN_ERROR',
            error
        )
    }
}

/**
 * Check if user is eligible for Hypercert minting
 * Returns eligibility status and hypercert number if eligible
 */
export function checkHypercertEligibility(cleanupCount: number): {
    isEligible: boolean
    hypercertNumber: number
    nextMilestone: number
} {
    const isEligible = cleanupCount > 0 && cleanupCount % 10 === 0
    const hypercertNumber = Math.floor(cleanupCount / 10)
    const nextMilestone = Math.ceil(cleanupCount / 10) * 10

    return {
        isEligible,
        hypercertNumber,
        nextMilestone,
    }
}
