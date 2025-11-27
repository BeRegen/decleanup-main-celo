import { chai, expect, expectRevert } from "./helpers/setup";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";
import { time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

describe("DCURewardManager", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2, user3] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // Deploy DCU token with owner as temporary reward logic
    const maxSupply = 1000000n * 10n ** 18n; // 1 million tokens with 18 decimals
    const dcuToken = await hre.viem.deployContract("DCUToken", [
      owner.account.address, // Use owner as temporary reward logic
    ]);

    // Deploy DCURewardManager with temporary NFT address
    const dcuRewardManager = await hre.viem.deployContract("DCURewardManager", [
      dcuToken.address,
      "0x0000000000000000000000000000000000000001", // Temporary address
    ]);

    // Deploy ImpactProductNFT for testing with the rewards contract address
    const impactProductNft = await hre.viem.deployContract("ImpactProductNFT", [
      dcuRewardManager.address,
    ]);

    // Update the NFT collection address in DCURewardManager
    await dcuRewardManager.write.updateNftCollection([impactProductNft.address], {
      account: owner.account,
    });

    // Update the reward logic contract address in DCUToken to DCURewardManager
    await dcuToken.write.updateRewardLogicContract([dcuRewardManager.address], {
      account: owner.account,
    });

    // Set the rewards contract in ImpactProductNFT to the DCURewardManager
    await impactProductNft.write.setRewardsContract([dcuRewardManager.address], {
      account: owner.account,
    });

    // Transfer ownership to DCURewardManager for additional management
    await dcuToken.write.transferOwnership([dcuRewardManager.address]);

    return {
      dcuToken,
      dcuRewardManager,
      owner,
      user1,
      user2,
      user3,
      publicClient,
      impactProductNft,
    };
  }

  describe("Impact Product Claim Rewards", function () {
    it("Should not reward if PoI is not verified", async function () {
      const { dcuRewardManager, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      // Try to reward Impact Product claim without PoI verification
      await expectRevert(
        dcuRewardManager.simulate.rewardImpactProductClaim(
          [getAddress(user1.account.address), 1n],
          { account: owner.account }
        ),
        "User not eligible for rewards"
      );
    });

    it("Should reward for Impact Product claim after PoI verification", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      // Complete verification sequence
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );
      await impactProductNft.write.mint([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Reward Impact Product claim
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user1.account.address), 1n],
        { account: owner.account }
      );

      // Check balance
      const balance = await dcuRewardManager.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(10n * 10n ** 18n); // 10 DCU
    });

    it("Should prevent duplicate rewards for the same level", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      // Complete verification sequence
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );
      await impactProductNft.write.mint([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Reward Impact Product claim
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user1.account.address), 1n],
        { account: owner.account }
      );

      // Try to reward the same level again
      await expectRevert(
        dcuRewardManager.simulate.rewardImpactProductClaim(
          [getAddress(user1.account.address), 1n],
          { account: owner.account }
        ),
        "Level already claimed"
      );

      // But can claim a different level
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user1.account.address), 2n],
        { account: owner.account }
      );

      // Check balance (should be 20 DCU now)
      const balance = await dcuRewardManager.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(20n * 10n ** 18n); // 20 DCU
    });
  });

  describe("PoI Streak Rewards", function () {
    it("Should not reward streak for first PoI verification", async function () {
      const { dcuRewardManager, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      // Verify PoI for the first time
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );

      // Check balance (should be 0 as no streak yet)
      const balance = await dcuRewardManager.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(0n);
    });

    it("Should reward streak for PoI verification within 7 days", async function () {
      const { dcuRewardManager, user1, owner, publicClient } =
        await loadFixture(deployContractsFixture);

      // Verify PoI for the first time
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );

      // Advance time by 6 days
      await time.increase(6 * 24 * 60 * 60);

      // Verify PoI again
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );

      // Check balance (should be 3 DCU for streak)
      const balance = await dcuRewardManager.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(3n * 10n ** 18n); // 3 DCU
    });

    it("Should not reward streak for PoI verification after 7 days", async function () {
      const { dcuRewardManager, user1, owner, publicClient } =
        await loadFixture(deployContractsFixture);

      // Verify PoI for the first time
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );

      // Advance time by 8 days
      await time.increase(8 * 24 * 60 * 60);

      // Verify PoI again
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );

      // Check balance (should be 0 as streak was broken)
      const balance = await dcuRewardManager.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(0n);
    });
  });

  describe("Referral Rewards", function () {
    it("Should register referral relationship", async function () {
      const { dcuRewardManager, user1, user2, owner } = await loadFixture(
        deployContractsFixture
      );

      // Register referral
      await dcuRewardManager.write.registerReferral(
        [getAddress(user2.account.address), getAddress(user1.account.address)],
        { account: owner.account }
      );

      // Check referrer
      const referrer = await dcuRewardManager.read.getReferrer([
        getAddress(user2.account.address),
      ]);
      expect(referrer).to.equal(getAddress(user1.account.address));
    });

    it("Should reward referrer when invitee claims Impact Product", async function () {
      const { dcuRewardManager, impactProductNft, user1, user2, owner } =
        await loadFixture(deployContractsFixture);

      // Register referral relationship
      await dcuRewardManager.write.registerReferral(
        [getAddress(user2.account.address), getAddress(user1.account.address)],
        { account: owner.account }
      );

      // Complete verification sequence for invitee
      await impactProductNft.write.verifyPOI([getAddress(user2.account.address)], {
        account: owner.account,
      });
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user2.account.address), true],
        { account: owner.account }
      );
      await impactProductNft.write.mint([getAddress(user2.account.address)], {
        account: owner.account,
      });

      // Reward Impact Product claim for invitee
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user2.account.address), 1n],
        { account: owner.account }
      );

      // Check referrer balance
      const referrerBalance = await dcuRewardManager.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(referrerBalance).to.equal(1n * 10n ** 18n); // 1 DCU referral reward
    });

    it("Should only reward referrer once per invitee", async function () {
      const { dcuRewardManager, impactProductNft, user1, user2, owner } =
        await loadFixture(deployContractsFixture);

      // Register referral relationship
      await dcuRewardManager.write.registerReferral(
        [getAddress(user2.account.address), getAddress(user1.account.address)],
        { account: owner.account }
      );

      // Complete verification sequence for invitee
      await impactProductNft.write.verifyPOI([getAddress(user2.account.address)], {
        account: owner.account,
      });
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user2.account.address), true],
        { account: owner.account }
      );
      await impactProductNft.write.mint([getAddress(user2.account.address)], {
        account: owner.account,
      });

      // Reward Impact Product claim for invitee
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user2.account.address), 1n],
        { account: owner.account }
      );

      // Reward another level
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user2.account.address), 2n],
        { account: owner.account }
      );

      // Check referrer balance (should still be 1 DCU)
      const referrerBalance = await dcuRewardManager.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(referrerBalance).to.equal(1n * 10n ** 18n); // 1 DCU referral reward
    });
  });

  describe("Reward Claiming", function () {
    it("Should allow users to claim their rewards", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      // Complete verification sequence
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );
      await impactProductNft.write.mint([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Reward Impact Product claim
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user1.account.address), 1n],
        { account: owner.account }
      );

      // Claim rewards
      await dcuRewardManager.write.claimRewards([10n * 10n ** 18n], {
        account: user1.account,
      });

      // Check balance after claiming
      const balance = await dcuRewardManager.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(0n); // Balance should be 0 after claiming
    });
  });

  // Add a new test section for the getter functions
  describe("Reward Tracking and Getter Functions", function () {
    it("Should track total earned DCU correctly", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      // Complete verification sequence
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );
      await impactProductNft.write.mint([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Reward Impact Product claim
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user1.account.address), 1n],
        { account: owner.account }
      );

      // Check total earned DCU
      const totalEarned = await dcuRewardManager.read.getTotalEarnedDCU([
        getAddress(user1.account.address),
      ]);
      expect(totalEarned).to.equal(10n * 10n ** 18n); // 10 DCU
    });

    it("Should provide correct rewards breakdown", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      // Complete verification sequence
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );
      await impactProductNft.write.mint([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Reward Impact Product claim
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user1.account.address), 1n],
        { account: owner.account }
      );

      // Get rewards breakdown
      const [
        claimRewards,
        streakRewards,
        referralRewards,
        currentBalance,
        claimedRewards,
      ] = await dcuRewardManager.read.getRewardsBreakdown([
        getAddress(user1.account.address),
      ]);

      expect(claimRewards).to.equal(10n * 10n ** 18n); // 10 DCU from claims
      expect(streakRewards).to.equal(0n); // No streak rewards yet
      expect(referralRewards).to.equal(0n); // No referral rewards yet
      expect(currentBalance).to.equal(10n * 10n ** 18n); // 10 DCU total balance
      expect(claimedRewards).to.equal(0n); // Nothing claimed yet
    });

    it("Should provide complete user stats", async function () {
      const { dcuRewardManager, impactProductNft, user1, owner } = await loadFixture(
        deployContractsFixture
      );

      // Complete verification sequence
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });
      await dcuRewardManager.write.setPoiVerificationStatus(
        [getAddress(user1.account.address), true],
        { account: owner.account }
      );
      await impactProductNft.write.mint([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Reward Impact Product claim
      await dcuRewardManager.write.rewardImpactProductClaim(
        [getAddress(user1.account.address), 1n],
        { account: owner.account }
      );

      // Get user stats
      const stats = await dcuRewardManager.read.getUserRewardStats([
        getAddress(user1.account.address),
      ]);

      expect(stats.currentBalance).to.equal(10n * 10n ** 18n); // 10 DCU current balance
      expect(stats.totalEarned).to.equal(10n * 10n ** 18n); // 10 DCU total earned
      expect(stats.totalClaimed).to.equal(0n); // Nothing claimed yet
      expect(stats.claimRewardsAmount).to.equal(10n * 10n ** 18n); // 10 DCU from claims
      expect(stats.streakRewardsAmount).to.equal(0n); // No streak rewards
      expect(stats.referralRewardsAmount).to.equal(0n); // No referral rewards
    });
  });
});
