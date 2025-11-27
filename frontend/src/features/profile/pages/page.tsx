import { generateReferralLink, formatImpactShareMessage, shareCast } from '@/lib/utils/sharing'
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import { FeeDisplay } from '@/components/ui/fee-display'
import { BackButton } from '@/components/layout/BackButton'
import {
  Award,
  TrendingUp,
  Leaf,
  Loader2,
  Flame,
  Clock,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  Share2,
  Copy,
} from 'lucide-react'
import Link from 'next/link'
import { getDCUBalance, getStakedDCU, getUserLevel, getUserTokenId, getTokenURI, getTokenURIForLevel, getStreakCount, hasActiveStreak, getCleanupStatus, claimImpactProductFromVerification, CONTRACT_ADDRESSES } from '@/lib/blockchain/contracts'
import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/wagmi'
import { useChainId } from 'wagmi'
import { DashboardPersonalStats } from '@/components/dashboard/DashboardPersonalStats'
import { DashboardImpactProduct } from '@/components/dashboard/DashboardImpactProduct'
import { DashboardActions } from '@/components/dashboard/DashboardActions'

const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'CeloScan (Sepolia)'
  : 'CeloScan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

interface ImpactAttribute {
  trait_type?: string
  value?: string | number
}

interface ImpactMetadata {
  name?: string
  description?: string
  external_url?: string
  image?: string
  animation_url?: string
  attributes?: ImpactAttribute[]
}

function extractImpactStats(metadata: ImpactMetadata | null) {
  let impactValue: string | null = null
  let dcuReward: string | null = null

  metadata?.attributes?.forEach((attr) => {
    const trait = attr?.trait_type?.toLowerCase()
    if (!trait) return
    if (trait === 'impact value') {
      impactValue = attr.value != null ? String(attr.value) : null
    } else if (trait === '$dcu' || trait === 'dcu' || trait.includes('dcu')) {
      dcuReward = attr.value != null ? String(attr.value) : null
    }
  })

  return { impactValue, dcuReward }
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [hasMounted, setHasMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState({
    dcuBalance: 0,
    stakedDCU: 0,
    level: 0,
    streak: 0,
    hasActiveStreak: false,
    tokenURI: '',
    imageUrl: '',
    animationUrl: '',
    metadata: null as ImpactMetadata | null,
    tokenId: null as bigint | null,
    impactValue: null as string | null,
    dcuReward: null as string | null,
  })
  const [cleanupStatus, setCleanupStatus] = useState<{
    cleanupId: bigint | null
    verified: boolean
    claimed: boolean
    level: number
    loading: boolean
  } | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copyingField, setCopyingField] = useState<string | null>(null)

  // Prevent hydration mismatch by ensuring we render only after mounting
  useEffect(() => {
    setHasMounted(true)
  }, [])

  const loadProfileData = useCallback(
    async (userAddress: Address, options?: { showSpinner?: boolean }) => {
      const showSpinner = options?.showSpinner ?? true
      try {
        if (showSpinner) {
          setLoading(true)
        }

        const [dcuBalance, stakedDCU, level, streak, activeStreak] = await Promise.all([
          getDCUBalance(userAddress),
          getStakedDCU(userAddress),
          getUserLevel(userAddress),
          getStreakCount(userAddress),
          hasActiveStreak(userAddress),
        ])

        let tokenURI = ''
        let imageUrl = ''
        let animationUrl = ''
        let metadata: ImpactMetadata | null = null
        let tokenId: bigint | null = null
        let impactValue: string | null = null
        let dcuReward: string | null = null

        if (level > 0) {
          try {
            tokenId = await getUserTokenId(userAddress)

            if (tokenId > BigInt(0)) {
              try {
                tokenURI = await getTokenURI(tokenId)
              } catch (error) {
                console.warn('Failed to get tokenURI from tokenId, using level-based URI:', error)
                tokenURI = await getTokenURIForLevel(level)
              }
            } else {
              tokenURI = await getTokenURIForLevel(level)
            }

            const convertIPFSToGateway = (ipfsUrl: string, gateways?: string[]) => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return ipfsUrl
              }
              let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
              if (path.startsWith('/')) path = path.substring(1)

              const defaultGateways = [
                process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
              ]
              const gatewayList = gateways || defaultGateways
              return `${gatewayList[0]}${path} `
            }

            const fetchWithFallback = async (ipfsUrl: string): Promise<Response> => {
              if (!ipfsUrl.startsWith('ipfs://')) {
                return fetch(ipfsUrl)
              }

              const gateways = [
                process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
              ]

              let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
              if (path.startsWith('/')) path = path.substring(1)

              for (const gateway of gateways) {
                try {
                  const url = `${gateway}${path} `
                  const response = await fetch(url, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                    redirect: 'follow',
                  })
                  if (response.ok) {
                    return response
                  }
                } catch (error) {
                  console.warn(`Gateway ${gateway} failed: `, error)
                }
              }

              throw new Error(`All IPFS gateways failed for: ${ipfsUrl} `)
            }

            if (tokenURI) {
              try {
                const metadataResponse = await fetchWithFallback(tokenURI)
                if (!metadataResponse.ok) {
                  throw new Error(`Failed to fetch metadata: ${metadataResponse.status} ${metadataResponse.statusText} `)
                }

                metadata = (await metadataResponse.json()) as ImpactMetadata
                const stats = extractImpactStats(metadata)
                impactValue = stats.impactValue
                dcuReward = stats.dcuReward

                if (metadata?.image) {
                  let fixedImagePath = metadata.image
                  const imagesCID =
                    process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
                  if (fixedImagePath.includes('/images/level')) {
                    const levelMatch = fixedImagePath.match(/level(\d+)\.png/)
                    if (levelMatch) {
                      const levelNum = levelMatch[1]
                      fixedImagePath =
                        levelNum === '10'
                          ? `ipfs://${imagesCID}/IP10Placeholder.png`
                          : `ipfs://${imagesCID}/IP${levelNum}.png`
                    }
                  }
                  imageUrl = convertIPFSToGateway(fixedImagePath)
                }

                if (metadata?.animation_url) {
                  let fixedAnimationPath = metadata.animation_url
                  if (fixedAnimationPath.includes('/video/level10')) {
                    fixedAnimationPath = `ipfs://${process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'}/IP10VIdeo.mp4`
                  }
                  animationUrl = convertIPFSToGateway(fixedAnimationPath)
                }
              } catch (metadataError) {
                console.error('❌ Error fetching metadata:', metadataError)
                const fallbackCID = process.env.NEXT_PUBLIC_IMPACT_METADATA_CID
                if (fallbackCID && level > 0) {
                  try {
                    const fallbackUrl = `https://gateway.pinata.cloud/ipfs/${fallbackCID}/level${level}.json`
                    const fallbackResponse = await fetch(fallbackUrl)
                    if (fallbackResponse.ok) {
                      metadata = (await fallbackResponse.json()) as ImpactMetadata
                      const stats = extractImpactStats(metadata)
                      impactValue = stats.impactValue
                      dcuReward = stats.dcuReward
                      if (metadata?.image) {
                        imageUrl = convertIPFSToGateway(metadata.image)
                      }
                      if (metadata?.animation_url) {
                        animationUrl = convertIPFSToGateway(metadata.animation_url)
                      }
                    }
                  } catch (fallbackError) {
                    console.error('❌ Fallback also failed:', fallbackError)
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching token URI:', error)
          }
        }

        setProfileData({
          dcuBalance,
          stakedDCU,
          level,
          streak,
          hasActiveStreak: activeStreak,
          tokenURI,
          imageUrl,
          animationUrl,
          metadata,
          tokenId,
          impactValue,
          dcuReward,
        })
      } catch (error) {
        console.error('Error fetching profile data:', error)
        setProfileData({
          dcuBalance: 0,
          stakedDCU: 0,
          level: 0,
          streak: 0,
          hasActiveStreak: false,
          tokenURI: '',
          imageUrl: '',
          animationUrl: '',
          metadata: null,
          tokenId: null,
          impactValue: null,
          dcuReward: null,
        })
      } finally {
        if (showSpinner) {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!isConnected || !address) {
      setLoading(false)
      return
    }

    loadProfileData(address, { showSpinner: true })

    const handleVisibilityChange = () => {
      if (!document.hidden && isConnected && address) {
        loadProfileData(address, { showSpinner: false })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [address, isConnected, loadProfileData])

  // Check for pending cleanup status
  useEffect(() => {
    if (!isConnected || !address) {
      setCleanupStatus(null)
      return
    }

    async function checkCleanupStatus() {
      try {
        if (!address) {
          setCleanupStatus(null)
          return
        }

        // Check localStorage for pending cleanup ID (scoped to user address)
        if (typeof window !== 'undefined') {
          const pendingKey = `pending_cleanup_id_${address.toLowerCase()}`
          const pendingCleanupId = localStorage.getItem(pendingKey)

          if (pendingCleanupId) {
            setCleanupStatus({ cleanupId: BigInt(pendingCleanupId), verified: false, claimed: false, level: 0, loading: true })

            try {
              const status = await getCleanupStatus(BigInt(pendingCleanupId))

              // Verify this cleanup belongs to the current user
              if (status.user.toLowerCase() !== address.toLowerCase()) {
                console.log('Cleanup belongs to different user, clearing localStorage')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setCleanupStatus(null)
                return
              }

              // Check if cleanup is rejected - if so, clear localStorage and allow new submission
              if (status.rejected) {
                console.log('Cleanup is rejected, clearing localStorage to allow new submission')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setCleanupStatus(null)
                return
              }

              setCleanupStatus({
                cleanupId: BigInt(pendingCleanupId),
                verified: status.verified,
                claimed: status.claimed,
                level: status.level,
                loading: false,
              })

              // If verified and claimed, remove from localStorage
              if (status.verified && status.claimed) {
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                // Clear cleanup status after a moment to hide the card
                setTimeout(() => setCleanupStatus(null), 2000)
              }
            } catch (error: any) {
              console.error('Error fetching cleanup status:', error)
              // If cleanup doesn't exist (e.g., from old contract or new empty contract), clear localStorage
              const errorMessage = error?.message || String(error)
              if (errorMessage.includes('does not exist') || errorMessage.includes('revert')) {
                console.log('Cleanup not found in contract, clearing localStorage...')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setCleanupStatus(null)
              } else {
                setCleanupStatus(prev => prev ? { ...prev, loading: false } : null)
              }
            }
          } else {
            // Check and clear old global keys for backward compatibility
            const oldPendingId = localStorage.getItem('pending_cleanup_id')
            if (oldPendingId) {
              localStorage.removeItem('pending_cleanup_id')
              localStorage.removeItem('pending_cleanup_location')
            }
            setCleanupStatus(null)
          }
        }
      } catch (error) {
        console.error('Error checking cleanup status:', error)
        setCleanupStatus(null)
      }
    }

    checkCleanupStatus()
    // Poll for status updates every 10 seconds
    const interval = setInterval(checkCleanupStatus, 10000)
    return () => clearInterval(interval)
  }, [address, isConnected])

  if (!hasMounted) {
    return <div className="min-h-screen bg-background" />
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold uppercase tracking-wide text-foreground">
            Connect Your Wallet
          </h2>
          <p className="mb-6 text-gray-400">
            Please connect your wallet to view your profile.
          </p>
          <BackButton href="/" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  const getTierName = (level: number): string => {
    if (level === 0) return 'No Level'
    if (level <= 3) return 'Newbie'
    if (level <= 6) return 'Pro'
    if (level <= 9) return 'Hero'
    if (level === 10) return 'Guardian'
    return 'Unknown'
  }

  const impactExplorerUrl =
    profileData.tokenId && CONTRACT_ADDRESSES.IMPACT_PRODUCT
      ? `${REQUIRED_BLOCK_EXPLORER_URL}/token/${CONTRACT_ADDRESSES.IMPACT_PRODUCT}?a=${profileData.tokenId.toString()}`
      : null
  const impactContractUrl = CONTRACT_ADDRESSES.IMPACT_PRODUCT
    ? `${REQUIRED_BLOCK_EXPLORER_URL}/address/${CONTRACT_ADDRESSES.IMPACT_PRODUCT}`
    : null

  const handleManualCopy = async (value: string, label: string) => {
    if (!value) return
    try {
      setCopyingField(label)
      await navigator.clipboard.writeText(value)
      alert(`${label} copied to clipboard.`)
    } catch (error) {
      console.error(`Failed to copy ${label}:`, error)
      alert(`${label}: ${value}`)
    } finally {
      setCopyingField(null)
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <BackButton href="/" />
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              My Profile
            </h1>
            <p className="text-sm text-gray-400">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (isRefreshing || !address) return
              setIsRefreshing(true)
              try {
                await loadProfileData(address, { showSpinner: false })
              } catch (error) {
                console.error('Error refreshing profile:', error)
              } finally {
                setIsRefreshing(false)
              }
            }}
            disabled={isRefreshing}
            className="text-gray-400 hover:text-white"
            title="Refresh profile data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Three-Column Dashboard Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Personal Stats */}
          <DashboardPersonalStats
            dcuBalance={profileData.dcuBalance}
            cleanupsDone={profileData.level} // Using level as proxy for cleanups done
            cleanupsDCU={profileData.level * 10} // 10 DCU per level
            referrals={0} // TODO: Implement referral tracking
            referralsDCU={0} // TODO: Implement referral tracking
            streakWeeks={profileData.streak}
            streakDCU={profileData.streak * 3} // 3 DCU per week
            enhancedReportsDCU={0} // TODO: Implement enhanced reports tracking
            hasActiveStreak={profileData.hasActiveStreak}
          />

          {/* Middle Column: Impact Product */}
          <DashboardImpactProduct
            level={profileData.level}
            imageUrl={profileData.imageUrl}
            animationUrl={profileData.animationUrl}
            dcuAttached={profileData.level * 10}
            impactValue={profileData.impactValue}
            tokenId={profileData.tokenId}
            contractAddress={CONTRACT_ADDRESSES.IMPACT_PRODUCT}
          />

          {/* Right Column: Actions */}
          <DashboardActions
            address={address || ''}
            cleanupStatus={cleanupStatus && cleanupStatus.cleanupId ? {
              hasPendingCleanup: !cleanupStatus.verified && !cleanupStatus.claimed,
              canClaim: cleanupStatus.verified && !cleanupStatus.claimed,
              cleanupId: cleanupStatus.cleanupId,
              level: cleanupStatus.level,
            } : null}
            onClaim={async () => {
              if (!cleanupStatus?.cleanupId || isClaiming) return

              try {
                setIsClaiming(true)
                // Pass chainId to avoid false chain detection
                const hash = await claimImpactProductFromVerification(cleanupStatus.cleanupId, chainId)
                alert(
                  `✅ Claim transaction submitted!\n\n` +
                  `Transaction Hash: ${hash}\n\n` +
                  `Your Impact Product will be minted once the transaction confirms.\n\n` +
                  `View on ${BLOCK_EXPLORER_NAME}: ${getExplorerTxUrl(hash)}`
                )

                // Wait for transaction confirmation
                const { waitForTransactionReceipt } = await import('wagmi/actions')
                const { config } = await import('@/lib/blockchain/wagmi')

                try {
                  await waitForTransactionReceipt(config, { hash, timeout: 60000 })
                  console.log('✅ Claim transaction confirmed!')
                } catch (waitError) {
                  console.warn('Transaction confirmation wait failed, but continuing:', waitError)
                }

                // Poll for status update
                let pollCount = 0
                const maxPolls = 10
                const pollInterval = setInterval(async () => {
                  pollCount++
                  try {
                    const status = await getCleanupStatus(cleanupStatus.cleanupId!)
                    setCleanupStatus({
                      cleanupId: cleanupStatus.cleanupId,
                      verified: status.verified,
                      claimed: status.claimed,
                      level: status.level,
                      loading: false,
                    })

                    if (status.claimed || pollCount >= maxPolls) {
                      clearInterval(pollInterval)
                      // Refresh profile data to show new level
                      window.location.reload()
                    }
                  } catch (error) {
                    console.error('Error polling status:', error)
                    if (pollCount >= maxPolls) {
                      clearInterval(pollInterval)
                      window.location.reload()
                    }
                  }
                }, 2000) // Poll every 2 seconds

                // Fallback: reload after max time
                setTimeout(() => {
                  clearInterval(pollInterval)
                  window.location.reload()
                }, 20000) // Max 20 seconds
              } catch (error: any) {
                console.error('Error claiming:', error)
                const errorMessage = error?.message || String(error)
                alert(`Failed to claim: ${errorMessage}`)
              } finally {
                setIsClaiming(false)
              }
            }}
            isClaiming={isClaiming}
          />
        </div>
      </div>
    </div>
  )
}
