/**
 * Hypercert Image Generator
 * Creates logo, banner, and main image for Hypercerts from cleanup photos and impact data
 */

import { uploadToIPFS } from '@/lib/blockchain/ipfs'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import type { CleanupData } from '@/lib/blockchain/hypercerts-metadata'

/**
 * Generate a collage image from multiple cleanup photos
 * Creates a grid layout with before/after photos
 */
export async function generateHypercertCollage(
    beforePhotos: string[],
    afterPhotos: string[],
    width: number = 1200,
    height: number = 800
): Promise<string> {
    // For now, we'll use a canvas-based approach
    // In production, this could be done server-side with sharp/image processing
    
    // Create a canvas element
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
        throw new Error('Could not get canvas context')
    }

    // Fill background with gradient (green theme)
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#1a1a1a')
    gradient.addColorStop(1, '#0a3d2e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Load and draw photos in a grid
    const photos = [...beforePhotos, ...afterPhotos].slice(0, 6) // Max 6 photos
    const cols = 3
    const rows = Math.ceil(photos.length / cols)
    const photoWidth = width / cols
    const photoHeight = height / rows

    let loadedCount = 0
    const loadPromises = photos.map(async (hash, index) => {
        try {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            
            return new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    const col = index % cols
                    const row = Math.floor(index / cols)
                    const x = col * photoWidth
                    const y = row * photoHeight

                    // Draw photo with rounded corners
                    ctx.save()
                    ctx.beginPath()
                    // Use arcTo for rounded corners (compatible with older browsers)
                    const radius = 10
                    const left = x + 10
                    const top = y + 10
                    const right = left + photoWidth - 20
                    const bottom = top + photoHeight - 20
                    ctx.moveTo(left + radius, top)
                    ctx.lineTo(right - radius, top)
                    ctx.quadraticCurveTo(right, top, right, top + radius)
                    ctx.lineTo(right, bottom - radius)
                    ctx.quadraticCurveTo(right, bottom, right - radius, bottom)
                    ctx.lineTo(left + radius, bottom)
                    ctx.quadraticCurveTo(left, bottom, left, bottom - radius)
                    ctx.lineTo(left, top + radius)
                    ctx.quadraticCurveTo(left, top, left + radius, top)
                    ctx.closePath()
                    ctx.clip()
                    ctx.drawImage(img, left, top, photoWidth - 20, photoHeight - 20)
                    ctx.restore()

                    loadedCount++
                    resolve()
                }
                img.onerror = () => {
                    console.warn(`Failed to load photo ${hash}`)
                    resolve() // Continue even if one photo fails
                }
                
                // Try multiple IPFS gateways
                const gateways = [
                    `https://ipfs.io/ipfs/${hash}`,
                    `https://gateway.pinata.cloud/ipfs/${hash}`,
                    `https://dweb.link/ipfs/${hash}`,
                    `https://cloudflare-ipfs.com/ipfs/${hash}`,
                ]
                
                let gatewayIndex = 0
                const tryNextGateway = () => {
                    if (gatewayIndex < gateways.length) {
                        img.src = gateways[gatewayIndex++]
                    } else {
                        reject(new Error(`Could not load photo from any gateway: ${hash}`))
                    }
                }
                
                img.onerror = () => tryNextGateway()
                tryNextGateway()
            })
        } catch (error) {
            console.error(`Error loading photo ${hash}:`, error)
            return Promise.resolve()
        }
    })

    await Promise.all(loadPromises)

    // Convert canvas to blob and upload to IPFS
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                reject(new Error('Failed to create image blob'))
                return
            }

            try {
                const file = new File([blob], `hypercert-collage-${Date.now()}.png`, { type: 'image/png' })
                const result = await uploadToIPFS(file)
                resolve(result.hash)
            } catch (error) {
                reject(error)
            }
        }, 'image/png')
    })
}

/**
 * Generate a banner image with stats overlay
 * Shows key metrics: weight, area, hours, cleanup count
 */
export async function generateHypercertBanner(
    cleanupData: CleanupData,
    hypercertNumber: number,
    width: number = 1200,
    height: number = 400
): Promise<string> {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
        throw new Error('Could not get canvas context')
    }

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#0a3d2e')
    gradient.addColorStop(0.5, '#1a5f3f')
    gradient.addColorStop(1, '#0a3d2e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Add subtle pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    for (let i = 0; i < width; i += 50) {
        for (let j = 0; j < height; j += 50) {
            ctx.fillRect(i, j, 1, 1)
        }
    }

    // Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`DeCleanup Impact Certificate #${hypercertNumber}`, width / 2, 80)

    // Stats in a grid
    const stats = [
        { label: 'Cleanups', value: cleanupData.cleanupIds.length.toString() },
        { label: 'Weight Removed', value: `${cleanupData.totalWeight.toFixed(1)} kg` },
        { label: 'Area Cleaned', value: `${cleanupData.totalArea.toFixed(1)} m²` },
        { label: 'Hours Spent', value: `${cleanupData.totalHours.toFixed(1)} h` },
    ]

    const statWidth = width / stats.length
    ctx.font = 'bold 36px Arial'
    ctx.textAlign = 'center'
    
    stats.forEach((stat, index) => {
        const x = (index + 0.5) * statWidth
        ctx.fillStyle = '#4ade80' // brand-green
        ctx.fillText(stat.value, x, 200)
        ctx.fillStyle = '#ffffff'
        ctx.font = '24px Arial'
        ctx.fillText(stat.label, x, 240)
        ctx.font = 'bold 36px Arial' // Reset for next iteration
    })

    // Footer text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = '18px Arial'
    ctx.fillText('Onchain Environmental Impact Certificate', width / 2, height - 30)

    // Convert to blob and upload
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                reject(new Error('Failed to create banner image'))
                return
            }

            try {
                const file = new File([blob], `hypercert-banner-${hypercertNumber}.png`, { type: 'image/png' })
                const result = await uploadToIPFS(file)
                resolve(result.hash)
            } catch (error) {
                reject(error)
            }
        }, 'image/png')
    })
}

/**
 * Generate a square logo (400x400) for Hypercerts
 * Uses DeCleanup branding with cleanup icon
 */
export async function generateHypercertLogo(hypercertNumber: number): Promise<string> {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
        throw new Error('Could not get canvas context')
    }

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 400, 400)
    gradient.addColorStop(0, '#0a3d2e')
    gradient.addColorStop(1, '#1a5f3f')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 400, 400)

    // Draw a simple leaf/cleanup icon
    ctx.fillStyle = '#4ade80'
    ctx.beginPath()
    // Simple leaf shape
    ctx.ellipse(200, 180, 80, 100, -0.3, 0, Math.PI * 2)
    ctx.fill()
    
    // Add number badge
    ctx.fillStyle = '#fbbf24' // brand-yellow
    ctx.beginPath()
    ctx.arc(280, 120, 40, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 32px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`#${hypercertNumber}`, 280, 120)

    // Text
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('DeCleanup', 200, 320)

    // Convert to blob and upload
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                reject(new Error('Failed to create logo image'))
                return
            }

            try {
                const file = new File([blob], `hypercert-logo-${hypercertNumber}.png`, { type: 'image/png' })
                const result = await uploadToIPFS(file)
                resolve(result.hash)
            } catch (error) {
                reject(error)
            }
        }, 'image/png')
    })
}

/**
 * Generate all images needed for a Hypercert
 * Returns IPFS hashes for logo, banner, and main image
 */
export async function generateHypercertImages(
    cleanupData: CleanupData,
    hypercertNumber: number
): Promise<{
    logo: string
    banner: string
    image: string
}> {
    console.log('🎨 Generating Hypercert images...')

    // Generate logo (400x400)
    console.log('   Generating logo...')
    const logo = await generateHypercertLogo(hypercertNumber)

    // Generate banner (1200x400)
    console.log('   Generating banner...')
    const banner = await generateHypercertBanner(cleanupData, hypercertNumber)

    // Generate main image (collage or best photo)
    console.log('   Generating main image...')
    let image: string
    if (cleanupData.afterPhotos.length > 0) {
        // Try to create collage if we have multiple photos
        if (cleanupData.afterPhotos.length >= 2) {
            try {
                image = await generateHypercertCollage(
                    cleanupData.beforePhotos.slice(0, 3),
                    cleanupData.afterPhotos.slice(0, 3),
                    1200,
                    800
                )
            } catch (error) {
                console.warn('Failed to generate collage, using single photo:', error)
                image = cleanupData.afterPhotos[cleanupData.afterPhotos.length - 1]
            }
        } else {
            // Use the best after photo
            image = cleanupData.afterPhotos[cleanupData.afterPhotos.length - 1]
        }
    } else {
        // Fallback: use banner as main image
        image = banner
    }

    console.log('✅ All images generated and uploaded to IPFS')
    console.log(`   Logo: ${logo}`)
    console.log(`   Banner: ${banner}`)
    console.log(`   Main Image: ${image}`)

    return { logo, banner, image }
}

