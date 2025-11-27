import { chai, expect } from "./helpers/setup";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";

describe("DCUToken", function () {
  async function deployTokenFixture() {
    const [owner, user, governance] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // Deploy a mock reward logic contract first (we'll use owner address for simplicity)
    const rewardLogicAddress = owner.account.address;

    const dcuToken = await hre.viem.deployContract("DCUToken", [
      rewardLogicAddress,
    ]);

    return {
      dcuToken,
      owner,
      user,
      governance,
      publicClient,
      rewardLogicAddress,
    };
  }

  describe("Basic Token Operations", function () {
    it("Should set the correct name and symbol", async function () {
      const { dcuToken } = await loadFixture(deployTokenFixture);

      expect(await dcuToken.read.name()).to.equal("DeCleanup Utility Token");
      expect(await dcuToken.read.symbol()).to.equal("DCU");
      expect(await dcuToken.read.decimals()).to.equal(18);
    });

    it("Should allow reward logic contract to mint tokens with no cap", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);

      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.mint([getAddress(user.account.address), amount], {
        account: owner.account,
      });

      const balance = await dcuToken.read.balanceOf([
        getAddress(user.account.address),
      ]);
      expect(balance).to.equal(amount);
      
      // Check totalMinted is updated
      const totalMinted = await dcuToken.read.totalMinted();
      expect(totalMinted).to.equal(amount);
    });

    it("Should track total minted tokens accurately", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);

      // Mint several times
      const amount1 = 100n * 10n ** 18n; // 100 tokens
      const amount2 = 200n * 10n ** 18n; // 200 tokens
      const amount3 = 150n * 10n ** 18n; // 150 tokens
      
      await dcuToken.write.mint([getAddress(user.account.address), amount1], {
        account: owner.account,
      });
      
      await dcuToken.write.mint([getAddress(user.account.address), amount2], {
        account: owner.account,
      });
      
      await dcuToken.write.mint([getAddress(user.account.address), amount3], {
        account: owner.account,
      });

      // Total minted should be the sum
      const totalMinted = await dcuToken.read.totalMinted();
      expect(totalMinted).to.equal(amount1 + amount2 + amount3);
      
      // Get total minted via helper function
      const getTotalMinted = await dcuToken.read.getTotalMinted();
      expect(getTotalMinted).to.equal(totalMinted);
    });

    it("Should allow owner to burn tokens", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);

      // First mint some tokens
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.mint([getAddress(user.account.address), amount], {
        account: owner.account,
      });

      // Then burn them
      await dcuToken.write.burn([getAddress(user.account.address), amount], {
        account: owner.account,
      });

      const balance = await dcuToken.read.balanceOf([
        getAddress(user.account.address),
      ]);
      expect(balance).to.equal(0n);
      
      // Total minted should still track the original amount even after burning
      const totalMinted = await dcuToken.read.totalMinted();
      expect(totalMinted).to.equal(amount);
    });

    it("Should prevent non-reward-logic from minting", async function () {
      const { dcuToken, user } = await loadFixture(deployTokenFixture);

      const amount = 100n * 10n ** 18n; // 100 tokens
      await expect(
        dcuToken.write.mint([getAddress(user.account.address), amount], {
          account: user.account,
        })
      ).to.be.rejectedWith("Only RewardLogic Contract can mint");
    });

    it("Should allow owner to update reward logic contract", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);

      // Get the initial reward logic contract
      const initialRewardLogic = await dcuToken.read.rewardLogicContract();

      // Update to a new address (user's address for this test)
      await dcuToken.write.updateRewardLogicContract(
        [getAddress(user.account.address)],
        {
          account: owner.account,
        }
      );

      // Check that the reward logic contract was updated
      const newRewardLogic = await dcuToken.read.rewardLogicContract();
      expect(newRewardLogic).to.equal(getAddress(user.account.address));
      expect(newRewardLogic).to.not.equal(initialRewardLogic);

      // Now user should be able to mint tokens
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.mint([getAddress(owner.account.address), amount], {
        account: user.account,
      });

      // Check the balance
      const balance = await dcuToken.read.balanceOf([
        getAddress(owner.account.address),
      ]);
      expect(balance).to.equal(amount);
    });

    it("Should prevent non-owners from updating reward logic contract", async function () {
      const { dcuToken, user } = await loadFixture(deployTokenFixture);

      // Try to update reward logic contract as non-owner
      await expect(
        dcuToken.write.updateRewardLogicContract(
          [getAddress(user.account.address)],
          {
            account: user.account,
          }
        )
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });
  });
  
  describe("Supply Cap Functions", function () {
    it("Should start with no supply cap", async function () {
      const { dcuToken } = await loadFixture(deployTokenFixture);
      
      const supplyCapActive = await dcuToken.read.supplyCapActive();
      expect(supplyCapActive).to.equal(false);
    });
    
    it("Should allow owner to set a supply cap", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);
      
      // First mint some tokens
      const mintAmount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.mint([getAddress(user.account.address), mintAmount], {
        account: owner.account,
      });
      
      // Set a supply cap
      const capAmount = 1000n * 10n ** 18n; // 1000 tokens
      await dcuToken.write.setSupplyCap([capAmount], {
        account: owner.account,
      });
      
      // Check that the cap was set correctly
      const supplyCapActive = await dcuToken.read.supplyCapActive();
      const supplyCap = await dcuToken.read.supplyCap();
      expect(supplyCapActive).to.equal(true);
      expect(supplyCap).to.equal(capAmount);
      
      // Check circulation status
      const circulationStatus = await dcuToken.read.getCirculationStatus();
      expect(circulationStatus[0]).to.equal(mintAmount); // current supply
      expect(circulationStatus[1]).to.equal(mintAmount); // total minted
      expect(circulationStatus[2]).to.equal(true); // cap active
      expect(circulationStatus[3]).to.equal(capAmount); // cap amount
    });
    
    it("Should enforce the supply cap when active", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);
      
      // Set a supply cap first
      const capAmount = 500n * 10n ** 18n; // 500 tokens
      await dcuToken.write.setSupplyCap([capAmount], {
        account: owner.account,
      });
      
      // Mint some tokens under the cap
      const mintAmount1 = 300n * 10n ** 18n; // 300 tokens
      await dcuToken.write.mint([getAddress(user.account.address), mintAmount1], {
        account: owner.account,
      });
      
      // Try to mint more than the cap allows
      const mintAmount2 = 201n * 10n ** 18n; // 201 tokens (would exceed cap)
      await expect(
        dcuToken.write.mint([getAddress(user.account.address), mintAmount2], {
          account: owner.account,
        })
      ).to.be.rejectedWith("Supply cap would be exceeded");
      
      // Mint exactly up to the cap
      const mintAmount3 = 200n * 10n ** 18n; // 200 tokens (exactly hits cap)
      await dcuToken.write.mint([getAddress(user.account.address), mintAmount3], {
        account: owner.account,
      });
      
      // Check total supply equals cap
      const totalSupply = await dcuToken.read.totalSupply();
      expect(totalSupply).to.equal(capAmount);
    });
    
    it("Should allow owner to remove the supply cap", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);
      
      // Set a supply cap first
      const capAmount = 500n * 10n ** 18n; // 500 tokens
      await dcuToken.write.setSupplyCap([capAmount], {
        account: owner.account,
      });
      
      // Mint some tokens
      const mintAmount1 = 300n * 10n ** 18n; // 300 tokens
      await dcuToken.write.mint([getAddress(user.account.address), mintAmount1], {
        account: owner.account,
      });
      
      // Remove the supply cap
      await dcuToken.write.removeSupplyCap({
        account: owner.account,
      });
      
      // Check that the cap was removed
      const supplyCapActive = await dcuToken.read.supplyCapActive();
      expect(supplyCapActive).to.equal(false);
      
      // Now we should be able to mint beyond the previous cap
      const mintAmount2 = 500n * 10n ** 18n; // Another 500 tokens (beyond previous cap)
      await dcuToken.write.mint([getAddress(user.account.address), mintAmount2], {
        account: owner.account,
      });
      
      // Check total supply exceeds previous cap
      const totalSupply = await dcuToken.read.totalSupply();
      expect(totalSupply).to.equal(mintAmount1 + mintAmount2);
      expect(totalSupply > capAmount).to.be.true;
    });
    
    it("Should prevent setting a cap lower than current supply", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);
      
      // Mint some tokens
      const mintAmount = 1000n * 10n ** 18n; // 1000 tokens
      await dcuToken.write.mint([getAddress(user.account.address), mintAmount], {
        account: owner.account,
      });
      
      // Try to set a cap lower than the current supply
      const lowCapAmount = 500n * 10n ** 18n; // 500 tokens
      await expect(
        dcuToken.write.setSupplyCap([lowCapAmount], {
          account: owner.account,
        })
      ).to.be.rejectedWith("Cap cannot be less than current supply");
    });
  });
  
  describe("ERC20 Extensions", function () {
    it("Should support ERC20 Permit functionality", async function () {
      // Test basic existence of ERC20Permit functions
      const { dcuToken } = await loadFixture(deployTokenFixture);
      
      expect(typeof dcuToken.read.DOMAIN_SEPARATOR).to.equal('function');
      expect(typeof dcuToken.read.nonces).to.equal('function');
      expect(typeof dcuToken.write.permit).to.equal('function');
    });
    
    it("Should support ERC20Burnable functionality", async function () {
      const { dcuToken, owner, user } = await loadFixture(deployTokenFixture);
      
      // Mint tokens first
      const mintAmount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.mint([getAddress(user.account.address), mintAmount], {
        account: owner.account,
      });
      
      // User should be able to burn their own tokens
      const burnAmount = 30n * 10n ** 18n; // 30 tokens
      await dcuToken.write.burn([burnAmount], {
        account: user.account,
      });
      
      // Check the balance after burning
      const balance = await dcuToken.read.balanceOf([
        getAddress(user.account.address),
      ]);
      expect(balance).to.equal(mintAmount - burnAmount);
    });
  });
});
