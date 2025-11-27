import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";

describe("NFTCollection", function () {
  async function deployNFTFixture() {
    const [owner, user] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const nftCollection = await hre.viem.deployContract("NFTCollection");

    return {
      nftCollection,
      owner,
      user,
      publicClient,
    };
  }

  describe("NFT Operations", function () {
    it("Should set the correct name and symbol", async function () {
      const { nftCollection } = await loadFixture(deployNFTFixture);

      expect(await nftCollection.read.name()).to.equal("DCU NFT Collection");
      expect(await nftCollection.read.symbol()).to.equal("DCUNFT");
    });

    it("Should mint NFTs with incremental IDs", async function () {
      const { nftCollection, owner, user } = await loadFixture(
        deployNFTFixture
      );

      await nftCollection.write.mint([getAddress(user.account.address)], {
        account: owner.account,
      });
      expect(await nftCollection.read.ownerOf([0n])).to.equal(
        getAddress(user.account.address)
      );

      await nftCollection.write.mint([getAddress(user.account.address)], {
        account: owner.account,
      });
      expect(await nftCollection.read.ownerOf([1n])).to.equal(
        getAddress(user.account.address)
      );
    });

    it("Should prevent non-owners from minting", async function () {
      const { nftCollection, user } = await loadFixture(deployNFTFixture);

      await expect(
        nftCollection.write.mint([getAddress(user.account.address)], {
          account: user.account,
        })
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });
  });
});
