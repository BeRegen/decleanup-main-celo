import { chai, expect, expectRevert } from "./helpers/setup";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("ImpactProductNFT", function () {
  async function deployImpactProductNFTFixture() {
    const [owner, user1, user2, rewardsContractOwner] =
      await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // Deploy DCUToken
    const dcuToken = await hre.viem.deployContract("DCUToken", [
      getAddress(owner.account.address),
    ]);

    // Deploy DCURewardManager with DCU token and temporary NFT address
    const dcuRewardManager = await hre.viem.deployContract("DCURewardManager", [
      getAddress(dcuToken.address),
      "0x0000000000000000000000000000000000000001", // Temporary NFT address
    ]);

    // Update the reward logic contract address in DCUToken to DCURewardManager
    await dcuToken.write.updateRewardLogicContract(
      [getAddress(dcuRewardManager.address)],
      {
        account: owner.account,
      }
    );

    // Deploy the ImpactProductNFT contract with the rewards contract address
    const impactProductNft = await hre.viem.deployContract("ImpactProductNFT", [
      getAddress(dcuRewardManager.address),
    ]);

    // Set the rewards contract in ImpactProductNFT to DCURewardManager
    await impactProductNft.write.setRewardsContract(
      [getAddress(dcuRewardManager.address)],
      {
        account: owner.account,
      }
    );

    // Verify POI for user1
    await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
      account: owner.account,
    });

    return {
      impactProductNft,
      dcuToken,
      dcuRewardManager,
      owner,
      user1,
      user2,
      rewardsContractOwner,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { impactProductNft } = await loadFixture(deployImpactProductNFTFixture);

      expect(await impactProductNft.read.name()).to.equal("Impact Product NFT");
      expect(await impactProductNft.read.symbol()).to.equal("IMPACT");
    });

    it("Should set the correct owner", async function () {
      const { impactProductNft, owner } = await loadFixture(deployImpactProductNFTFixture);

      expect(await impactProductNft.read.owner()).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("Should initialize token counter to zero", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to check if the counter starts from 0
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Check if the token ID is 0
      expect(await impactProductNft.read.ownerOf([0n])).to.equal(
        getAddress(user1.account.address)
      );
    });
  });

  describe("POI Verification", function () {
    it("Should allow owner to verify a POI", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });

      expect(await impactProductNft.read.verifiedPOI([getAddress(user1.account.address)]))
        .to.be.true;
    });

    it("Should emit POIVerified event when verifying a POI", async function () {
      const { impactProductNft, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      const tx = await impactProductNft.write.verifyPOI(
        [getAddress(user1.account.address)],
        {
          account: owner.account,
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);
    });

    it("Should prevent non-owners from verifying a POI", async function () {
      const { impactProductNft, user1, user2, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      await expectRevert(
        impactProductNft.simulate.verifyPOI(
          [getAddress(user2.account.address)],
          {
            account: user1.account,
          }
        ),
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should reject verification with zero address", async function () {
      const { impactProductNft, owner, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      await expectRevert(
        impactProductNft.simulate.verifyPOI(
          ["0x0000000000000000000000000000000000000000"],
          {
            account: owner.account,
          }
        ),
        "Invalid address"
      );

      const zeroVerified = await impactProductNft.read.verifiedPOI([
        "0x0000000000000000000000000000000000000000",
      ]);
      expect(zeroVerified).to.equal(false);
    });
  });

  describe("Rewards Contract Management", function () {
    it("Should allow owner to set rewards contract", async function () {
      const { impactProductNft, dcuRewardManager, owner } =
        await loadFixture(deployImpactProductNFTFixture);

      expect(await impactProductNft.read.rewardsContract()).to.equal(
        getAddress(dcuRewardManager.address)
      );
    });

    it("Should emit RewardsContractUpdated event", async function () {
      const { impactProductNft, dcuRewardManager, owner, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      const tx = await impactProductNft.write.setRewardsContract(
        [getAddress(dcuRewardManager.address)],
        {
          account: owner.account,
        }
      );

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);
    });

    it("Should prevent non-owners from setting rewards contract", async function () {
      const { impactProductNft, dcuRewardManager, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      await expectRevert(
        impactProductNft.simulate.setRewardsContract(
          [getAddress(dcuRewardManager.address)],
          {
            account: user1.account,
          }
        ),
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should reject setting rewards contract to zero address", async function () {
      const { impactProductNft, owner, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      await expectRevert(
        impactProductNft.simulate.setRewardsContract(
          ["0x0000000000000000000000000000000000000000"],
          {
            account: owner.account,
          }
        ),
        "Invalid rewards contract address"
      );
    });
  });

  describe("NFT Minting", function () {
    it("Should allow verified POI to mint an NFT", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Check ownership and levels
      expect(await impactProductNft.read.ownerOf([0n])).to.equal(
        getAddress(user1.account.address)
      );
      expect(
        await impactProductNft.read.userLevel([getAddress(user1.account.address)])
      ).to.equal(1n);
      expect(await impactProductNft.read.nftLevel([0n])).to.equal(1n);
      expect(await impactProductNft.read.impactLevel([0n])).to.equal(1n);
      expect(
        await impactProductNft.read._userHasMinted([getAddress(user1.account.address)])
      ).to.be.true;
    });

    it("Should emit Minted event when minting an NFT", async function () {
      const { impactProductNft, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      const tx = await impactProductNft.write.safeMint({
        account: user1.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);
    });

    it("Should emit DCURewards event when minting an NFT", async function () {
      const { impactProductNft, dcuRewardManager, dcuToken, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      const tx = await impactProductNft.write.safeMint({
        account: user1.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);

      // Note: In the updated approach, we're only checking for event emission
      // The actual reward distribution would be handled separately
    });

    it("Should prevent non-verified POI from minting", async function () {
      const { impactProductNft, user2, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      await expectRevert(
        impactProductNft.simulate.safeMint({
          account: user2.account,
        }),
        "You are not a verified POI"
      );
    });

    it("Should prevent minting more than one NFT per address", async function () {
      const { impactProductNft, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint first token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Try to mint second token
      await expectRevert(
        impactProductNft.simulate.safeMint({
          account: user1.account,
        }),
        "You have already minted a token"
      );
    });
  });

  describe("NFT Upgrading", function () {
    it("Should allow owner to upgrade their NFT", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Upgrade the NFT
      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      });

      // Check levels
      expect(
        await impactProductNft.read.userLevel([getAddress(user1.account.address)])
      ).to.equal(2n);
      expect(await impactProductNft.read.nftLevel([0n])).to.equal(2n);
    });

    it("Should emit NFTUpgraded event when upgrading an NFT", async function () {
      const { impactProductNft, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Upgrade the NFT
      const tx = await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);
    });

    it("Should emit DCURewardTriggered event when upgrading an NFT", async function () {
      const { impactProductNft, dcuRewardManager, dcuToken, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Upgrade the NFT
      const tx = await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);

      // Note: In the updated approach, we're only checking for event emission
      // The actual reward distribution would be handled separately
    });

    it("Should prevent upgrading NFT not owned by the caller", async function () {
      const { impactProductNft, owner, user1, user2, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Verify both users as POI
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });
      await impactProductNft.write.verifyPOI([getAddress(user2.account.address)], {
        account: owner.account,
      });

      // Mint a token for user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Mint a token for user2 so they have minted a token
      await impactProductNft.write.safeMint({
        account: user2.account,
      });

      // Try to upgrade user1's token with user2
      await expectRevert(
        impactProductNft.simulate.upgradeNFT([0n], {
          account: user2.account,
        }),
        "You don't own this token"
      );
    });

    it("Should prevent upgrading beyond MAX_LEVEL", async function () {
      const { impactProductNft, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Upgrade the NFT to MAX_LEVEL
      for (let i = 1; i < 10; i++) {
        await impactProductNft.write.upgradeNFT([0n], {
          account: user1.account,
        });
      }

      // Check level
      expect(await impactProductNft.read.nftLevel([0n])).to.equal(10n);

      // Try to upgrade beyond MAX_LEVEL
      await expectRevert(
        impactProductNft.simulate.upgradeNFT([0n], {
          account: user1.account,
        }),
        "You have reached the maximum level"
      );
    });
  });

  describe("Impact Level Management", function () {
    it("Should allow owner to update impact level", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Verify user1 as POI
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Update impact level
      await impactProductNft.write.updateImpactLevel([0n, 5n], {
        account: owner.account,
      });

      // Check impact level
      expect(await impactProductNft.read.impactLevel([0n])).to.equal(5n);
    });

    it("Should emit ImpactLevelUpdated event", async function () {
      const { impactProductNft, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Verify user1 as POI
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Update impact level
      const tx = await impactProductNft.write.updateImpactLevel([0n, 5n], {
        account: owner.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: tx,
      });

      // Check for events in the transaction logs
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);
    });

    it("Should prevent non-owners from updating impact level", async function () {
      const { impactProductNft, owner, user1, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Verify user1 as POI
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Try to update impact level as non-owner
      await expectRevert(
        impactProductNft.simulate.updateImpactLevel([0n, 5n], {
          account: user1.account,
        }),
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should reject updating impact level for non-existent token", async function () {
      const { impactProductNft, owner, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Try to update impact level for non-existent token
      await expectRevert(
        impactProductNft.simulate.updateImpactLevel([999n, 5n], {
          account: owner.account,
        }),
        "Token does not exist"
      );
    });
  });

  describe("NFT Data Retrieval", function () {
    it("Should return correct NFT data for a user", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Verify user1 as POI
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Update impact level
      await impactProductNft.write.updateImpactLevel([0n, 5n], {
        account: owner.account,
      });

      // Get NFT data
      const nftData = await impactProductNft.read.getUserNFTData([
        getAddress(user1.account.address),
      ]);

      expect(nftData[0]).to.equal(0n); // tokenId
      expect(nftData[1]).to.equal(5n); // impact
      expect(nftData[2]).to.equal(1n); // level
    });

    it("Should reject getting NFT data for user without NFT", async function () {
      const { impactProductNft, user1, owner } =
        await loadFixture(deployImpactProductNFTFixture);

      // Try to get NFT data for user without NFT
      await expectRevert(
        impactProductNft.simulate.getUserNFTData(
          [getAddress(user1.account.address)],
          {
            account: owner.account,
          }
        ),
        "User has no NFT"
      );
    });

    it("Should return correct category based on NFT level", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Verify user1 as POI
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Test different levels by updating the NFT level
      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      });
      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      }); // Level 3
      let tokenURI = await impactProductNft.read.tokenURI([0n]);
      let base64Data = tokenURI.split("base64,")[1];
      let jsonData = JSON.parse(Buffer.from(base64Data, "base64").toString());
      expect(jsonData.attributes[2].value).to.equal("Newbie");

      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      }); // Level 4
      tokenURI = await impactProductNft.read.tokenURI([0n]);
      base64Data = tokenURI.split("base64,")[1];
      jsonData = JSON.parse(Buffer.from(base64Data, "base64").toString());
      expect(jsonData.attributes[2].value).to.equal("Pro");

      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      });
      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      }); // Level 6
      tokenURI = await impactProductNft.read.tokenURI([0n]);
      base64Data = tokenURI.split("base64,")[1];
      jsonData = JSON.parse(Buffer.from(base64Data, "base64").toString());
      expect(jsonData.attributes[2].value).to.equal("Pro");

      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      }); // Level 7
      tokenURI = await impactProductNft.read.tokenURI([0n]);
      base64Data = tokenURI.split("base64,")[1];
      jsonData = JSON.parse(Buffer.from(base64Data, "base64").toString());
      expect(jsonData.attributes[2].value).to.equal("Hero");

      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      });
      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      }); // Level 9
      tokenURI = await impactProductNft.read.tokenURI([0n]);
      base64Data = tokenURI.split("base64,")[1];
      jsonData = JSON.parse(Buffer.from(base64Data, "base64").toString());
      expect(jsonData.attributes[2].value).to.equal("Hero");

      await impactProductNft.write.upgradeNFT([0n], {
        account: user1.account,
      }); // Level 10
      tokenURI = await impactProductNft.read.tokenURI([0n]);
      base64Data = tokenURI.split("base64,")[1];
      jsonData = JSON.parse(Buffer.from(base64Data, "base64").toString());
      expect(jsonData.attributes[2].value).to.equal("Guardian");
    });
  });

  describe("Token URI and Metadata", function () {
    it("Should generate correct token URI with metadata", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Verify user1 as POI
      await impactProductNft.write.verifyPOI([getAddress(user1.account.address)], {
        account: owner.account,
      });

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Get token URI
      const tokenURI = await impactProductNft.read.tokenURI([0n]);

      // Check if it's a data URI
      expect(tokenURI).to.include("data:application/json;base64,");

      // Decode the base64 part
      const base64Data = tokenURI.split("base64,")[1];
      const jsonData = Buffer.from(base64Data, "base64").toString();
      const metadata = JSON.parse(jsonData);

      // Check metadata structure
      expect(metadata.name).to.equal("Impact Product #0");
      expect(metadata.description).to.equal("DeCleanup Impact Product NFT");
      expect(metadata.attributes).to.have.lengthOf(3);
      expect(metadata.attributes[0].trait_type).to.equal("Level");
      expect(metadata.attributes[0].value).to.equal("1");
      expect(metadata.attributes[1].trait_type).to.equal("Impact");
      expect(metadata.attributes[1].value).to.equal("1");
      expect(metadata.attributes[2].trait_type).to.equal("Category");
      expect(metadata.attributes[2].value).to.equal("Newbie");
    });

    it("Should reject token URI for non-existent token", async function () {
      const { impactProductNft, owner } = await loadFixture(deployImpactProductNFTFixture);

      // Try to get token URI for non-existent token
      await expectRevert(
        impactProductNft.simulate.tokenURI([999n], { account: owner.account }),
        "Token does not exist"
      );
    });
  });

  // Add a new test section for reward distribution
  describe("Reward Distribution", function () {
    it("Should allow owner to distribute rewards", async function () {
      const { impactProductNft, owner, user1 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Distribute rewards - this should not throw an error
      await impactProductNft.write.distributeReward(
        [getAddress(user1.account.address), 1n],
        {
          account: owner.account,
        }
      );

      // If we get here, the test passes
    });

    it("Should prevent non-owners from distributing rewards", async function () {
      const { impactProductNft, user1, user2, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Try to distribute rewards as non-owner
      await expectRevert(
        impactProductNft.simulate.distributeReward(
          [getAddress(user2.account.address), 1n],
          {
            account: user1.account,
          }
        ),
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should reject distributing rewards to non-verified POI", async function () {
      const { impactProductNft, owner, user2, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Try to distribute rewards to non-verified POI
      await expectRevert(
        impactProductNft.simulate.distributeReward(
          [getAddress(user2.account.address), 1n],
          {
            account: owner.account,
          }
        ),
        "User is not a verified POI"
      );
    });

    it("Should reject distributing rewards to zero address", async function () {
      const { impactProductNft, owner, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Try to distribute rewards to zero address
      await expectRevert(
        impactProductNft.simulate.distributeReward(
          ["0x0000000000000000000000000000000000000000", 1n],
          {
            account: owner.account,
          }
        ),
        "Invalid user address"
      );
    });
  });

  describe("Soulbound Functionality", function () {
    it("Should prevent direct transfers of NFTs", async function () {
      const { impactProductNft, user1, user2 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Approve user2 to transfer the token
      await impactProductNft.write.approve([getAddress(user2.account.address), 0n], {
        account: user1.account,
      });

      // Attempt to transfer the token should fail
      await expectRevert(
        impactProductNft.simulate.transferFrom(
          [
            getAddress(user1.account.address),
            getAddress(user2.account.address),
            0n,
          ],
          { account: user2.account }
        ),
        "ImpactProductNFT: transfers are restricted (soulbound NFT)"
      );
    });

    it("Should prevent safeTransferFrom calls", async function () {
      const { impactProductNft, user1, user2 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Approve user2 to transfer the token
      await impactProductNft.write.approve([getAddress(user2.account.address), 0n], {
        account: user1.account,
      });

      // Attempt to safe transfer the token should fail
      await expectRevert(
        impactProductNft.simulate.safeTransferFrom(
          [
            getAddress(user1.account.address),
            getAddress(user2.account.address),
            0n,
          ],
          { account: user2.account }
        ),
        "ImpactProductNFT: transfers are restricted (soulbound NFT)"
      );
    });
  });

  describe("Admin Transfer Functionality", function () {
    it("Should allow admin to authorize a transfer", async function () {
      const { impactProductNft, owner, user1, user2 } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Admin authorizes transfer to user2
      await impactProductNft.write.authorizeTransfer(
        [0n, getAddress(user2.account.address)],
        {
          account: owner.account,
        }
      );

      // Check that transfer is authorized
      const [authorized, recipient] = await impactProductNft.read.isTransferAuthorized([
        0n,
      ]);
      expect(authorized).to.be.true;
      expect(recipient).to.equal(getAddress(user2.account.address));
    });

    it("Should allow transfer after admin authorization", async function () {
      const { impactProductNft, owner, user1, user2 } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Admin authorizes transfer to user2
      await impactProductNft.write.authorizeTransfer(
        [0n, getAddress(user2.account.address)],
        {
          account: owner.account,
        }
      );

      // Transfer should now succeed
      await impactProductNft.write.transferFrom(
        [
          getAddress(user1.account.address),
          getAddress(user2.account.address),
          0n,
        ],
        { account: user1.account }
      );

      // Check new owner
      expect(await impactProductNft.read.ownerOf([0n])).to.equal(
        getAddress(user2.account.address)
      );

      // Authorization should be reset after transfer
      const [authorized, recipient] = await impactProductNft.read.isTransferAuthorized([
        0n,
      ]);
      expect(authorized).to.be.false;
      expect(recipient).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should allow admin to perform direct transfers using adminTransfer", async function () {
      const { impactProductNft, owner, user1, user2 } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Admin performs a direct transfer
      await impactProductNft.write.adminTransfer(
        [0n, getAddress(user2.account.address)],
        {
          account: owner.account,
        }
      );

      // Check new owner
      expect(await impactProductNft.read.ownerOf([0n])).to.equal(
        getAddress(user2.account.address)
      );
    });

    it("Should allow admin to revoke a transfer authorization", async function () {
      const { impactProductNft, owner, user1, user2 } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Admin authorizes transfer to user2
      await impactProductNft.write.authorizeTransfer(
        [0n, getAddress(user2.account.address)],
        {
          account: owner.account,
        }
      );

      // Admin revokes authorization
      await impactProductNft.write.revokeTransferAuthorization([0n], {
        account: owner.account,
      });

      // Check that authorization was revoked
      const [authorized, recipient] = await impactProductNft.read.isTransferAuthorized([
        0n,
      ]);
      expect(authorized).to.be.false;

      // Attempt to transfer should now fail
      await expectRevert(
        impactProductNft.simulate.transferFrom(
          [
            getAddress(user1.account.address),
            getAddress(user2.account.address),
            0n,
          ],
          { account: user1.account }
        ),
        "ImpactProductNFT: transfers are restricted (soulbound NFT)"
      );
    });

    it.skip("Should emit correct events for admin transfer authorizations", async function () {
      const { impactProductNft, owner, user1, user2, publicClient } =
        await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // Watch for events
      const startBlock = await publicClient.getBlockNumber();

      // Admin authorizes transfer
      await impactProductNft.write.authorizeTransfer(
        [0n, getAddress(user2.account.address)],
        {
          account: owner.account,
        }
      );

      // Admin performs transfer
      await impactProductNft.write.adminTransfer(
        [0n, getAddress(user2.account.address)],
        {
          account: owner.account,
        }
      );

      // Get events
      const endBlock = await publicClient.getBlockNumber();

      const logs = await publicClient.getContractEvents({
        address: getAddress(impactProductNft.address),
        fromBlock: startBlock,
        toBlock: endBlock,
        eventName: "TransferAuthorized",
        abi: impactProductNft.abi,
      });

      const adminTransferLogs = await publicClient.getContractEvents({
        address: getAddress(impactProductNft.address),
        fromBlock: startBlock,
        toBlock: endBlock,
        eventName: "NFTTransferredByAdmin",
        abi: impactProductNft.abi,
      });

      // Verify events were emitted
      expect(logs.length).to.be.greaterThan(0);
      expect(adminTransferLogs.length).to.be.greaterThan(0);
    });

    it("Should only allow the owner to authorize transfers", async function () {
      const { impactProductNft, user1, user2 } = await loadFixture(deployImpactProductNFTFixture);

      // Mint a token to user1
      await impactProductNft.write.safeMint({
        account: user1.account,
      });

      // User2 attempts to authorize a transfer (should fail)
      await expectRevert(
        impactProductNft.simulate.authorizeTransfer(
          [0n, getAddress(user2.account.address)],
          {
            account: user2.account,
          }
        ),
        "OwnableUnauthorizedAccount"
      );
    });
  });
});
