import { expect } from "chai";
import { DipMetadataGenerator } from "../utils/metadataGenerator";
import { CONSTANT_TRAITS, LEVEL_THRESHOLDS } from "../types/DipMetadata";

describe("DipMetadata", function () {
  describe("Metadata Generation", function () {
    it("should generate valid metadata with correct structure", function () {
      const tokenId = 1;
      const impactValue = 5;
      const totalCleanups = 10;
      const lastCleanupDate = new Date();

      const metadata = DipMetadataGenerator.generateMetadata(
        tokenId,
        impactValue,
        totalCleanups,
        lastCleanupDate
      );

      // Check basic metadata fields
      expect(metadata.name).to.equal(`DeCleanup Impact Product #${tokenId}`);
      expect(metadata.image).to.include(`${tokenId}.png`);
      expect(metadata.external_url).to.include(`${tokenId}`);
      
      // Verify constant traits
      const traits = metadata.attributes.reduce((acc: { [key: string]: any }, trait) => {
        acc[trait.trait_type] = trait.value;
        return acc;
      }, {});

      expect(traits["Type"]).to.equal(CONSTANT_TRAITS.TYPE);
      expect(traits["Impact"]).to.equal(CONSTANT_TRAITS.IMPACT);
      expect(traits["Category"]).to.equal(CONSTANT_TRAITS.CATEGORY);
    });

    it("should assign correct level based on impact value", function () {
      const testCases = [
        { impactValue: 1, expectedLevel: "NEWBIE" },
        { impactValue: 15, expectedLevel: "PRO" },
        { impactValue: 60, expectedLevel: "HERO" },
        { impactValue: 100, expectedLevel: "GUARDIAN" }
      ];

      testCases.forEach(({ impactValue, expectedLevel }) => {
        const metadata = DipMetadataGenerator.generateMetadata(
          1,
          impactValue,
          1,
          new Date()
        );

        const levelTrait = metadata.attributes.find(
          attr => attr.trait_type === "Level"
        );
        expect(levelTrait?.value).to.equal(expectedLevel);
      });
    });

    it("should include all required dynamic traits", function () {
      const metadata = DipMetadataGenerator.generateMetadata(
        1,
        5,
        10,
        new Date()
      );

      const requiredTraits = [
        "Level",
        "Impact Value",
        "Total Cleanups",
        "Last Cleanup Date"
      ];

      requiredTraits.forEach(trait => {
        const hasTrait = metadata.attributes.some(
          attr => attr.trait_type === trait
        );
        expect(hasTrait, `Missing trait: ${trait}`).to.be.true;
      });
    });
  });

  describe("Metadata Validation", function () {
    it("should validate correct metadata", function () {
      const metadata = DipMetadataGenerator.generateMetadata(
        1,
        5,
        10,
        new Date()
      );
      
      const isValid = DipMetadataGenerator.validateMetadata(metadata);
      expect(isValid).to.be.true;
    });

    it("should reject invalid metadata", function () {
      const invalidMetadata = {
        name: "",  // Invalid: empty name
        description: "Test",
        image: "ipfs://test",
        external_url: "https://test.com",
        attributes: [
          {
            trait_type: "Type",
            value: "Invalid Type"  // Invalid: wrong constant trait
          }
        ],
        properties: {
          level_thresholds: LEVEL_THRESHOLDS,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }
      };

      const isValid = DipMetadataGenerator.validateMetadata(invalidMetadata as any);
      expect(isValid).to.be.false;
    });

    it("should properly handle level thresholds", function () {
      const metadata = DipMetadataGenerator.generateMetadata(
        1,
        5,
        10,
        new Date()
      );

      expect(metadata.properties.level_thresholds).to.deep.equal(LEVEL_THRESHOLDS);
    });
  });

  describe("Edge Cases", function () {
    it("should handle boundary impact values", function () {
      const boundaryTests = [
        { value: 0, expectedLevel: "NEWBIE" },
        { value: 1, expectedLevel: "NEWBIE" },
        { value: 9, expectedLevel: "NEWBIE" },
        { value: 10, expectedLevel: "PRO" },
        { value: 49, expectedLevel: "PRO" },
        { value: 50, expectedLevel: "HERO" },
        { value: 99, expectedLevel: "HERO" },
        { value: 100, expectedLevel: "GUARDIAN" },
        { value: 150, expectedLevel: "GUARDIAN" }
      ];

      boundaryTests.forEach(({ value, expectedLevel }) => {
        const metadata = DipMetadataGenerator.generateMetadata(
          1,
          value,
          1,
          new Date()
        );
        const levelTrait = metadata.attributes.find(
          attr => attr.trait_type === "Level"
        );
        expect(levelTrait?.value).to.equal(expectedLevel);
      });
    });

    it("should handle large numbers", function () {
      const metadata = DipMetadataGenerator.generateMetadata(
        999999,
        1000000,
        1000000,
        new Date()
      );

      expect(metadata.name).to.include("999999");
      const impactValueTrait = metadata.attributes.find(
        attr => attr.trait_type === "Impact Value"
      );
      expect(impactValueTrait?.value).to.equal(1000000);
    });
  });
}); 