'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import type { Connector } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet, LogOut, ChevronDown } from 'lucide-react'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/wagmi'
import { tryAddRequiredChain } from '@/lib/blockchain/network'
import { useENSName } from '@/hooks/useENSName'

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { connectAsync, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [showOtherWallets, setShowOtherWallets] = useState(false)
  const [hasSwitchedNetwork, setHasSwitchedNetwork] = useState(false)
  const { ensName, isLoading: ensLoading } = useENSName(address)

  // Detect if we're in an in-app browser (no window.ethereum)
  const isInAppBrowser = typeof window !== 'undefined' && !(window as any)?.ethereum

  // Detect if we're on mobile
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  // Filter connectors - show all available connectors
  // Browser Wallet will only appear if window.ethereum exists
  const externalConnectors = connectors
    .filter(c => {
      // Keep all connectors - let wagmi handle availability
      return true
    })
    .sort((a, b) => {
      // Prioritize Browser wallet if available, then WalletConnect
      const aIsBrowser = a.name.toLowerCase().includes('browser') || a.name.toLowerCase() === 'injected'
      const bIsBrowser = b.name.toLowerCase().includes('browser') || b.name.toLowerCase() === 'injected'
      const aIsWC = a.name.toLowerCase().includes('walletconnect')
      const bIsWC = b.name.toLowerCase().includes('walletconnect')

      if (aIsBrowser && !bIsBrowser) return -1
      if (!aIsBrowser && bIsBrowser) return 1
      if (aIsWC && !bIsWC) return -1
      if (!aIsWC && bIsWC) return 1
      return 0
    })

  const handleConnect = async (connector: Connector) => {
    try {
      await connectAsync({ connector })
      setShowOtherWallets(false)

      // Mark as connected in this session
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('wallet_connected_this_session', 'true')
      }
    } catch (error: any) {
      console.error('Wallet connect failed:', error)

      // Handle WalletConnect-specific errors gracefully
      const errorMessage = error?.message || String(error) || ''
      const errorName = error?.name || ''
      const errorString = String(error).toLowerCase()

      // Check for stale session errors (WalletConnect v2)
      const isStaleSession = errorMessage.includes('session topic doesn\'t exist') ||
        errorMessage.includes('No matching key') ||
        errorMessage.includes('session topic') ||
        errorString.includes('session topic doesn\'t exist') ||
        errorString.includes('no matching key')

      // If it's a stale session error, disconnect and clear storage
      if (isStaleSession) {
        console.log('WalletConnect session expired or invalid. Disconnecting and clearing session data...')
        try {
          // Disconnect to clear the stale session
          await disconnect()

          // Clear WalletConnect storage
          if (typeof window !== 'undefined') {
            // Clear WalletConnect v2 storage
            try {
              const wcKeys = Object.keys(localStorage).filter(key =>
                key.startsWith('wc@2:') || key.startsWith('walletconnect')
              )
              wcKeys.forEach(key => localStorage.removeItem(key))
            } catch (e) {
              console.warn('Failed to clear WalletConnect storage:', e)
            }

            // Clear session storage
            sessionStorage.removeItem('wallet_connected_this_session')
          }

          console.log('Stale session cleared. Please reconnect your wallet.')
        } catch (disconnectError) {
          console.warn('Error during disconnect:', disconnectError)
        }
        return
      }

      // Check for connection reset or rejection errors
      const isConnectionReset = errorMessage.includes('Connection request reset') ||
        errorMessage.includes('request reset') ||
        errorName === 'UserRejectedRequestError'

      const isUserRejected = errorMessage.includes('User rejected') ||
        errorMessage.includes('rejected') ||
        error?.code === 4001

      // For connection resets, this is usually expected behavior:
      // - User closed the QR code modal
      // - Connection timed out
      // - User rejected in their wallet app
      // We don't need to show an alert - the user can simply try again
      if (isConnectionReset || isUserRejected) {
        console.log('Connection was reset or rejected. User can try connecting again.')
        // Silently handle - user can retry
      } else {
        // For unexpected errors, log them but don't spam the user
        console.warn('Unexpected connection error:', errorMessage)
      }
    }
  }
  // Fix hydration error by only showing wallet state after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle WalletConnect stale session errors globally
  useEffect(() => {
    if (!mounted) return

    // Set up global error handler for WalletConnect session errors
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || String(event.error || '')
      const isStaleSession = errorMessage.includes('session topic doesn\'t exist') ||
        errorMessage.includes('No matching key') ||
        errorMessage.includes('session topic')

      if (isStaleSession && isConnected && connector?.id?.includes('walletconnect')) {
        console.log('Detected WalletConnect stale session error. Disconnecting...')
        try {
          disconnect()
        } catch (e) {
          // Ignore disconnect errors
          console.warn('Error during disconnect:', e)
        }

        // Clear WalletConnect storage
        if (typeof window !== 'undefined') {
          try {
            const wcKeys = Object.keys(localStorage).filter(key =>
              key.startsWith('wc@2:') || key.startsWith('walletconnect')
            )
            wcKeys.forEach(key => localStorage.removeItem(key))
            sessionStorage.removeItem('wallet_connected_this_session')
          } catch (e) {
            console.warn('Failed to clear WalletConnect storage:', e)
          }
        }
      }
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [mounted, isConnected, connector, disconnect])

  // Mark connection in session storage
  useEffect(() => {
    if (!mounted) return

    if (typeof window !== 'undefined' && isConnected) {
      const sessionKey = 'wallet_connected_this_session'
      sessionStorage.setItem(sessionKey, 'true')
    }
  }, [mounted, isConnected])

  // Auto-switch to required chain after connection
  useEffect(() => {
    // Only auto-switch if chainId is actually different and not null/undefined
    // Check if chainId is valid and different from required
    if (isConnected && chainId && chainId !== REQUIRED_CHAIN_ID && !hasSwitchedNetwork) {
      const attemptSwitch = async () => {
        try {
          console.log(
            `Auto-switching from chain ${chainId} to ${REQUIRED_CHAIN_NAME} (${REQUIRED_CHAIN_ID})...`
          )

          await switchChain({ chainId: REQUIRED_CHAIN_ID })
          setHasSwitchedNetwork(true)
        } catch (error: any) {
          const message = (error?.message || '').toLowerCase()
          const code = error?.code
          const isChainMissing =
            message.includes('not configured') ||
            message.includes('unrecognized chain') ||
            message.includes('unknown chain') ||
            code === 4902

          if (isChainMissing) {
            const added = await tryAddRequiredChain()
            if (added) {
              // Wait for wallet to process the add request
              await new Promise(resolve => setTimeout(resolve, 1000))
              try {
                await switchChain({ chainId: REQUIRED_CHAIN_ID })
                setHasSwitchedNetwork(true)
                return
              } catch (retryError) {
                console.warn('Switch failed after auto-adding network:', retryError)
              }
            }
          }

          console.log('Auto network switch failed or was rejected:', error)
          // Don't keep retrying automatically to avoid spamming the user
          setHasSwitchedNetwork(true) // Mark as "attempted" to stop loop
        }
      }

      // Wait a bit after connection before attempting switch
      const timeout = setTimeout(attemptSwitch, 1000)
      return () => clearTimeout(timeout)
    } else if (chainId === REQUIRED_CHAIN_ID) {
      setHasSwitchedNetwork(true)
    }
  }, [isConnected, chainId, hasSwitchedNetwork, switchChain])

  // Show consistent initial state on server and client
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <Button
          disabled
          size="sm"
          className="gap-2 border-2 border-gray-700 bg-black text-white text-xs sm:text-sm"
        >
          <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Wallet</span>
        </Button>
      </div>
    )
  }

  // Connected state
  if (isConnected && address) {
    // Log the connected wallet for debugging
    if (typeof window !== 'undefined') {
      console.log('Connected wallet:', {
        address,
        connector: connector?.name,
        connectorId: connector?.id,

      })
    }

    return (
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 sm:px-3 sm:py-2">
            <Wallet className="h-3 w-3 text-brand-green sm:h-4 sm:w-4" />
            <span className="text-xs font-medium text-white sm:text-sm" title={`Full address: ${address}\nConnector: ${connector?.name === 'Injected' ? 'Browser' : connector?.name || 'Unknown'}`}>
              {connector?.name === 'Injected' ? 'Browser' : connector?.name || 'Wallet'}: {ensName || `${address.slice(0, 6)}...${address.slice(-4)}`}
            </span>
          </div>
          {externalConnectors.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOtherWallets(!showOtherWallets)}
              className="gap-1 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showOtherWallets ? 'rotate-180' : ''}`} />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect()}
            className="gap-2 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
          >
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Disconnect</span>
          </Button>
        </div>

        {/* External wallet options dropdown */}
        {showOtherWallets && externalConnectors.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-lg sm:left-auto sm:right-0">
            <p className="mb-2 text-xs font-medium text-gray-400">Connect External Wallet</p>
            {externalConnectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => handleConnect(connector)}
                disabled={isPending}
                className="w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {connector.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Not connected - show connection options
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {externalConnectors.length > 0 ? (
          <Button
            size="sm"
            onClick={() => handleConnect(externalConnectors[0])}
            disabled={isPending}
            className="gap-2 bg-brand-green text-black hover:bg-[#4a9a26] text-xs sm:text-sm font-bold uppercase"
          >
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>
              {isPending ? 'Connecting...' : 'Connect Wallet'}
            </span>
          </Button>
        ) : (
          <Button
            size="sm"
            disabled
            className="gap-2 bg-gray-700 text-gray-400 text-xs sm:text-sm"
          >
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>No Wallet Available</span>
          </Button>
        )}

        {/* Show other wallets button if multiple options */}
        {externalConnectors.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOtherWallets(!showOtherWallets)}
            className="gap-1 border-2 border-gray-700 bg-black text-white hover:bg-gray-900 text-xs sm:text-sm"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showOtherWallets ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>

      {/* External wallet options dropdown */}
      {showOtherWallets && (
        <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-gray-700 bg-gray-900 p-2 shadow-lg sm:left-auto sm:right-0">
          <p className="mb-2 text-xs font-medium text-gray-400">Choose Wallet</p>
          {externalConnectors.slice(1).map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector)}
              disabled={isPending}
              className="w-full rounded px-2 py-1.5 text-left text-xs text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {connector.name === 'Injected' ? 'Browser' : connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
