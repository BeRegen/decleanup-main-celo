'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, MapPin, Camera, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { uploadToIPFS } from '@/lib/blockchain/ipfs'
import { submitCleanup, getSubmissionFee } from '@/lib/blockchain/contracts'
import { formatEther } from 'viem'

export default function CleanupPage() {
    const [mounted, setMounted] = useState(false)
    const { address, isConnected } = useAccount()
    const router = useRouter()
    const [beforePhoto, setBeforePhoto] = useState<File | null>(null)
    const [afterPhoto, setAfterPhoto] = useState<File | null>(null)
    const [beforePreview, setBeforePreview] = useState<string | null>(null)
    const [afterPreview, setAfterPreview] = useState<string | null>(null)
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [gettingLocation, setGettingLocation] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submissionFee, setSubmissionFee] = useState<bigint>(BigInt(0))
    const [feeEnabled, setFeeEnabled] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')

    useEffect(() => {
        setMounted(true)
        // Fetch submission fee
        getSubmissionFee().then(({ fee, enabled }) => {
            setSubmissionFee(fee)
            setFeeEnabled(enabled)
        }).catch(console.error)
    }, [])

    const handleBeforePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setBeforePhoto(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setBeforePreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleAfterPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setAfterPhoto(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setAfterPreview(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const getLocation = () => {
        setGettingLocation(true)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    })
                    setGettingLocation(false)
                },
                (error) => {
                    console.error('Error getting location:', error)
                    alert('Could not get your location. Please enable location services.')
                    setGettingLocation(false)
                }
            )
        } else {
            alert('Geolocation is not supported by your browser.')
            setGettingLocation(false)
        }
    }

    const handleSubmit = async () => {
        if (!beforePhoto || !afterPhoto || !location) {
            alert('Please upload both photos and get your location')
            return
        }

        setSubmitting(true)
        setStatusMessage('Uploading photos to IPFS...')

        try {
            // 1. Upload photos to IPFS
            const [beforeResult, afterResult] = await Promise.all([
                uploadToIPFS(beforePhoto),
                uploadToIPFS(afterPhoto)
            ])

            console.log('Photos uploaded:', { before: beforeResult.hash, after: afterResult.hash })

            setStatusMessage('Submitting to blockchain... Please confirm in your wallet.')

            // 2. Submit to smart contract
            const cleanupId = await submitCleanup(
                beforeResult.hash,
                afterResult.hash,
                location.lat,
                location.lng,
                null, // referrer
                false, // hasImpactForm
                "", // impactReportHash
                feeEnabled ? submissionFee : undefined
            )

            console.log('Cleanup submitted with ID:', cleanupId)

            setStatusMessage('Success! Redirecting...')
            alert('Cleanup submitted successfully! Waiting for verification.')
            router.push('/')
        } catch (error: any) {
            console.error('Error submitting cleanup:', error)
            setStatusMessage('')
            alert(`Failed to submit cleanup: ${error.message || 'Unknown error'}`)
        } finally {
            setSubmitting(false)
        }
    }

    if (!mounted) {
        return <div className="min-h-screen bg-background" />
    }

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-2xl">
                    <Link href="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-bebas text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-border bg-card p-6 text-center">
                        <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                            Connect Wallet
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Please connect your wallet to submit a cleanup.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background px-4 py-6">
            <div className="container mx-auto max-w-3xl">
                <Link href="/">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mb-6 gap-2 text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="font-bebas text-sm tracking-wider">BACK</span>
                    </Button>
                </Link>

                <div className="mb-8">
                    <h1 className="mb-2 font-bebas text-4xl uppercase tracking-wide text-foreground">
                        SUBMIT CLEANUP
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Upload before and after photos of your cleanup to earn cDCU and level up
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Before Photo */}
                    <div className="rounded-lg border border-border bg-card p-6">
                        <h3 className="mb-4 font-bebas text-xl tracking-wider text-foreground">
                            BEFORE PHOTO
                        </h3>
                        <div className="space-y-4">
                            {beforePreview ? (
                                <div className="relative">
                                    <img
                                        src={beforePreview}
                                        alt="Before cleanup"
                                        className="w-full rounded-lg border border-border"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setBeforePhoto(null)
                                            setBeforePreview(null)
                                        }}
                                        className="mt-2"
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background p-12 transition-colors hover:border-brand-green hover:bg-brand-green/5">
                                    <Camera className="mb-4 h-12 w-12 text-muted-foreground" />
                                    <span className="font-bebas text-lg text-foreground">
                                        CLICK TO UPLOAD
                                    </span>
                                    <span className="mt-2 text-xs text-muted-foreground">
                                        Photo before cleanup started
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleBeforePhoto}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* After Photo */}
                    <div className="rounded-lg border border-border bg-card p-6">
                        <h3 className="mb-4 font-bebas text-xl tracking-wider text-foreground">
                            AFTER PHOTO
                        </h3>
                        <div className="space-y-4">
                            {afterPreview ? (
                                <div className="relative">
                                    <img
                                        src={afterPreview}
                                        alt="After cleanup"
                                        className="w-full rounded-lg border border-border"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setAfterPhoto(null)
                                            setAfterPreview(null)
                                        }}
                                        className="mt-2"
                                    >
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background p-12 transition-colors hover:border-brand-green hover:bg-brand-green/5">
                                    <Camera className="mb-4 h-12 w-12 text-muted-foreground" />
                                    <span className="font-bebas text-lg text-foreground">
                                        CLICK TO UPLOAD
                                    </span>
                                    <span className="mt-2 text-xs text-muted-foreground">
                                        Photo after cleanup completed
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAfterPhoto}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Location */}
                    <div className="rounded-lg border border-border bg-card p-6">
                        <h3 className="mb-4 font-bebas text-xl tracking-wider text-foreground">
                            LOCATION
                        </h3>
                        {location ? (
                            <div className="rounded-lg border border-brand-green/30 bg-brand-green/10 p-4">
                                <div className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 flex-shrink-0 text-brand-green" />
                                    <div>
                                        <p className="text-sm font-medium text-brand-green">
                                            Location captured
                                        </p>
                                        <p className="mt-1 font-mono text-xs text-gray-300">
                                            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={getLocation}
                                    className="mt-3"
                                >
                                    Update Location
                                </Button>
                            </div>
                        ) : (
                            <Button
                                onClick={getLocation}
                                disabled={gettingLocation}
                                className="w-full gap-2 bg-brand-green font-semibold uppercase text-black hover:bg-brand-green/90"
                            >
                                {gettingLocation ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Getting Location...
                                    </>
                                ) : (
                                    <>
                                        <MapPin className="h-4 w-4" />
                                        Get Current Location
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {/* Fee Information */}
                    {feeEnabled && submissionFee > BigInt(0) && (
                        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-500" />
                                <div>
                                    <p className="text-sm font-medium text-yellow-500">
                                        Submission Fee Required
                                    </p>
                                    <p className="mt-1 text-xs text-gray-300">
                                        A fee of {formatEther(submissionFee)} CELO is required to submit.
                                        This fee will be refunded if your submission is verified.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Status Message */}
                    {statusMessage && (
                        <div className="text-center text-sm text-brand-green animate-pulse">
                            {statusMessage}
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        onClick={handleSubmit}
                        disabled={!beforePhoto || !afterPhoto || !location || submitting}
                        className="w-full gap-2 bg-brand-yellow py-6 font-bebas text-lg uppercase text-black hover:bg-brand-yellow/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Upload className="h-5 w-5" />
                                {feeEnabled && submissionFee > BigInt(0)
                                    ? `Submit Cleanup (${formatEther(submissionFee)} CELO)`
                                    : 'Submit Cleanup'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
