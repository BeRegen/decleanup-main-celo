'use client'

import { useEffect, useState } from 'react'
import { useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import type { Address } from 'viem'

/**
 * Hook to resolve ENS name for an Ethereum address
 * Falls back to null if no ENS name is found
 */
export function useENSName(address: Address | undefined) {
    const [ensName, setEnsName] = useState<string | null>(null)

    // Use wagmi's useEnsName hook to resolve ENS
    const { data, isError, isLoading } = useEnsName({
        address,
        chainId: mainnet.id,
    })

    useEffect(() => {
        if (data) {
            setEnsName(data)
        } else if (isError || !isLoading) {
            setEnsName(null)
        }
    }, [data, isError, isLoading])

    return { ensName, isLoading }
}
