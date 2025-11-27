/**
 * Hypercerts metadata and data structures
 */

export interface CleanupData {
    cleanupIds: bigint[]
    locations: { lat: number; lng: number; type: string }[]
    totalWeight: number // in kg
    totalArea: number // in sqm
    totalHours: number
    wasteTypes: Set<string>
    contributors: Set<string>
    beforePhotos: string[] // IPFS hashes
    afterPhotos: string[] // IPFS hashes
    startDate: Date
    endDate: Date
    rightsAssignment: string
    challenges: string[]
    preventionIdeas: string[]
}

export interface HypercertMetadata {
    name: string
    description: string
    image: string
    logo?: string // Square logo (400x400)
    banner?: string // Banner image (1200x400)
    external_url?: string
    properties: Array<{
        trait_type: string
        value: any
    }>
}

/**
 * Build Hypercert metadata from aggregated cleanup data
 * @param userAddress User's wallet address
 * @param cleanupData Aggregated cleanup data
 * @param hypercertNumber Hypercert number (1, 2, 3...)
 * @param images Optional pre-generated images (logo, banner, image)
 */
export function buildHypercertMetadata(
    userAddress: string,
    cleanupData: CleanupData,
    hypercertNumber: number,
    images?: { logo: string; banner: string; image: string }
): HypercertMetadata {
    const locationTypes = [...new Set(cleanupData.locations.map(l => l.type))]
    const wasteTypesStr = [...cleanupData.wasteTypes].join(', ')

    // Use generated images if provided, otherwise fallback to photos
    const mainImage = images?.image 
        ? `ipfs://${images.image}`
        : cleanupData.afterPhotos.length > 0
        ? `ipfs://${cleanupData.afterPhotos[cleanupData.afterPhotos.length - 1]}`
        : ''

    const logo = images?.logo ? `ipfs://${images.logo}` : undefined
    const banner = images?.banner ? `ipfs://${images.banner}` : undefined

    return {
        name: `DeCleanup Impact Certificate #${hypercertNumber}`,
        description: `Environmental cleanup impact certificate representing ${cleanupData.cleanupIds.length} verified cleanups by ${userAddress}. Total waste removed: ${cleanupData.totalWeight}kg across ${cleanupData.totalArea}m² in ${locationTypes.join(', ')} locations.`,
        image: mainImage,
        logo,
        banner,
        external_url: `https://decleanup.network/hypercert/${hypercertNumber}`,

        properties: [
            // Required Hypercert dimensions
            {
                trait_type: 'work_scope',
                value: [
                    `Environmental cleanup in ${locationTypes.join(', ')} locations`,
                    `Waste types: ${wasteTypesStr}`,
                    `${cleanupData.cleanupIds.length} verified cleanup events`,
                ],
            },
            {
                trait_type: 'work_timeframe',
                value: [
                    Math.floor(cleanupData.startDate.getTime() / 1000), // UTC timestamp
                    Math.floor(cleanupData.endDate.getTime() / 1000),
                ],
            },
            {
                trait_type: 'impact_scope',
                value: [
                    'Environmental restoration',
                    'Waste removal and proper disposal',
                    'Community environmental awareness',
                    `${cleanupData.totalWeight}kg waste removed`,
                    `${cleanupData.totalArea}m² area cleaned`,
                ],
            },
            {
                trait_type: 'impact_timeframe',
                value: ['indefinite'], // Environmental impact is ongoing
            },
            {
                trait_type: 'contributors',
                value: [userAddress, ...Array.from(cleanupData.contributors)],
            },
            {
                trait_type: 'rights',
                value: mapRightsAssignment(cleanupData.rightsAssignment),
            },

            // Additional DeCleanup-specific properties
            {
                trait_type: 'total_weight_kg',
                value: cleanupData.totalWeight,
            },
            {
                trait_type: 'total_area_sqm',
                value: cleanupData.totalArea,
            },
            {
                trait_type: 'total_hours',
                value: cleanupData.totalHours,
            },
            {
                trait_type: 'cleanup_count',
                value: cleanupData.cleanupIds.length,
            },
            {
                trait_type: 'location_types',
                value: locationTypes,
            },
            {
                trait_type: 'waste_types',
                value: Array.from(cleanupData.wasteTypes),
            },
            {
                trait_type: 'before_photos',
                value: cleanupData.beforePhotos.map(hash => `ipfs://${hash}`),
            },
            {
                trait_type: 'after_photos',
                value: cleanupData.afterPhotos.map(hash => `ipfs://${hash}`),
            },
            {
                trait_type: 'environmental_challenges',
                value: cleanupData.challenges,
            },
            {
                trait_type: 'prevention_ideas',
                value: cleanupData.preventionIdeas,
            },
        ],
    }
}

/**
 * Map rights assignment from DeCleanup to Hypercert format
 */
function mapRightsAssignment(rights: string): string[] {
    const rightsMap: Record<string, string[]> = {
        'attribution': ['Public Display', 'Attribution Required'],
        'non-commercial': ['Public Display', 'Non-Commercial Use Only'],
        'no-derivatives': ['Public Display', 'No Derivatives'],
        'share-alike': ['Public Display', 'Share Alike'],
        'all-rights-reserved': ['All Rights Reserved'],
        '': ['Public Display'], // Default
    }
    return rightsMap[rights] || rightsMap['']
}
