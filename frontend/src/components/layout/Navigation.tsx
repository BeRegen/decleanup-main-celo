'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NavigationProps {
    isVerifier?: boolean
}

export function Navigation({ isVerifier = false }: NavigationProps) {
    const pathname = usePathname()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const links = [
        { href: '/', label: 'Home' },
        { href: '/profile', label: 'Profile' },
        ...(isVerifier ? [{ href: '/verifier', label: 'Verifier Cabinet' }] : []),
    ]

    const isActive = (href: string) => {
        if (href === '/') {
            return pathname === '/'
        }
        return pathname.startsWith(href)
    }

    return (
        <>
            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-1 md:flex">
                {links.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`rounded-md px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${isActive(link.href)
                                ? 'bg-brand-green/20 text-brand-green'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>

            {/* Mobile Menu Button */}
            <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
            >
                {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                ) : (
                    <Menu className="h-5 w-5" />
                )}
            </Button>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-50 border-b border-border bg-background/95 backdrop-blur-sm md:hidden">
                    <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
                        {links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`rounded-md px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${isActive(link.href)
                                        ? 'bg-brand-green/20 text-brand-green'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </>
    )
}
