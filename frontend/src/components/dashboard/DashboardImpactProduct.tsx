'use client'

import { useState, useEffect } from 'react'
import { Award, ExternalLink, ChevronDown, Copy, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { REQUIRED_BLOCK_EXPLORER_URL, CONTRACT_ADDRESSES } from '@/lib/blockchain/wagmi'
import { useAccount } from 'wagmi'
import { getHypercertEligibility } from '@/lib/blockchain/contracts'
import { getLevelName, getImpactValueRange, getImpactProductImagePath, getImpactProductAnimationPath, getImpactProductIPFSImageUrl, getImpactProductIPFSAnimationUrl, CONSTANT_TRAITS, LEVEL_PROGRESSION } from '@/lib/utils/impact-product'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'

interface ImpactProductProps {
    level: number
    imageUrl: string
    animationUrl: string
    dcuAttached: number
    impactValue: string | null
    tokenId: bigint | null
    contractAddress: string
}

export function DashboardImpactProduct({
    level,
    imageUrl,
    animationUrl,
    dcuAttached,
    impactValue,
    tokenId,
    contractAddress,
}: ImpactProductProps) {
    const { address } = useAccount()
    const [showManualImport, setShowManualImport] = useState(false)
    const [showMetadata, setShowMetadata] = useState(false)
    const [copying, setCopying] = useState<string | null>(null)
    const [cleanupsCompleted, setCleanupsCompleted] = useState<number>(0)
    const [hypercertsEarned, setHypercertsEarned] = useState<number>(0)
    const [loadingStats, setLoadingStats] = useState(false)

    useEffect(() => {
        if (address && level > 0) {
            loadStats()
        }
    }, [address, level])

    const loadStats = async () => {
        if (!address) return
        setLoadingStats(true)
        try {
            const eligibility = await getHypercertEligibility(address)
            setCleanupsCompleted(Number(eligibility.cleanupCount))
            setHypercertsEarned(Number(eligibility.hypercertCount))
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoadingStats(false)
        }
    }

    const levelName = getLevelName(level)
    const impactValueRange = getImpactValueRange(level)
    
    // Prefer IPFS URLs from metadata, fallback to local paths
    const imageUrlToUse = imageUrl || (level > 0 ? getImpactProductIPFSImageUrl(level, process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID) : null) || getImpactProductImagePath(level)
    const animationUrlToUse = animationUrl || (level === 10 ? getImpactProductIPFSAnimationUrl(process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID) : null) || (level === 10 ? getImpactProductAnimationPath() : null)

    const handleCopy = async (value: string, label: string) => {
        try {
            setCopying(label)
            await navigator.clipboard.writeText(value)
            setTimeout(() => setCopying(null), 2000)
        } catch (error) {
            console.error('Failed to copy:', error)
            alert(`${label}: ${value}`)
        }
    }

    const explorerUrl = tokenId && contractAddress
        ? `${REQUIRED_BLOCK_EXPLORER_URL}/token/${contractAddress}?a=${tokenId.toString()}`
        : null

    return (
        <div className="rounded-xl border-2 border-brand-green/30 bg-gradient-to-br from-brand-green/5 to-black p-3 flex flex-col h-full min-h-0 overflow-y-auto">
            <div className="mb-2.5 flex items-center justify-between flex-shrink-0">
                <h2 className="flex items-center gap-2 font-bebas text-2xl tracking-wider text-brand-green">
                    <Award className="h-6 w-6" />
                    IMPACT PRODUCT
                </h2>
            </div>

            {level > 0 ? (
                <div className="space-y-3 flex-1 min-h-0 flex flex-col">
                    {/* NFT Display */}
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-brand-green/20 bg-gray-900 flex-shrink-0">
                        {level === 10 && animationUrlToUse ? (
                            <img
                                src={animationUrlToUse}
                                alt={`Level ${level} Impact Product Animation`}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                    // Fallback to static image if animation fails
                                    const target = e.target as HTMLImageElement
                                    if (imageUrlToUse) {
                                        target.src = imageUrlToUse
                                    }
                                }}
                            />
                        ) : imageUrlToUse ? (
                            <img
                                src={imageUrlToUse}
                                alt={`Level ${level} Impact Product`}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <Award className="h-24 w-24 text-gray-700" />
                            </div>
                        )}
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                        <div className="rounded-lg border border-brand-green/20 bg-black/50 p-2">
                            <p className="mb-1 text-xs text-gray-400">Level</p>
                            <p className="font-bebas text-2xl text-brand-green">Level {level}</p>
                            <p className="text-[10px] text-brand-yellow mt-0.5">{levelName}</p>
                        </div>
                        <div className="rounded-lg border border-brand-green/20 bg-black/50 p-2">
                            <p className="mb-1 text-xs text-gray-400">cDCU Attached</p>
                            <p className="font-bebas text-2xl text-brand-green">{dcuAttached}</p>
                        </div>
                    </div>

                    {/* Dynamic Stats */}
                    <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                        <div className="rounded-lg border border-brand-green/20 bg-black/50 p-2">
                            <p className="mb-1 text-xs text-gray-400">Cleanups</p>
                            <p className="font-bebas text-xl text-white">
                                {loadingStats ? '...' : cleanupsCompleted}
                            </p>
                        </div>
                        <div className="rounded-lg border border-brand-green/20 bg-black/50 p-2">
                            <p className="mb-1 text-xs text-gray-400">Hypercerts</p>
                            <p className="font-bebas text-xl text-white">
                                {loadingStats ? '...' : hypercertsEarned}
                            </p>
                        </div>
                    </div>

                    {/* Impact Value */}
                    <div className="rounded-lg border border-brand-green/20 bg-black/50 p-2 flex-shrink-0">
                        <p className="mb-1 text-xs text-gray-400">Impact Value</p>
                        <p className="font-bebas text-xl text-white">{impactValue || impactValueRange}</p>
                    </div>

                    {/* Metadata Toggle */}
                    <button
                        onClick={() => setShowMetadata(!showMetadata)}
                        className="flex items-center justify-between rounded-lg border border-brand-green/20 bg-black/30 p-2.5 text-left transition-colors hover:bg-brand-green/5 flex-shrink-0"
                    >
                        <span className="font-bebas text-sm tracking-wide text-gray-400">
                            VIEW METADATA
                        </span>
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showMetadata ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Metadata Panel */}
                    {showMetadata && (
                        <div className="space-y-3 border-t border-brand-green/20 pt-3 flex-shrink-0">
                            {/* Constant Traits */}
                            <div className="space-y-2">
                                <h4 className="font-bebas text-sm tracking-wide text-brand-green">CONSTANT TRAITS</h4>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Type:</span>
                                        <span className="text-white">{CONSTANT_TRAITS.type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Impact:</span>
                                        <span className="text-white">{CONSTANT_TRAITS.impact}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Category:</span>
                                        <span className="text-white">{CONSTANT_TRAITS.category}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Traits */}
                            <div className="space-y-2">
                                <h4 className="font-bebas text-sm tracking-wide text-brand-green">DYNAMIC TRAITS</h4>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Impact Value:</span>
                                        <span className="text-white">{impactValue || impactValueRange}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Level:</span>
                                        <span className="text-white">{levelName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Cleanups Completed:</span>
                                        <span className="text-white">{loadingStats ? '...' : cleanupsCompleted}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Hypercerts Earned:</span>
                                        <span className="text-white">{loadingStats ? '...' : hypercertsEarned}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Level Progression Table */}
                            <div className="space-y-2">
                                <h4 className="font-bebas text-sm tracking-wide text-brand-green">LEVEL PROGRESSION</h4>
                                <div className="rounded-lg border border-brand-green/20 bg-black/30 overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-brand-green/20 bg-black/50">
                                                <th className="p-2 text-left text-gray-400 font-bebas">Cleanups</th>
                                                <th className="p-2 text-left text-gray-400 font-bebas">Impact Value</th>
                                                <th className="p-2 text-left text-gray-400 font-bebas">Level</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {LEVEL_PROGRESSION.map((row, idx) => (
                                                <tr key={idx} className="border-b border-brand-green/10 last:border-0">
                                                    <td className="p-2 text-white">{row.cleanups}</td>
                                                    <td className="p-2 text-white">{row.impactValue}</td>
                                                    <td className="p-2 text-brand-yellow">{row.level}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View on Explorer */}
                    {explorerUrl && (
                        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <Button
                                variant="outline"
                                className="w-full border-brand-green/30 font-bebas tracking-wider text-brand-green hover:bg-brand-green/10"
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View on Celoscan
                            </Button>
                        </a>
                    )}

                    {/* Manual Wallet Import */}
                    <div className="rounded-lg border border-brand-green/20 bg-black/30 flex-shrink-0">
                        <button
                            onClick={() => setShowManualImport(!showManualImport)}
                            className="flex w-full items-center justify-between p-2.5 text-left transition-colors hover:bg-brand-green/5"
                        >
                            <span className="font-bebas text-sm tracking-wide text-gray-400">
                                MANUAL WALLET IMPORT
                            </span>
                            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showManualImport ? 'rotate-180' : ''}`} />
                        </button>

                        {showManualImport && (
                            <div className="space-y-2.5 border-t border-brand-green/20 p-2.5">
                                <div>
                                    <p className="mb-1 text-xs text-gray-500">Contract Address</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 overflow-hidden text-ellipsis rounded bg-gray-900 px-2 py-1 text-xs text-gray-300">
                                            {contractAddress}
                                        </code>
                                        <button
                                            onClick={() => handleCopy(contractAddress, 'Contract Address')}
                                            className="rounded p-1 hover:bg-gray-800"
                                            title="Copy contract address"
                                        >
                                            {copying === 'Contract Address' ? (
                                                <span className="text-xs text-brand-green">✓</span>
                                            ) : (
                                                <Copy className="h-4 w-4 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {tokenId && (
                                    <div>
                                        <p className="mb-1 text-xs text-gray-500">Collectible ID</p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 overflow-hidden text-ellipsis rounded bg-gray-900 px-2 py-1 text-xs text-gray-300">
                                                {tokenId.toString()}
                                            </code>
                                            <button
                                                onClick={() => handleCopy(tokenId.toString(), 'Collectible ID')}
                                                className="rounded p-1 hover:bg-gray-800"
                                                title="Copy collectible ID"
                                            >
                                                {copying === 'Collectible ID' ? (
                                                    <span className="text-xs text-brand-green">✓</span>
                                                ) : (
                                                    <Copy className="h-4 w-4 text-gray-400" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-2 rounded-lg border border-brand-green/10 bg-brand-green/5 p-2">
                                    <p className="mb-1 text-xs font-semibold text-brand-green">HOW TO IMPORT:</p>
                                    <ol className="space-y-1 text-[10px] text-gray-400 list-decimal list-inside">
                                        <li>Open your wallet (MetaMask, Trust Wallet, etc.)</li>
                                        <li>Go to NFT/Collectibles section</li>
                                        <li>Click "Import NFT" or "Add Custom Token"</li>
                                        <li>Paste the Contract Address above</li>
                                        <li>Enter the Collectible ID above</li>
                                        <li>Save and your Impact Product will appear!</li>
                                    </ol>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <div className="mb-4 rounded-full border-4 border-brand-green/30 bg-brand-green/10 p-6">
                        <Award className="h-16 w-16 text-brand-green/50" />
                    </div>
                    <h3 className="mb-2 font-bebas text-2xl tracking-wider text-gray-400">
                        NOT YET MINTED
                    </h3>
                    <p className="text-sm text-gray-500">
                        Submit your first cleanup to claim Level 1
                    </p>
                </div>
            )}
        </div>
    )
}
