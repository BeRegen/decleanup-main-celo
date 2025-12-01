import { Address } from 'viem'
import { getCleanupStatus } from './contracts'

/**
 * Verification Status Utilities
 * Check cleanup verification status
 */

export interface VerificationStatus {
  cleanupId: bigint
  verified: boolean
  claimed: boolean
  level: number
  canClaim: boolean
}

/**
 * Get user's pending cleanups
 */
export async function getPendingCleanups(userAddress: Address): Promise<VerificationStatus[]> {
  // TODO: Fetch from backend API or contract events
  // For now, return empty array
  return []
}

/**
 * Find user's cleanup by checking recent cleanup IDs onchain
 * This is a fallback when localStorage doesn't have the cleanup ID
 */
async function findUserCleanupOnchain(
  userAddress: Address
): Promise<VerificationStatus | null> {
  try {
    const { getCleanupCounter, getCleanupStatus } = await import('./contracts')
    
    // Get the current cleanup counter
    const counter = await getCleanupCounter()
    console.log('[findUserCleanupOnchain] Cleanup counter:', counter.toString())
    
    if (counter <= BigInt(1)) {
      // No cleanups exist yet
      console.log('[findUserCleanupOnchain] No cleanups exist yet')
      return null
    }
    
    // Check recent cleanups (last 50 to avoid too many calls)
    // Start from the most recent and work backwards
    const maxCheck = 50
    const startId = counter > BigInt(maxCheck) ? counter - BigInt(maxCheck) : BigInt(1)
    console.log(`[findUserCleanupOnchain] Searching from ${startId.toString()} to ${(counter - BigInt(1)).toString()} for user ${userAddress}`)
    
    for (let id = counter - BigInt(1); id >= startId; id--) {
      try {
        const status = await getCleanupStatus(id)
        
        // Check if this cleanup belongs to the user
        if (status.user.toLowerCase() === userAddress.toLowerCase()) {
          console.log(`[findUserCleanupOnchain] ✅ Found user's cleanup onchain: ${id.toString()}`, {
            verified: status.verified,
            claimed: status.claimed,
            level: status.level,
            rejected: status.rejected,
          })
          
          // Update localStorage with the found cleanup ID
          if (typeof window !== 'undefined') {
            const pendingKey = `pending_cleanup_id_${userAddress.toLowerCase()}`
            localStorage.setItem(pendingKey, id.toString())
          }
          
          return {
            cleanupId: id,
            verified: status.verified,
            claimed: status.claimed,
            level: status.level,
            canClaim: status.verified && !status.claimed,
          }
        }
      } catch (error: any) {
        // Skip if cleanup doesn't exist or other error
        const errorMessage = error?.message || String(error)
        if (!errorMessage.includes('does not exist')) {
          console.warn(`[findUserCleanupOnchain] Error checking cleanup ${id.toString()}:`, errorMessage)
        }
        // Continue checking other IDs
      }
    }
    
    console.log('[findUserCleanupOnchain] ❌ No cleanup found for user')
    return null
  } catch (error) {
    console.error('[findUserCleanupOnchain] Error finding cleanup onchain:', error)
    return null
  }
}

/**
 * Get user's latest cleanup status
 * Checks localStorage first, then falls back to onchain search
 */
export async function getLatestCleanupStatus(
  userAddress: Address
): Promise<VerificationStatus | null> {
  try {
    // First, check localStorage for quick access
    if (typeof window !== 'undefined' && userAddress) {
      const pendingKey = `pending_cleanup_id_${userAddress.toLowerCase()}`
      const pendingCleanupId = localStorage.getItem(pendingKey)
      
      if (pendingCleanupId) {
        try {
          const { getCleanupStatus } = await import('./contracts')
          const status = await getCleanupStatus(BigInt(pendingCleanupId))
          
          // Verify this cleanup belongs to the current user
          if (status.user.toLowerCase() !== userAddress.toLowerCase()) {
            console.log('Cleanup belongs to different user, clearing localStorage')
            localStorage.removeItem(pendingKey)
            localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
            // Fall through to onchain search
          } else if (status.rejected) {
            // If cleanup is rejected, clear localStorage and don't return it
            console.log('Cleanup is rejected, clearing localStorage to allow new submission')
            localStorage.removeItem(pendingKey)
            localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
            // Fall through to onchain search (won't find anything, will return null)
          } else {
            // Found valid cleanup in localStorage
            return {
              cleanupId: BigInt(pendingCleanupId),
              verified: status.verified,
              claimed: status.claimed,
              level: status.level,
              canClaim: status.verified && !status.claimed,
            }
          }
        } catch (error: any) {
          // If cleanup doesn't exist, clear localStorage and search onchain
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('does not exist')) {
            console.log('Cleanup not found in localStorage, searching onchain...')
            localStorage.removeItem(pendingKey)
            localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
          }
        }
      }
      
      // Also check and clear old global keys for backward compatibility
      const oldPendingId = localStorage.getItem('pending_cleanup_id')
      if (oldPendingId) {
        localStorage.removeItem('pending_cleanup_id')
        localStorage.removeItem('pending_cleanup_location')
      }
    }
    
    // If not found in localStorage, search onchain
    console.log('Searching for user cleanup onchain...')
    return await findUserCleanupOnchain(userAddress)
  } catch (error) {
    console.error('Error getting cleanup status:', error)
    return null
  }
}

/**
 * Get user's cleanup and claim status in a single call
 * Returns all information needed for the UI
 */
export async function getUserCleanupStatus(
  userAddress: Address
): Promise<{
  hasPendingCleanup: boolean
  canClaim: boolean
  cleanupId?: bigint
  reason?: string
  verified?: boolean
  claimed?: boolean
  level?: number
  rejected?: boolean
}> {
  try {
    console.log('[getUserCleanupStatus] Checking status for:', userAddress)
    const latest = await getLatestCleanupStatus(userAddress)
    console.log('[getUserCleanupStatus] Latest cleanup status:', latest)
    
    if (!latest) {
      // Check if there's a rejected cleanup that was recently cleared
      // We'll check onchain for the most recent cleanup to see if it was rejected
      if (typeof window !== 'undefined' && userAddress) {
        const pendingKey = `pending_cleanup_id_${userAddress.toLowerCase()}`
        const oldPendingId = localStorage.getItem(pendingKey)
        if (oldPendingId) {
          try {
            const { getCleanupStatus } = await import('./contracts')
            const status = await getCleanupStatus(BigInt(oldPendingId))
            if (status.rejected && status.user.toLowerCase() === userAddress.toLowerCase()) {
              // Cleanup was rejected - clear localStorage and return rejection status
              localStorage.removeItem(pendingKey)
              localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
              return {
                hasPendingCleanup: false,
                canClaim: false,
                rejected: true,
                reason: 'Your latest cleanup submission was rejected. Please submit a new cleanup.',
              }
            }
          } catch (error) {
            // Cleanup doesn't exist or error - clear localStorage
          console.log('Clearing stale localStorage cleanup data')
          localStorage.removeItem(pendingKey)
          localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
          }
        }
        // Also clear old global keys
        localStorage.removeItem('pending_cleanup_id')
        localStorage.removeItem('pending_cleanup_location')
      }
      
      return {
        hasPendingCleanup: false,
        canClaim: false,
        reason: 'No cleanup submissions found. Submit a cleanup first.',
      }
    }
    
    const hasPending = !latest.verified
    // canClaim = verified AND Impact Product NOT claimed (not base reward claimed)
    // We need to check Impact Product claim status separately
    let canClaim = false
    try {
      const { getUserLevel } = await import('./contracts')
      const userLevel = await getUserLevel(userAddress)
      // If cleanup is verified and user hasn't claimed Impact Product for this level yet
      // For now, we'll check if cleanup is verified and user level is less than cleanup level
      // This is a simplified check - ideally we'd track which cleanups were used for which level
      canClaim = latest.verified && !impactProductClaimed
    } catch (levelError) {
      // Fallback: if verified and base reward not claimed, allow claim
      console.warn('Could not check Impact Product claim status, using fallback:', levelError)
      canClaim = latest.verified && !status.claimed
    }
    
    console.log('[getUserCleanupStatus] Calculated status:', {
      hasPending,
      canClaim,
      verified: latest.verified,
      claimed: latest.claimed,
      cleanupId: latest.cleanupId.toString(),
    })
    
    // Check if this cleanup was rejected
    const { getCleanupStatus, getUserLevel } = await import('./contracts')
    const status = await getCleanupStatus(latest.cleanupId)
    const isRejected = status.rejected
    
    // IMPORTANT: 'status.claimed' refers to base cleanup reward (10 cDCU), NOT Impact Product claim
    // We need to check if the Impact Product was actually claimed by checking the user's level
    // If user's level matches the cleanup's level, then this cleanup's Impact Product was claimed
    let impactProductClaimed = false
    try {
      const userLevel = await getUserLevel(userAddress)
      // If user has a level >= latest.level, they've claimed at least up to that level
      // But we need to be more precise - check if THIS cleanup's level was claimed
      // For now, we'll assume if user has any level and cleanup is verified, they can claim
      // The actual check should be: has user claimed Impact Product for THIS cleanup's level?
      impactProductClaimed = userLevel >= (latest.level || 1)
    } catch (levelError) {
      console.warn('Could not check user level for Impact Product claim status:', levelError)
      // Fall back to checking if base reward was claimed
      impactProductClaimed = status.claimed
    }
    
    console.log('[getUserCleanupStatus] Onchain status check:', {
      verified: status.verified,
      baseRewardClaimed: status.claimed, // Base cleanup reward (10 cDCU)
      impactProductClaimed, // Impact Product NFT claim
      rejected: status.rejected,
      level: status.level,
      user: status.user,
    })
    
    if (isRejected) {
      // Clear localStorage for rejected cleanup
      if (typeof window !== 'undefined' && userAddress) {
        const pendingKey = `pending_cleanup_id_${userAddress.toLowerCase()}`
        localStorage.removeItem(pendingKey)
        localStorage.removeItem(`pending_cleanup_location_${userAddress.toLowerCase()}`)
      }
      return {
        hasPendingCleanup: false,
        canClaim: false,
        rejected: true,
        reason: 'Your latest cleanup submission was rejected. Please submit a new cleanup.',
      }
    }
    
    const result = {
      hasPendingCleanup: hasPending,
      canClaim,
      cleanupId: latest.cleanupId,
      verified: latest.verified,
      claimed: latest.claimed,
      level: latest.level,
      rejected: false,
      reason: hasPending
        ? 'Your cleanup is still under review. Please wait for verification.'
        : latest.claimed
        ? 'Your cleanup has already been claimed.'
        : canClaim
        ? undefined
        : 'No cleanup ready to claim.',
    }
    
    console.log('[getUserCleanupStatus] Final result:', result)
    return result
  } catch (error) {
    console.error('Error checking cleanup status:', error)
    return {
      hasPendingCleanup: false,
      canClaim: false,
      reason: 'Error checking cleanup status. Please try again.',
    }
  }
}

/**
 * Check if user can claim level
 */
export async function canClaimLevel(
  userAddress: Address,
  cleanupId?: bigint
): Promise<{ canClaim: boolean; reason?: string }> {
  try {
    if (!cleanupId) {
      // Get latest cleanup
      const latest = await getLatestCleanupStatus(userAddress)
      if (!latest) {
        return {
          canClaim: false,
          reason: 'No cleanup submissions found. Submit a cleanup first.',
        }
      }
      
      if (!latest.verified) {
        return {
          canClaim: false,
          reason: 'Your cleanup is still under review. Please wait for verification.',
        }
      }
      
      if (latest.claimed) {
        return {
          canClaim: false,
          reason: 'This cleanup has already been claimed.',
        }
      }
      
      return {
        canClaim: true,
      }
    }
    
    // Check specific cleanup
    const status = await getCleanupStatus(cleanupId)
    
    if (!status.verified) {
      return {
        canClaim: false,
        reason: 'Your cleanup is still under review. Please wait for verification.',
      }
    }
    
    if (status.claimed) {
      return {
        canClaim: false,
        reason: 'This cleanup has already been claimed.',
      }
    }
    
    return {
      canClaim: true,
    }
  } catch (error) {
    console.error('Error checking claim status:', error)
    return {
      canClaim: false,
      reason: 'Error checking claim status. Please try again.',
    }
  }
}

