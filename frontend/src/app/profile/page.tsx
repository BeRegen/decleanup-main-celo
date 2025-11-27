'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Award, TrendingUp, Leaf, Loader2, ArrowLeft, Coins } from 'lucide-react'
import Link from 'next/link'
import { getClaimableRewards, getUserLevel, claimImpactProductFromVerification } from '@/lib/blockchain/contracts'
import { formatEther } from 'viem'

export default function ProfilePage() {
    const [mounted, setMounted] = useState(false)
    const { address, isConnected } = useAccount()
    const [rewards, setRewards] = useState<bigint>(BigInt(0))
    const [level, setLevel] = useState<number>(0)
    const [loading, setLoading] = useState(false)
    const [claiming, setClaiming] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (address) {
            fetchData()
        }
    }, [address])

    const fetchData = async () => {
        if (!address) return
        setLoading(true)
        try {
            const [rewardsData, levelData] = await Promise.all([
                getClaimableRewards(address),
                getUserLevel(address).catch(() => 0)
            ])
            setRewards(rewardsData)
            setLevel(levelData)
        } catch (error) {
            console.error('Error fetching profile data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleClaim = async () => {
        if (!address) return
        setClaiming(true)
        try {
            await claimImpactProductFromVerification(BigInt(0))
            alert('Rewards claimed successfully!')
            fetchData()
        } catch (error) {
            console.error('Error claiming rewards:', error)
            alert('Failed to claim rewards. Please try again.')
        } finally {
            setClaiming(false)
        }
    }

    if (!mounted) {
        return <div className="min-h-screen bg-black" />
    }

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-black">
                <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4">
                    <div className="w-full max-w-md space-y-6 text-center">
                        <h2 className="font-bebas text-3xl tracking-wider text-white">
                            CONNECT YOUR WALLET
                        </h2>
                        <p className="text-sm text-gray-400">
                            Please connect your wallet to view your profile.
                        </p>
                        <Link href="/">
                            <Button
                                variant="outline"
                                className="gap-2 border-gray-800 bg-gray-900/50 font-bebas tracking-wider text-white hover:bg-gray-800"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                GO BACK
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-background">
            <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link href="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-bebas text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                </div>

                {/* Profile Header */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="font-bebas text-4xl tracking-wider text-foreground sm:text-5xl">
                                MY PROFILE
                            </h1>
                            <p className="mt-2 font-mono text-sm text-muted-foreground">
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                            </p>
                        </div>
                        <div className="rounded-full border-2 border-brand-green/30 bg-brand-green/10 p-4">
                            <Award className="h-8 w-8 text-brand-green" />
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Claimable Rewards Card */}
                    <div className="group rounded-2xl border border-border bg-card p-5 hover:border-brand-green/50 transition-all">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-lg bg-brand-green/10 p-2">
                                <Coins className="h-5 w-5 text-brand-green" />
                            </div>
                            <h3 className="font-bebas text-lg tracking-wide text-muted-foreground">
                                CLAIMABLE REWARDS
                            </h3>
                        </div>
                        <p className="mb-4 font-bebas text-4xl text-foreground leading-none">
                            {loading ? '...' : `${formatEther(rewards)} cDCU`}
                        </p>
                        {rewards > BigInt(0) && (
                            <Button
                                onClick={handleClaim}
                                disabled={claiming}
                                className="w-full bg-brand-green font-bebas text-sm tracking-wider text-black hover:bg-brand-green/90"
                            >
                                {claiming ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        CLAIMING...
                                    </>
                                ) : (
                                    'CLAIM REWARDS'
                                )}
                            </Button>
                        )}
                    </div>

                    {/* Impact Product Level Card */}
                    <div className="group rounded-2xl border border-border bg-card p-5 hover:border-brand-yellow/50 transition-all">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-lg bg-brand-yellow/10 p-2">
                                <Award className="h-5 w-5 text-brand-yellow" />
                            </div>
                            <h3 className="font-bebas text-lg tracking-wide text-muted-foreground">
                                IMPACT PRODUCT LEVEL
                            </h3>
                        </div>
                        <p className="mb-2 font-bebas text-4xl text-foreground leading-none">
                            {loading ? '...' : (level > 0 ? `LEVEL ${level}` : 'NO LEVEL')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {level > 0 ? 'Keep submitting cleanups to level up!' : 'Submit a cleanup to get started'}
                        </p>
                    </div>
                </div>

                {/* No Impact Product Section */}
                {level === 0 && (
                    <section className="rounded-2xl border-2 border-border bg-gradient-to-br from-brand-green/5 to-transparent p-8 text-center">
                        <div className="mx-auto mb-4 w-fit rounded-2xl border-2 border-border/50 bg-card p-6">
                            <Award className="h-16 w-16 text-muted-foreground/50" />
                        </div>
                        <h2 className="mb-2 font-bebas text-3xl tracking-wider text-foreground">
                            NO IMPACT PRODUCT YET
                        </h2>
                        <p className="mb-6 text-muted-foreground">
                            Submit your first cleanup to earn your Impact Product and start earning rewards!
                        </p>
                        <Link href="/cleanup">
                            <Button className="gap-2 bg-brand-yellow px-6 py-3 font-bebas text-base tracking-wider text-black hover:bg-brand-yellow/90">
                                <Leaf className="h-5 w-5" />
                                SUBMIT YOUR FIRST CLEANUP
                            </Button>
                        </Link>
                    </section>
                )}

                {/* Action Button */}
                <Link href="/cleanup">
                    <Button className="w-full gap-2 bg-brand-green px-6 py-4 font-bebas text-lg tracking-wider text-black hover:bg-brand-green/90">
                        <Leaf className="h-5 w-5" />
                        SUBMIT NEW CLEANUP
                    </Button>
                </Link>
            </div>
        </div>
    )
}
