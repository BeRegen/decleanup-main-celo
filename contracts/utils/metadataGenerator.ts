import { DipMetadata, CONSTANT_TRAITS, LEVEL_THRESHOLDS, LevelName } from '../types/DipMetadata';

export class DipMetadataGenerator {
  private static getLevelFromImpactValue(impactValue: number): LevelName {
    if (impactValue >= LEVEL_THRESHOLDS.GUARDIAN) return 'GUARDIAN';
    if (impactValue >= LEVEL_THRESHOLDS.HERO) return 'HERO';
    if (impactValue >= LEVEL_THRESHOLDS.PRO) return 'PRO';
    return 'NEWBIE';
  }

  static generateMetadata(
    tokenId: number,
    impactValue: number,
    totalCleanups: number,
    lastCleanupDate: Date
  ): DipMetadata {
    const level = this.getLevelFromImpactValue(impactValue);

    return {
      name: `DeCleanup Impact Product #${tokenId}`,
      description: "Dynamic Impact Product (dIP) representing environmental cleanup contributions on the DeCleanup Network",
      image: `ipfs://<CID>/${tokenId}.png`,
      external_url: `https://decleanup.network/dip/${tokenId}`,
      
      attributes: [
        {
          trait_type: "Type",
          value: CONSTANT_TRAITS.TYPE
        },
        {
          trait_type: "Impact",
          value: CONSTANT_TRAITS.IMPACT
        },
        {
          trait_type: "Category",
          value: CONSTANT_TRAITS.CATEGORY
        },
        {
          trait_type: "Level",
          value: level,
          display_type: "string"
        },
        {
          trait_type: "Impact Value",
          value: impactValue,
          display_type: "number",
          max_value: 100
        },
        {
          trait_type: "Total Cleanups",
          value: totalCleanups,
          display_type: "number"
        },
        {
          trait_type: "Last Cleanup Date",
          value: Math.floor(lastCleanupDate.getTime() / 1000),
          display_type: "date"
        }
      ],
      
      properties: {
        level_thresholds: LEVEL_THRESHOLDS,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }
    };
  }

  static validateMetadata(metadata: DipMetadata): boolean {
    // Basic validation
    if (!metadata.name || !metadata.description || !metadata.image) {
      return false;
    }

    // Validate required attributes
    const requiredTraits = [
      CONSTANT_TRAITS.TYPE,
      CONSTANT_TRAITS.IMPACT,
      CONSTANT_TRAITS.CATEGORY
    ];

    const hasRequiredTraits = requiredTraits.every(trait =>
      metadata.attributes.some(attr => attr.value === trait)
    );

    return hasRequiredTraits;
  }
} 