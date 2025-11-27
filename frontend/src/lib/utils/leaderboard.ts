import { Address } from 'viem'
import { getDCUBalance, getCleanupCounter, getCleanupDetails } from '@/lib/blockchain/contracts'

export interface LeaderboardUser {
  address: Address
  totalDCU: number
  country?: string
  cleanups: number
  rank: number
}

/**
 * Reverse geocode coordinates to country
 * Uses a simple API to get country from lat/lng
 */
async function getCountryFromCoordinates(lat: number, lng: number): Promise<string | undefined> {
  try {
    // Using a free geocoding service
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    )
    const data = await response.json()
    return data.countryName || data.countryCode || undefined
  } catch (error) {
    console.warn('Failed to geocode coordinates:', error)
    return undefined
  }
}

/**
 * Get leaderboard data - top 10 users by total cDCU
 */
export async function getLeaderboardData(): Promise<LeaderboardUser[]> {
  try {
    // Get all cleanup submissions to find unique users
    const cleanupCount = await getCleanupCounter()
    if (cleanupCount === BigInt(0)) {
      return []
    }

    // Collect unique users and their data
    const userMap = new Map<Address, {
      totalDCU: number
      cleanups: number
      coordinates: Array<{ lat: number; lng: number }>
    }>()

    // Fetch recent cleanups (last 100 to avoid too many calls)
    const maxCheck = 100
    const startId = cleanupCount > BigInt(maxCheck) ? cleanupCount - BigInt(maxCheck) : BigInt(1)
    
    for (let id = cleanupCount - BigInt(1); id >= startId && id >= BigInt(1); id--) {
      try {
        const details = await getCleanupDetails(id)
        const user = details.submitter as Address
        
        if (!userMap.has(user)) {
          // Get user's total DCU balance
          let totalDCU = 0
          try {
            totalDCU = await getDCUBalance(user)
          } catch (error) {
            console.warn(`Failed to get DCU balance for ${user}:`, error)
          }

          userMap.set(user, {
            totalDCU,
            cleanups: 0,
            coordinates: [],
          })
        }

        const userData = userMap.get(user)!
        userData.cleanups++
        
        // Store coordinates for geocoding
        // Coordinates are stored as int256 scaled by 1e6
        const lat = Number(details.latitude)
        const lng = Number(details.longitude)
        if (lat !== 0 && lng !== 0) {
          userData.coordinates.push({
            lat: lat / 1e6, // Convert from scaled int
            lng: lng / 1e6,
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch cleanup ${id}:`, error)
        // Continue with next cleanup
      }
    }

    // Convert to array and sort by total DCU
    const users = Array.from(userMap.entries()).map(([address, data]) => ({
      address,
      totalDCU: data.totalDCU,
      cleanups: data.cleanups,
      coordinates: data.coordinates,
    }))

    // Sort by total DCU (descending)
    users.sort((a, b) => b.totalDCU - a.totalDCU)

    // Get top 10
    const topUsers = users.slice(0, 10)

    // Geocode countries for top users (use most recent coordinates)
    const leaderboardUsers: LeaderboardUser[] = await Promise.all(
      topUsers.map(async (user, index) => {
        let country: string | undefined
        if (user.coordinates.length > 0) {
          // Use most recent coordinates
          const latestCoords = user.coordinates[user.coordinates.length - 1]
          country = await getCountryFromCoordinates(latestCoords.lat, latestCoords.lng)
        }

        return {
          address: user.address,
          totalDCU: user.totalDCU,
          country,
          cleanups: user.cleanups,
          rank: index + 1,
        }
      })
    )

    return leaderboardUsers
  } catch (error) {
    console.error('Error fetching leaderboard data:', error)
    return []
  }
}

