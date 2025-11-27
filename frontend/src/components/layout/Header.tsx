'use client'

import Link from 'next/link'
import { Leaf } from 'lucide-react'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-brand-green/20 bg-black/95 backdrop-blur-md">
            <div className="container mx-auto px-4 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo & Title */}
                    <Link href="/" className="group flex items-center gap-3 transition-all hover:scale-105">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-green to-brand-green/80 shadow-lg shadow-brand-green/20 transition-all group-hover:shadow-brand-green/40">
                            <Leaf className="h-6 w-6 text-black" />
                            <div className="absolute inset-0 rounded-xl bg-brand-green/20 blur-xl transition-all group-hover:bg-brand-green/30" />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="font-bebas text-lg font-bold leading-tight tracking-wider text-brand-green lg:text-xl">
                                DECLEANUP NETWORK
                            </h1>
                            <p className="font-bebas text-[9px] leading-none tracking-wide text-brand-green/70 lg:text-[10px]">
                                CLEAN UP, SNAP, EARN
                            </p>
                        </div>
                    </Link>

                    {/* Wallet Connect */}
                    <WalletConnect />
                </div>
            </div>
        </header>
    )
}
