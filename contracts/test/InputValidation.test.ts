import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";

describe("Input Validation", function () {
  let impactProductNft: Contract;
  let rewardManager: Contract;
  let dcuToken: Contract;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let nftCollection: Contract;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy NFT Collection first
    const NFTCollection = await ethers.getContractFactory("NFTCollection");
    nftCollection = await NFTCollection.deploy();
    await nftCollection.deployed();

    // Deploy DCU Token with temporary reward logic (will update later)
    const DCUToken = await ethers.getContractFactory("DCUToken");
    dcuToken = await DCUToken.deploy(owner.address);
    await dcuToken.deployed();

    // Deploy Reward Manager with DCU token and NFT collection
    const RewardManager = await ethers.getContractFactory("DCURewardManager");
    rewardManager = await RewardManager.deploy(
      dcuToken.address,
      nftCollection.address
    );
    await rewardManager.deployed();

    // Deploy ImpactProductNFT with rewards manager
    const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
    impactProductNft = await ImpactProductNFT.deploy(rewardManager.address);
    await impactProductNft.deployed();

    // Now update reward logic to point to the actual reward manager
    await dcuToken
      .connect(owner)
      .updateRewardLogicContract(rewardManager.address);

    // Setup rewardManager in ImpactProductNFT
    await impactProductNft
      .connect(owner)
      .setRewardsContract(rewardManager.address);

    // Verify user1 as POI in both contracts
    await impactProductNft.connect(owner).verifyPOI(user1.address);
    await rewardManager
      .connect(owner)
      .setPoiVerificationStatus(user1.address, true);

    // Mock NFT ownership for user1
    await nftCollection
      .connect(owner)
      .mockBalanceOf(user1.address, 1);

    // Set reward eligibility for testing
    await rewardManager
      .connect(owner)
      .setRewardEligibilityForTesting(user1.address, true);
  });

  describe("ImpactProductNFT Input Validation", function () {
    it("Should reject updateImpactLevel with invalid impact level", async function () {
      // Mint an NFT first
      await impactProductNft.connect(user1).safeMint();
      const tokenId = 0; // First token ID

      // Try with impact level 0 (invalid)
      try {
        await impactProductNft.connect(owner).updateImpactLevel(tokenId, 0);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Invalid impact level range");
      }

      // Try with impact level 11 (invalid)
      const MAX_LEVEL = 10;
      try {
        await impactProductNft
          .connect(owner)
          .updateImpactLevel(tokenId, MAX_LEVEL + 1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Invalid impact level range");
      }

      // Should work with valid impact level
      await impactProductNft.connect(owner).updateImpactLevel(tokenId, 5);
    });

    it("Should reject distributeReward with invalid level", async function () {
      const userAddress = user1.address;

      // Try with level 0 (invalid)
      try {
        await impactProductNft.connect(owner).distributeReward(userAddress, 0);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Invalid level range");
      }

      // Try with level 11 (invalid)
      const MAX_LEVEL = 10;
      try {
        await impactProductNft
          .connect(owner)
          .distributeReward(userAddress, MAX_LEVEL + 1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("Invalid level range");
      }

      // Should work with valid level
      await impactProductNft.connect(owner).distributeReward(userAddress, 5);
    });
  });

  describe("DCURewardManager Input Validation", function () {
    it("Should reject rewardImpactProductClaim with invalid level", async function () {
      const userAddress = user1.address;

      // Try with level 0 (invalid)
      try {
        await rewardManager
          .connect(owner)
          .rewardImpactProductClaim(userAddress, 0);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("REWARD__InvalidLevel");
      }

      // Try with level 11 (invalid)
      const MAX_LEVEL = 10;
      try {
        await rewardManager
          .connect(owner)
          .rewardImpactProductClaim(userAddress, MAX_LEVEL + 1);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("REWARD__InvalidLevel");
      }

      // Should work with valid level
      await rewardManager
        .connect(owner)
        .rewardImpactProductClaim(userAddress, 5);
    });

    it("Should reject updateRewardAmounts with excessive reward amounts", async function () {
      const MAX_REWARD_AMOUNT = ethers.utils.parseEther("1000"); // 1000 ether
      const validAmount = ethers.utils.parseEther("100");
      const excessiveAmount = ethers.utils.parseEther("1001");

      // Try with excessive product claim reward
      try {
        await rewardManager
          .connect(owner)
          .updateRewardAmounts(excessiveAmount, validAmount, validAmount);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("REWARD__ExcessiveRewardAmount");
      }

      // Try with excessive referral reward
      try {
        await rewardManager
          .connect(owner)
          .updateRewardAmounts(validAmount, excessiveAmount, validAmount);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("REWARD__ExcessiveRewardAmount");
      }

      // Try with excessive streak reward
      try {
        await rewardManager
          .connect(owner)
          .updateRewardAmounts(validAmount, validAmount, excessiveAmount);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("REWARD__ExcessiveRewardAmount");
      }

      // Should work with valid amounts
      await rewardManager
        .connect(owner)
        .updateRewardAmounts(validAmount, validAmount, validAmount);
    });

    it("Should reject claimRewards with zero amount", async function () {
      // Try to claim 0 tokens
      try {
        await rewardManager.connect(user1).claimRewards(0);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("REWARD__ZeroAmount");
      }
    });

    it("Should reject setPoiVerificationStatus with zero address", async function () {
      // Try with zero address
      try {
        await rewardManager
          .connect(owner)
          .setPoiVerificationStatus(ethers.constants.AddressZero, true);
        expect.fail("Should have thrown error");
      } catch (error: any) {
        expect(error.message).to.include("REWARD__InvalidAddress");
      }
    });
  });
});
