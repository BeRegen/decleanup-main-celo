'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Leaf, Award, Share2, Copy, Users, Loader2 } from 'lucide-react'
import { generateReferralLink } from '@/lib/utils/sharing'

interface DashboardActionsProps {
    address: string
    cleanupStatus: {
        hasPendingCleanup: boolean
        canClaim: boolean
        cleanupId?: bigint
        level?: number
    } | null
    onClaim: () => Promise<void>
    isClaiming: boolean
}

export function DashboardActions({
    address,
    cleanupStatus,
    onClaim,
    isClaiming,
}: DashboardActionsProps) {
    const [copying, setCopying] = useState(false)

    const referralLink = generateReferralLink(address, 'web')

    const handleCopyLink = async () => {
        try {
            setCopying(true)
            await navigator.clipboard.writeText(referralLink)
            setTimeout(() => setCopying(false), 2000)
        } catch (error) {
            console.error('Failed to copy:', error)
            alert(`Referral link: ${referralLink}`)
        }
    }

    const handleShareX = () => {
        const text = encodeURIComponent(`Join me on DeCleanup Network! Clean up, earn cDCU tokens, and make a real environmental impact. 🌱`)
        const url = encodeURIComponent(referralLink)
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
    }

    const handleShareFarcaster = () => {
        const text = encodeURIComponent(`Join me on DeCleanup Network! Clean up, earn cDCU tokens, and make a real environmental impact. 🌱\n\n${referralLink}`)
        window.open(`https://warpcast.com/~/compose?text=${text}`, '_blank')
    }

    const canSubmit = !cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim
    const canClaimLevel = cleanupStatus?.canClaim && !isClaiming

    return (
        <div className="rounded-xl border-2 border-brand-green/30 bg-gradient-to-b from-brand-green/10 to-black p-2.5 flex flex-col h-full min-h-0 overflow-y-auto">
            <h2 className="mb-2.5 border-b border-brand-green/30 pb-1.5 font-bebas text-3xl tracking-wider text-brand-green flex-shrink-0">
                ACTIONS
            </h2>

            <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                {/* Submit Cleanup Button */}
                <Link href="/cleanup" className={!canSubmit ? 'pointer-events-none' : ''}>
                    <Button
                        disabled={!canSubmit}
                        className="w-full gap-2 bg-brand-green py-6 font-bebas text-xl tracking-wider text-black hover:bg-brand-green/90 disabled:opacity-50"
                    >
                        <Leaf className="h-5 w-5" />
                        SUBMIT CLEANUP
                    </Button>
                </Link>

                {/* Claim Level Button */}
                {cleanupStatus?.canClaim && (
                    <div className="space-y-2">
                        <div className="rounded-lg border border-brand-yellow/30 bg-brand-yellow/10 p-2.5">
                            <p className="text-sm text-brand-yellow">
                                🎉 Your cleanup has been verified! You can now claim your Impact Product (Level {cleanupStatus.level || 1}).
                            </p>
                        </div>
                        <Button
                            onClick={onClaim}
                            disabled={!canClaimLevel}
                            className="w-full gap-2 bg-brand-yellow py-6 font-bebas text-xl tracking-wider text-black hover:bg-[#e6e600] disabled:opacity-50"
                        >
                            {isClaiming ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    CLAIMING...
                                </>
                            ) : (
                                <>
                                    <Award className="h-5 w-5" />
                                    CLAIM LEVEL
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Pending Status */}
                {cleanupStatus?.hasPendingCleanup && !cleanupStatus?.canClaim && (
                    <div className="rounded-lg border border-brand-green/30 bg-brand-green/10 p-3">
                        <p className="mb-2 font-bebas text-lg tracking-wide text-brand-green">
                            ⏳ UNDER REVIEW
                        </p>
                        <p className="text-sm text-gray-400">
                            Your cleanup is being verified. This usually takes a few hours.
                        </p>
                    </div>
                )}

                {/* Invite Friends Section */}
                <div className="mt-2 space-y-1.5 border-t border-brand-green/20 pt-2">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-brand-green" />
                        <h3 className="font-bebas text-2xl tracking-wider text-brand-green">
                            INVITE FRIENDS
                        </h3>
                    </div>
                    <p className="text-sm text-gray-400">
                        Earn 3 cDCU when friends submit and verify their first cleanup. Share your referral link and earn rewards when your friends join DeCleanup Network.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            onClick={handleShareFarcaster}
                            variant="outline"
                            size="sm"
                            className="border-brand-green/30 font-bebas text-sm tracking-wider text-brand-green hover:bg-brand-green/10 py-1 h-auto"
                        >
                            <Share2 className="mr-1 h-3 w-3" />
                            FARCASTER
                        </Button>
                        <Button
                            onClick={handleShareX}
                            variant="outline"
                            size="sm"
                            className="border-brand-green/30 font-bebas text-sm tracking-wider text-brand-green hover:bg-brand-green/10 py-1 h-auto"
                        >
                            <Share2 className="mr-1 h-3 w-3" />
                            X (TWITTER)
                        </Button>
                    </div>

                    <Button
                        onClick={handleCopyLink}
                        variant="outline"
                        size="sm"
                        className="w-full border-brand-green/30 font-bebas text-sm tracking-wider text-brand-green hover:bg-brand-green/10 py-1 h-auto"
                    >
                        {copying ? (
                            <>
                                <span className="mr-1">✓</span>
                                COPIED!
                            </>
                        ) : (
                            <>
                                <Copy className="mr-1 h-3 w-3" />
                                COPY LINK
                            </>
                        )}
                    </Button>
                </div>

                {/* Future Features - Coming Soon */}
                <div className="mt-3 space-y-1 border-t border-brand-green/20 pt-3">
                    <p className="mb-2 text-base font-medium text-gray-500">COMING SOON</p>
                    <Button
                        disabled
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-700 font-bebas text-sm tracking-wider text-gray-600 opacity-50"
                        title="Coming Soon"
                    >
                        CREATE IMPACT CIRCLE
                    </Button>
                    <Button
                        disabled
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-700 font-bebas text-sm tracking-wider text-gray-600 opacity-50"
                        title="Coming Soon"
                    >
                        JOIN IMPACT CIRCLE
                    </Button>
                    <Button
                        disabled
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-700 font-bebas text-sm tracking-wider text-gray-600 opacity-50"
                        title="Coming Soon"
                    >
                        CLAIM/STAKE
                    </Button>
                </div>
            </div>
        </div>
    )
}
