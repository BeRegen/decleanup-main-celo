import { Address, encodeFunctionData, parseAbi } from 'viem'
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
  simulateContract,
  getChainId,
  switchChain,
  getAccount,
} from 'wagmi/actions'
import {
  config,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_RPC_URL,
  REQUIRED_CHAIN_IS_TESTNET,
} from './wagmi'
import { tryAddRequiredChain } from './network'
import * as pointsLib from '../utils/points'

// Helper to safely extract error messages
function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  // Safely check nested error properties
  if (error?.error && typeof error.error === 'object') {
    if (error.error?.message) return error.error.message
    if (error.error) return String(error.error)
  }
  if (error?.reason) return error.reason
  if (error?.shortMessage) return error.shortMessage
  if (error?.cause) {
    const causeMsg = getErrorMessage(error.cause)
    if (causeMsg !== 'Unknown error') return causeMsg
  }
  return String(error)
}

// Helper to check if error is a WalletConnect stale session error
function isWalletConnectStaleSessionError(error: any): boolean {
  if (!error) return false
  const errorMessage = getErrorMessage(error).toLowerCase()
  const errorString = String(error).toLowerCase()
  return errorMessage.includes('session topic doesn\'t exist') ||
    errorMessage.includes('no matching key') ||
    errorMessage.includes('session topic') ||
    errorString.includes('session topic doesn\'t exist') ||
    errorString.includes('no matching key')
}

// Helper to handle WalletConnect stale session errors
async function handleWalletConnectStaleSession(error: any): Promise<void> {
  if (!isWalletConnectStaleSessionError(error)) return

  console.log('WalletConnect stale session detected. Clearing session data...')

  // Clear WalletConnect storage
  if (typeof window !== 'undefined') {
    try {
      const wcKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('wc@2:') || key.startsWith('walletconnect')
      )
      wcKeys.forEach(key => localStorage.removeItem(key))
      sessionStorage.removeItem('wallet_connected_this_session')

      // Try to disconnect if possible
      try {
        const { getAccount } = await import('wagmi/actions')
        const account = getAccount(config)
        if (account.isConnected && account.connector?.id?.includes('walletconnect')) {
          const { disconnect } = await import('wagmi/actions')
          await disconnect(config)
        }
      } catch (disconnectError) {
        console.warn('Failed to disconnect during stale session cleanup:', disconnectError)
      }
    } catch (e) {
      console.warn('Failed to clear WalletConnect storage:', e)
    }
  }

  throw new Error('WalletConnect session expired. Please reconnect your wallet and try again.')
}

const REQUIRED_CHAIN_SYMBOL = 'CELO'
const BLOCK_EXPLORER_BASE_URL =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || REQUIRED_BLOCK_EXPLORER_URL
const BLOCK_EXPLORER_NAME =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_NAME ||
  (REQUIRED_CHAIN_IS_TESTNET ? 'CeloScan (Sepolia)' : 'CeloScan')

function getRequiredChain() {
  return config.chains.find((chain) => chain.id === REQUIRED_CHAIN_ID)
}

function getNetworkSetupMessage() {
  return (
    `You can add ${REQUIRED_CHAIN_NAME} to your wallet with these settings:\n` +
    `- Network Name: ${REQUIRED_CHAIN_NAME}\n` +
    `- RPC URL: ${REQUIRED_RPC_URL}\n` +
    `- Chain ID: ${REQUIRED_CHAIN_ID}\n` +
    `- Currency Symbol: ${REQUIRED_CHAIN_SYMBOL}\n` +
    `- Block Explorer: ${BLOCK_EXPLORER_BASE_URL}`
  )
}

function getManualNetworkAddInstructions() {
  return (
    `Please add ${REQUIRED_CHAIN_NAME} to your wallet:\n` +
    `1. Open your wallet (MetaMask, Coinbase Wallet, etc.)\n` +
    `2. Go to Settings → Networks → Add Network\n` +
    `3. Enter these details:\n` +
    `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
    `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
    `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
    `   • Currency Symbol: CELO\n` +
    `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
    (REQUIRED_CHAIN_IS_TESTNET
      ? `4. Request Celo Sepolia CELO from https://faucet.celo.org/\n` +
      `5. Switch to ${REQUIRED_CHAIN_NAME} and try again.`
      : `4. Switch to ${REQUIRED_CHAIN_NAME} and try again.`)
  )
}

async function ensureWalletOnRequiredChain(context = 'transaction', providedChainId?: number | null): Promise<void> {
  // If providedChainId is valid and matches required, trust it and return early
  // This fixes the issue where useChainId() shows correct chain but getCurrentChainId() returns null
  if (providedChainId !== undefined && providedChainId !== null && providedChainId === REQUIRED_CHAIN_ID) {
    console.log(`[${context}] ✅ Already on correct chain (from provided chainId: ${providedChainId})`)
    return
  }

  // Use provided chainId if available (from useChainId hook), otherwise try to get it
  let currentChainId: number | null = providedChainId !== undefined ? providedChainId : await getCurrentChainId()
  console.log(`[${context}] Current chain ID: ${currentChainId}, required: ${REQUIRED_CHAIN_ID}`)

  // If we can't determine chain (e.g., WalletConnect), try to add the chain first
  // This helps WalletConnect-MetaMask users who might not have the chain configured
  if (currentChainId === null) {
    console.log(`[${context}] Chain ID is null, attempting to add chain for WalletConnect...`)
    try {
      const added = await tryAddRequiredChain()
      if (added) {
        // Wait a moment for the chain to be added
        await new Promise(resolve => setTimeout(resolve, 1000))
        // Try to get chain ID again
        currentChainId = await getCurrentChainId()
        if (currentChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Chain added and switched successfully`)
          return
        }
      }
      // If we still can't determine chain after adding, proceed with transaction
      // The wallet will validate the network when the transaction is sent
      console.log(`[${context}] ⚠️ Could not determine chain ID, but proceeding - wallet will validate on transaction`)
      return
    } catch (addError) {
      console.error(`[${context}] Failed to add chain:`, addError)
      // Don't throw error here - let the transaction proceed and wallet will handle it
      return
    }
  }

  // Already on correct chain - no need to switch
  if (currentChainId === REQUIRED_CHAIN_ID) {
    console.log(`[${context}] ✅ Already on correct chain`)
    return
  }

  // Check for unsupported chains
  if (currentChainId === 11142220) {
    throw new Error(
      `VeChain wallet detected (Chain ID: 11142220). Please disable the VeChain extension or use MetaMask or Coinbase Wallet.\n\n` +
      `Then switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).`
    )
  }

  // Check for Ethereum mainnet (common mistake)
  if (currentChainId === 1) {
    throw new Error(
      `Ethereum Mainnet detected (Chain ID: 1). This app requires ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n\n` +
      `Please switch to ${REQUIRED_CHAIN_NAME} in your wallet and try again.`
    )
  }

  // Check for Celo Sepolia (another common mistake - wrong testnet!)
  if (currentChainId === 44787) {
    throw new Error(
      `Celo Sepolia Testnet detected (Chain ID: 44787). This app requires ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}), not Celo!\n\n` +
      `Please switch to ${REQUIRED_CHAIN_NAME} in your wallet and try again.`
    )
  }

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(
      `${REQUIRED_CHAIN_NAME} chain is not configured in this app. Please switch to ${REQUIRED_CHAIN_NAME} manually.\n\n${getNetworkSetupMessage()}`
    )
  }

  // Force switch if on wrong chain
  if (currentChainId !== REQUIRED_CHAIN_ID) {
    console.log(`[${context}] Wrong chain (${currentChainId}), attempting to switch to ${REQUIRED_CHAIN_NAME} (${REQUIRED_CHAIN_ID})`)

    // For WalletConnect and similar connectors, try adding the chain FIRST before switching
    // This prevents "Chain not configured" errors
    try {
      console.log(`[${context}] Attempting to add chain first (for WalletConnect compatibility)...`)
      const added = await tryAddRequiredChain()
      if (added) {
        // Wait a moment for the chain to be added
        await new Promise(resolve => setTimeout(resolve, 1500))
        // Check if we're now on the correct chain
        const checkChainId = await getCurrentChainId()
        if (checkChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Chain added and automatically switched`)
          return
        }
      }
    } catch (addError) {
      console.warn(`[${context}] Pre-add chain attempt failed (may not be needed):`, addError)
      // Continue to try switching anyway
    }

    // Now try to switch
    try {
      await switchChain(config, { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })

      // Poll for chain update
      let retries = 0
      while (retries < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const newChainId = await getCurrentChainId()
        if (newChainId === REQUIRED_CHAIN_ID) {
          console.log(`[${context}] ✅ Successfully switched to ${REQUIRED_CHAIN_NAME}`)
          return
        }
        retries++
      }

      // If polling didn't confirm the switch, check one more time
      const finalCheck = await getCurrentChainId()
      if (finalCheck === REQUIRED_CHAIN_ID) {
        console.log(`[${context}] ✅ Chain switch confirmed`)
        return
      }

      throw new Error(`Failed to switch network. Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet.`)
    } catch (error: any) {
      console.error(`[${context}] Switch failed:`, error)

      // Check for WalletConnect stale session error first
      if (isWalletConnectStaleSessionError(error)) {
        await handleWalletConnectStaleSession(error)
        return // This will throw, but TypeScript needs this
      }

      const errorMessage = getErrorMessage(error)

      // If user rejected, throw specific error
      if (error?.code === 4001 || errorMessage.includes('rejected') || errorMessage.includes('User rejected')) {
        throw new Error('Network switch rejected. Please switch manually to continue.')
      }

      // Try adding the chain again if switch failed with "not configured"
      if (errorMessage.includes('Unrecognized chain') ||
        errorMessage.includes('not configured') ||
        errorMessage.includes('Chain not configured') ||
        error?.code === 4902) {
        console.log(`[${context}] Chain missing, attempting to add after switch failure...`)

        // Try multiple times with increasing delays
        let added = false
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            added = await tryAddRequiredChain(REQUIRED_CHAIN_ID)
            if (added) {
              // Wait longer for the chain to be added (especially for WalletConnect)
              await new Promise(resolve => setTimeout(resolve, 2000 + (attempt * 1000)))

              // Try switching again
              try {
                await switchChain(config, { chainId: REQUIRED_CHAIN_ID as 84532 | 8453 })
                // Wait and check
                await new Promise(resolve => setTimeout(resolve, 1500))
                const newChainId = await getCurrentChainId()
                if (newChainId === REQUIRED_CHAIN_ID) {
                  console.log(`[${context}] ✅ Chain added and switched successfully`)
                  return
                }
              } catch (retryError: any) {
                console.warn(`[${context}] Retry switch after add failed (attempt ${attempt + 1}):`, retryError)
                // If user rejected, don't retry
                if (retryError?.code === 4001 || retryError?.message?.includes('rejected')) {
                  throw new Error('Network switch rejected. Please switch manually to continue.')
                }
              }
            }
          } catch (addError) {
            console.warn(`[${context}] Add chain attempt ${attempt + 1} failed:`, addError)
          }
        }

        // If we still couldn't add/switch, provide helpful error message
        // Check if we're using WalletConnect
        const account = await getAccount(config)
        const isWalletConnect = account.connector?.id?.includes('walletConnect') ||
          account.connector?.name?.toLowerCase().includes('walletconnect')

        const walletInstructions = isWalletConnect
          ? `\n\nFor WalletConnect users:\n` +
          `1. Open your wallet app (MetaMask, etc.)\n` +
          `2. Go to Settings → Networks → Add Network\n` +
          `3. Add ${REQUIRED_CHAIN_NAME} with the details below\n` +
          `4. Return to this app and try again`
          : `\n\nPlease add the network in your wallet and try again.`

        throw new Error(
          `${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) is not configured in your wallet.${walletInstructions}\n\n` +
          `Network Details:\n` +
          `• Network Name: ${REQUIRED_CHAIN_NAME}\n` +
          `• RPC URL: ${REQUIRED_RPC_URL}\n` +
          `• Chain ID: ${REQUIRED_CHAIN_ID}\n` +
          `• Currency Symbol: ETH\n` +
          `• Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}`
        )
      }

      throw new Error(`Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) to continue.`)
    }
  }
}

function getTxExplorerUrl(transactionHash: string) {
  return `${BLOCK_EXPLORER_BASE_URL}/tx/${transactionHash}`
}

// Safely get chain ID with fallback for connectors that don't support getChainId
// Some connectors don't support getChainId, so we gracefully handle this
async function getCurrentChainId(): Promise<number | null> {
  // Set up error handler to suppress the getChainId error
  let suppressedError: Error | null = null
  const errorHandler = (event: ErrorEvent) => {
    if (event.message?.includes('getChainId') && event.message?.includes('is not a function')) {
      event.preventDefault()
      suppressedError = new Error(event.message)
    }
  }

  // Add error listener temporarily
  if (typeof window !== 'undefined') {
    window.addEventListener('error', errorHandler)
  }

  try {
    // Try the standard getChainId first
    // This will throw if the connector doesn't support it
    const chainId = await getChainId(config)
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', errorHandler)
    }
    return chainId
  } catch (error: any) {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', errorHandler)
    }

    // Check if it's the specific connector.getChainId error
    const errorMessage = getErrorMessage(error)
    const isConnectorError = errorMessage.includes('getChainId') ||
      errorMessage.includes('connector') ||
      errorMessage.includes('is not a function') ||
      suppressedError !== null

    if (isConnectorError) {
      // Silently skip chain verification for unsupported connectors
      // The wallet will validate the network when the transaction is sent
      return null
    }

    // For other errors, try getting from account as fallback
    try {
      const account = await getAccount(config)
      if (account.chainId) {
        return account.chainId
      }
    } catch (accountError: any) {
      // getAccount might also fail with the same error, so just return null
    }

    // If both fail, return null to indicate we couldn't determine the chain
    // The transaction will proceed and the wallet will reject if on wrong network
    return null
  }
}

// Contract addresses (will be set via environment variables)
// Support multiple naming conventions for flexibility
export const CONTRACT_ADDRESSES = {
  IMPACT_PRODUCT:
    (process.env.NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS ||
      process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT ||
      '') as Address,
  VERIFICATION:
    (process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_VERIFICATION_CONTRACT ||
      '') as Address,
  REWARD_DISTRIBUTOR:
    (process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
      process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS ||
      '') as Address,
}


const METADATA_CID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID || ''

// Impact Product NFT ABI
export const IMPACT_PRODUCT_ABI = parseAbi([
  'function claimLevelForUser(address user, uint256 cleanupId, uint8 level) external',
  'function getUserLevel(address user) external view returns (uint8)',
  'function getUserTokenId(address user) external view returns (uint256)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function tokenLevel(uint256 tokenId) external view returns (uint8)',
  'function userCurrentLevel(address user) external view returns (uint8)',
  'function getTokenURIForLevel(uint8 level) external view returns (string)',
  'function verificationContract() external view returns (address)',
  'function setVerificationContract(address _verificationContract) external',
])

// Verification Contract ABI (Submission.sol)
export const VERIFICATION_ABI = parseAbi([
  'function createSubmission(string calldata dataURI, string calldata beforePhotoHash, string calldata afterPhotoHash, string calldata impactFormDataHash, int256 lat, int256 lng, address referrer) external payable returns (uint256)',
  'function attachRecyclables(uint256 submissionId, string calldata recyclablesPhotoHash, string calldata recyclablesReceiptHash) external',
  'function approveSubmission(uint256 submissionId) external',
  'function rejectSubmission(uint256 submissionId) external',
  'function claimRewards() external',
  'function getSubmissionDetails(uint256 submissionId) external view returns ((uint256 id, address submitter, string dataURI, string beforePhotoHash, string afterPhotoHash, string impactFormDataHash, int256 latitude, int256 longitude, uint256 timestamp, uint8 status, address approver, uint256 processedTimestamp, bool rewarded, uint256 feePaid, bool feeRefunded, bool hasImpactForm))',
  'function getHypercertEligibility(address user) external view returns (uint256 cleanupCount, uint256 hypercertCount, bool isEligible)',
  'function submissionCount() external view returns (uint256)',
  'function submissionFee() external view returns (uint256)',
  'function feeEnabled() external view returns (bool)',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function getClaimableRewards(address user) external view returns (uint256)',
  'function getHypercertEligibility(address user) external view returns (uint256 cleanupCount, uint256 hypercertCount, bool isEligible)',
  'function getSubmissionBatch(uint256 startIndex, uint256 batchSize) external view returns ((uint256 id, address submitter, string dataURI, string beforePhotoHash, string afterPhotoHash, string impactFormDataHash, int256 latitude, int256 longitude, uint256 timestamp, uint8 status, address approver, uint256 processedTimestamp, bool rewarded, uint256 feePaid, bool feeRefunded, bool hasImpactForm)[])',
])

// Reward Distributor ABI
// NOTE: Contract is upgradeable. V2 includes DCU token migration support.
// DCU Points are stored directly in RewardDistributor contract.
// After token deployment, points can be migrated to actual DCU tokens.
export const REWARD_DISTRIBUTOR_ABI = parseAbi([
  'function getStreakCount(address user) external view returns (uint256)',
  'function hasActiveStreak(address user) external view returns (bool)',
  'function getPointsBalance(address user) external view returns (uint256)',
  'function pointsBalance(address user) external view returns (uint256)',
  // V2 upgradeable functions (may not exist in V1)
  'function getDCUBalance(address user) external view returns (uint256 balance, bool isTokenBalance)',
  'function migratePointsToToken() external returns (uint256)',
  'function dcuToken() external view returns (address)',
  'function tokenMigrationEnabled() external view returns (bool)',
  'function hasMigrated(address user) external view returns (bool)',
  // Hypercert reward functions (DCURewardManager)
  'function claimHypercertReward(uint256 hypercertNumber) external',
  'function hypercertRewardsClaimed(bytes32) external view returns (bool)',
  'function hypercertBonus() external view returns (uint256)',
])


// Impact Product Functions

/**
 * Get user's current Impact Product level
 */
export async function getUserLevel(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product contract address not set')
  }

  const level = await readContract(config, {
    address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
    abi: IMPACT_PRODUCT_ABI,
    functionName: 'userCurrentLevel',
    args: [userAddress],
  })

  return Number(level)
}

/**
 * Get user's Impact Product token ID
 */
export async function getUserTokenId(userAddress: Address): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
    abi: IMPACT_PRODUCT_ABI,
    functionName: 'getUserTokenId',
    args: [userAddress],
  })
}

/**
 * Get token URI for a specific level
 */
export async function getTokenURIForLevel(level: number): Promise<string> {
  const fallback = METADATA_CID ? `ipfs://${METADATA_CID}/level${level}.json` : null

  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    if (fallback) {
      return fallback
    }
    throw new Error('Impact Product contract address not set')
  }

  try {
    return await readContract(config, {
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
      abi: IMPACT_PRODUCT_ABI,
      functionName: 'getTokenURIForLevel',
      args: [level],
    })
  } catch (error) {
    if (fallback) {
      console.warn('Falling back to static metadata CID for level', level, error)
      return fallback
    }
    throw error
  }
}

/**
 * Get token URI for a user's actual token ID
 */
export async function getTokenURI(tokenId: bigint): Promise<string> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    throw new Error('Impact Product contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.IMPACT_PRODUCT,
    abi: IMPACT_PRODUCT_ABI,
    functionName: 'tokenURI',
    args: [tokenId],
  })
}

/**
 * Claim Impact Product level (DEPRECATED - use claimImpactProductFromVerification instead)
 * This function is not used in the current flow but kept for backwards compatibility
 * @deprecated Use claimImpactProductFromVerification instead
 */
export async function claimImpactProduct(cleanupId: bigint, level: number): Promise<`0x${string}`> {
  // This function is deprecated - the actual flow uses claimImpactProductFromVerification
  // which calls VerificationContract.claimImpactProduct() which then calls
  // ImpactProductNFT.claimLevelForUser()
  throw new Error('claimImpactProduct is deprecated. Use claimImpactProductFromVerification instead.')
}

// DCU Points Functions
// NOTE: Currently uses points system. DCU token contract will be integrated soon.
// When DCU token is deployed, points will be migrated to actual tokens.
// The contract is upgradeable to support seamless migration without redeployment.

/**
 * Get user's DCU points balance from onchain storage
 * Points are stored directly in RewardDistributor contract
 * 
 * TODO: After DCU token deployment, this will check if user has migrated
 * and return token balance instead of points balance
 */
export async function getPointsBalance(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    // Fallback to local storage for development
    return pointsLib.getPointsBalance(userAddress)
  }

  try {
    // Try to get DCU balance (handles both points and tokens if migrated)
    // First check if contract has getDCUBalance function (V2 upgradeable)
    try {
      const result = await readContract(config, {
        address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
        abi: REWARD_DISTRIBUTOR_ABI,
        functionName: 'getDCUBalance',
        args: [userAddress],
      })

      // V2 returns (balance, isTokenBalance)
      if (Array.isArray(result) && result.length === 2) {
        const balance = result[0] as bigint
        return Number(balance) / 1e18
      }
    } catch {
      // Fallback to getPointsBalance if getDCUBalance doesn't exist (V1)
    }

    // Read balance directly from RewardDistributor contract
    const balance = await readContract(config, {
      address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
      abi: REWARD_DISTRIBUTOR_ABI,
      functionName: 'getPointsBalance',
      args: [userAddress],
    })

    // Points use 18 decimals for consistency
    return Number(balance) / 1e18
  } catch (error) {
    console.warn('Error reading points from onchain storage, using fallback:', error)
    // Fallback to local storage for development
    return pointsLib.getPointsBalance(userAddress)
  }
}

/**
 * Get user's DCU points balance (alias for getPointsBalance)
 * Points are stored directly in RewardDistributor contract
 */
export async function getDCUBalance(userAddress: Address): Promise<number> {
  return getPointsBalance(userAddress)
}

/**
 * Get user's staked DCU points
 * Note: Staking functionality may be implemented in the future
 */
export async function getStakedDCU(userAddress: Address): Promise<number> {
  // Staking not yet implemented - return 0
  // In the future, this could read from a staking contract
  return 0
}

// Verification Contract Functions

export async function getSubmissionFee(): Promise<{ fee: bigint; enabled: boolean }> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    return { fee: BigInt(0), enabled: false }
  }

  try {
    const fee = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'submissionFee',
    }) as bigint

    const enabled = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'feeEnabled',
    }) as boolean

    return { fee, enabled }
  } catch (error: any) {
    console.error('Error getting submission fee:', error)
    return { fee: BigInt(0), enabled: false }
  }
}

export async function submitCleanup(
  beforePhotoHash: string,
  afterPhotoHash: string,
  latitude: number,
  longitude: number,
  referrerAddress: Address | null,
  hasImpactForm: boolean,
  impactReportHash: string,
  value?: bigint,
  providedChainId?: number | null
): Promise<bigint> {
  if (referrerAddress && referrerAddress !== '0x0000000000000000000000000000000000000000') {
    console.log('[submitCleanup] Referrer address provided:', referrerAddress)
  } else {
    console.log('[submitCleanup] No referrer address provided')
  }
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error(
      'Verification contract address not set. Please set NEXT_PUBLIC_VERIFICATION_CONTRACT in your .env.local file.'
    )
  }

  await ensureWalletOnRequiredChain('cleanup submission', providedChainId)

  const latScaled = BigInt(Math.floor(latitude * 1e6))
  const lngScaled = BigInt(Math.floor(longitude * 1e6))

  if (providedChainId !== undefined && providedChainId !== null && providedChainId === REQUIRED_CHAIN_ID) {
    console.log('[cleanup submission] ✅ Chain validated via providedChainId, proceeding with submission')
  } else {
    const finalChainId = await getCurrentChainId()
    if (finalChainId === null) {
      console.warn('[cleanup submission] Could not verify final chain ID, but proceeding - wallet will validate on transaction')
    } else {
      if (finalChainId === 44787) {
        throw new Error(`❌ CELO SEPOLIA DETECTED! Please switch to ${REQUIRED_CHAIN_NAME}.`)
      }
      if (finalChainId !== REQUIRED_CHAIN_ID) {
        throw new Error(`Wrong network detected. Please switch to ${REQUIRED_CHAIN_NAME}.`)
      }
    }
  }

  let simulatedCleanupId: bigint | undefined
  const dataURI = "ipfs://placeholder"

  try {
    const { result } = await simulateContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'createSubmission',
      args: [
        dataURI,
        beforePhotoHash,
        afterPhotoHash,
        impactReportHash || "",
        latScaled,
        lngScaled,
        referrerAddress || '0x0000000000000000000000000000000000000000',
      ],
      value: value || BigInt(0),
    })

    simulatedCleanupId = result as bigint
    console.log('Simulated cleanup ID:', simulatedCleanupId.toString())
  } catch (simulateError: any) {
    console.warn('Could not simulate contract call, will use counter method:', getErrorMessage(simulateError))
  }

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  if (providedChainId === undefined || providedChainId === null || providedChainId !== REQUIRED_CHAIN_ID) {
    const preTxChainId = await getCurrentChainId()
    if (preTxChainId !== null && preTxChainId !== REQUIRED_CHAIN_ID) {
      throw new Error(`Please switch to ${REQUIRED_CHAIN_NAME} before confirming the transaction.`)
    }
  }

  let hash: `0x${string}`
  try {
    hash = await writeContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'createSubmission',
      args: [
        dataURI,
        beforePhotoHash,
        afterPhotoHash,
        impactReportHash || "",
        latScaled,
        lngScaled,
        referrerAddress || '0x0000000000000000000000000000000000000000',
      ],
      value: value || BigInt(0),
      chain: targetChain,
    })
    console.log('Transaction submitted:', hash)
  } catch (error: any) {
    if (isWalletConnectStaleSessionError(error)) {
      await handleWalletConnectStaleSession(error)
    }
    throw error
  }

  const receipt = await waitForTransactionReceipt(config, { hash })
  console.log('Transaction confirmed:', receipt.transactionHash)

  if (simulatedCleanupId !== undefined) {
    return simulatedCleanupId
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    const count = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'submissionCount',
    }) as bigint
    return count - BigInt(1)
  } catch (e) {
    console.warn('Failed to fetch submission count, returning 0')
    return BigInt(0)
  }
}

/**
 * Claim Impact Product after verification
 */
export async function claimImpactProductFromVerification(
  cleanupId: bigint,
  providedChainId?: number | null
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  await ensureWalletOnRequiredChain('claim rewards', providedChainId)

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  const hash = await writeContract(config as any, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'claimRewards',
    args: [],
    chain: targetChain,
  })

  return hash
}

/**
 * Get cleanup status
 */
export async function getCleanupStatus(cleanupId: bigint): Promise<{
  user: `0x${string}`
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number
}> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  try {
    const details = await getCleanupDetails(cleanupId)

    if (!details.user || details.user === '0x0000000000000000000000000000000000000000') {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }

    return {
      user: details.user,
      verified: details.verified,
      claimed: details.claimed,
      rejected: details.rejected,
      level: details.level,
    }
  } catch (error: any) {
    const errorMessage = getErrorMessage(error)
    if (errorMessage.includes('revert') || errorMessage.includes('does not exist')) {
      throw new Error(`Cleanup ${cleanupId.toString()} does not exist`)
    }
    throw new Error(`Failed to get cleanup status: ${errorMessage}`)
  }
}

/**
 * Get full cleanup details (for verifiers)
 */
export async function getCleanupDetails(cleanupId: bigint): Promise<{
  user: `0x${string}`
  beforePhotoHash: string
  afterPhotoHash: string
  timestamp: bigint
  latitude: bigint
  longitude: bigint
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number
  referrer: `0x${string}`
  hasImpactForm: boolean
  impactReportHash: string
}> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  const result = await readContract(config, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'getSubmissionDetails',
    args: [cleanupId],
  })

  // Result struct:
  // (id, submitter, dataURI, beforePhotoHash, afterPhotoHash, impactFormDataHash, latitude, longitude, timestamp, status, approver, processedTimestamp, rewarded, feePaid, feeRefunded, hasImpactForm)
  // status enum: 0=Pending, 1=Approved, 2=Rejected

  const r = result as any

  return {
    user: r.submitter,
    beforePhotoHash: r.beforePhotoHash,
    afterPhotoHash: r.afterPhotoHash,
    timestamp: r.timestamp,
    latitude: r.latitude,
    longitude: r.longitude,
    verified: r.status === 1, // Approved
    claimed: r.rewarded,
    rejected: r.status === 2, // Rejected
    level: 1, // Default
    referrer: '0x0000000000000000000000000000000000000000',
    hasImpactForm: r.hasImpactForm,
    impactReportHash: r.impactFormDataHash,
  }
}

/**
 * Get cleanup counter (total number of cleanups)
 */
export async function getCleanupCounter(): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'submissionCount',
  })
}

/**
 * Check if an address is a verifier
 */
export async function isVerifier(address: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) return false
  try {
    // ADMIN_ROLE hash
    const ADMIN_ROLE = '0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775' as `0x${string}`
    return await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'hasRole',
      args: [ADMIN_ROLE, address],
    }) as boolean
  } catch (error) {
    console.error('Error checking verifier role:', error)
    return false
  }
}

/**
 * Get verifier address (deprecated)
 */
export async function getVerifierAddress(): Promise<Address> {
  return '0x0000000000000000000000000000000000000000'
}

/**
 * Verify cleanup (approve submission)
 */
export async function verifyCleanup(
  cleanupId: bigint,
  level: number,
  providedChainId?: number | null
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  await ensureWalletOnRequiredChain('verification', providedChainId)

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  const hash = await writeContract(config as any, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'approveSubmission',
    args: [cleanupId],
    chain: targetChain,
  })

  return hash
}

/**
 * Reject a cleanup submission
 */
export async function rejectCleanup(
  cleanupId: bigint,
  providedChainId?: number | null
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  await ensureWalletOnRequiredChain('rejection', providedChainId)

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  const hash = await writeContract(config as any, {
    address: CONTRACT_ADDRESSES.VERIFICATION,
    abi: VERIFICATION_ABI,
    functionName: 'rejectSubmission',
    args: [cleanupId],
    chain: targetChain,
  })

  return hash
}

// Reward Distributor Functions

/**
 * Get user's streak count
 */
export async function getStreakCount(userAddress: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    throw new Error('Reward Distributor contract address not set')
  }

  const streak = await readContract(config, {
    address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'getStreakCount',
    args: [userAddress],
  })

  return Number(streak)
}

/**
 * Check if user has active streak
 */
export async function hasActiveStreak(userAddress: Address): Promise<boolean> {
  if (!CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    throw new Error('Reward Distributor contract address not set')
  }

  return await readContract(config, {
    address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
    abi: REWARD_DISTRIBUTOR_ABI,
    functionName: 'hasActiveStreak',
    args: [userAddress],
  })
}
/**
 * Get claimable rewards for a user
 */
export async function getClaimableRewards(userAddress: Address): Promise<bigint> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    return BigInt(0)
  }

  try {
    return await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'getClaimableRewards',
      args: [userAddress],
    }) as bigint
  } catch (error) {
    console.error('Error getting claimable rewards:', error)
    return BigInt(0)
  }
}

/**
 * Attach recyclables data to an existing submission
 * This is a separate function that can be easily removed if not needed
 * 
 * @param submissionId The ID of the submission to attach recyclables to
 * @param recyclablesPhotoHash IPFS hash of the recyclables photo
 * @param recyclablesReceiptHash IPFS hash of the recyclables receipt (optional, can be empty string)
 * @param providedChainId Optional chain ID to avoid detection bugs
 * @returns Transaction hash
 */
export async function attachRecyclablesToSubmission(
  submissionId: bigint,
  recyclablesPhotoHash: string,
  recyclablesReceiptHash: string = '',
  providedChainId?: number | null
): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    throw new Error('Verification contract address not set')
  }

  if (!recyclablesPhotoHash || recyclablesPhotoHash.trim() === '') {
    throw new Error('Recyclables photo hash is required')
  }

  await ensureWalletOnRequiredChain('attach recyclables', providedChainId)

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  try {
    const hash = await writeContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'attachRecyclables',
      args: [
        submissionId,
        recyclablesPhotoHash,
        recyclablesReceiptHash || '',
      ],
      chain: targetChain,
    })

    console.log('Recyclables attachment transaction submitted:', hash)
    
    // Wait for transaction confirmation
    await waitForTransactionReceipt(config, { hash })
    console.log('Recyclables attachment transaction confirmed:', hash)

    return hash
  } catch (error: any) {
    if (isWalletConnectStaleSessionError(error)) {
      await handleWalletConnectStaleSession(error)
    }
    throw error
  }
}

/**
 * Get hypercert eligibility for a user
 * Returns cleanup count, hypercert count, and eligibility status
 */
export async function getHypercertEligibility(userAddress: Address): Promise<{
  cleanupCount: bigint
  hypercertCount: bigint
  isEligible: boolean
}> {
  if (!CONTRACT_ADDRESSES.VERIFICATION) {
    return { cleanupCount: BigInt(0), hypercertCount: BigInt(0), isEligible: false }
  }

  try {
    const result = await readContract(config, {
      address: CONTRACT_ADDRESSES.VERIFICATION,
      abi: VERIFICATION_ABI,
      functionName: 'getHypercertEligibility',
      args: [userAddress],
    }) as [bigint, bigint, boolean]

    return {
      cleanupCount: result[0],
      hypercertCount: result[1],
      isEligible: result[2],
    }
  } catch (error) {
    console.error('Error getting hypercert eligibility:', error)
    return { cleanupCount: BigInt(0), hypercertCount: BigInt(0), isEligible: false }
  }
}

/**
 * Claim hypercert reward (10 $cDCU) for a specific hypercert number
 * Users can claim their own reward after minting a hypercert
 * @param hypercertNumber The hypercert number (1, 2, 3...)
 * @returns Transaction hash
 */
export async function claimHypercertReward(hypercertNumber: number): Promise<`0x${string}`> {
  if (!CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    throw new Error('Reward distributor contract address not set')
  }

  await ensureWalletOnRequiredChain('claim hypercert reward')

  const targetChain = getRequiredChain()
  if (!targetChain) {
    throw new Error(`${REQUIRED_CHAIN_NAME} chain is not configured.`)
  }

  try {
    const hash = await writeContract(config, {
      address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR,
      abi: REWARD_DISTRIBUTOR_ABI,
      functionName: 'claimHypercertReward',
      args: [BigInt(hypercertNumber)],
      chain: targetChain,
    })

    console.log('Hypercert reward claim transaction submitted:', hash)
    
    // Wait for transaction confirmation
    await waitForTransactionReceipt(config, { hash })
    console.log('Hypercert reward claim transaction confirmed:', hash)

    return hash
  } catch (error: any) {
    if (isWalletConnectStaleSessionError(error)) {
      await handleWalletConnectStaleSession(error)
    }
    throw error
  }
}
