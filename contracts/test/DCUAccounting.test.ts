import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";

describe("DCUAccounting", function () {
  async function deployAccountingFixture() {
    const [owner, user1, user2] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // Deploy DCUToken with the owner as the reward logic address
    const rewardLogicAddress = owner.account.address;
    const dcuToken = await hre.viem.deployContract("DCUToken", [
      rewardLogicAddress,
    ]);

    const dcuAccounting = await hre.viem.deployContract("DCUAccounting", [
      dcuToken.address,
    ]);

    // Mint some tokens to users and owner
    await dcuToken.write.mint(
      [getAddress(user1.account.address), 1000n * 10n ** 18n],
      {
        account: owner.account,
      }
    );

    await dcuToken.write.mint(
      [getAddress(user2.account.address), 1000n * 10n ** 18n],
      {
        account: owner.account,
      }
    );

    await dcuToken.write.mint(
      [getAddress(owner.account.address), 1000n * 10n ** 18n],
      {
        account: owner.account,
      }
    );

    return {
      dcuToken,
      dcuAccounting,
      owner,
      user1,
      user2,
      publicClient,
    };
  }

  describe("Basic Deposit and Withdrawal", function () {
    it("Should allow deposits", async function () {
      const { dcuToken, dcuAccounting, user1 } = await loadFixture(
        deployAccountingFixture
      );

      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });

      await dcuAccounting.write.deposit([amount], {
        account: user1.account,
      });

      const balance = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(amount);

      // Check total deposits
      const totalDeposits = await dcuAccounting.read.totalDeposits();
      expect(totalDeposits).to.equal(amount);
    });

    it("Should allow withdrawals", async function () {
      const { dcuToken, dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // Set TGE as completed to allow withdrawals
      await dcuAccounting.write.setTGEStatus([true], {
        account: owner.account,
      });

      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });

      await dcuAccounting.write.deposit([amount], {
        account: user1.account,
      });

      await dcuAccounting.write.withdraw([amount], {
        account: user1.account,
      });

      const balance = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(0n);

      // Check total deposits
      const totalDeposits = await dcuAccounting.read.totalDeposits();
      expect(totalDeposits).to.equal(0n);
    });

    it("Should prevent withdrawals exceeding balance", async function () {
      const { dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // Set TGE as completed to allow withdrawals
      await dcuAccounting.write.setTGEStatus([true], {
        account: owner.account,
      });

      await expect(
        dcuAccounting.write.withdraw([1n * 10n ** 18n], {
          account: user1.account,
        })
      ).to.be.rejectedWith("Insufficient balance");
    });

    it("Should prevent deposits of zero amount", async function () {
      const { dcuAccounting, user1 } = await loadFixture(
        deployAccountingFixture
      );

      await expect(
        dcuAccounting.write.deposit([0n], {
          account: user1.account,
        })
      ).to.be.rejectedWith("Amount must be greater than 0");
    });

    it("Should prevent withdrawals of zero amount", async function () {
      const { dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // Set TGE as completed to allow withdrawals
      await dcuAccounting.write.setTGEStatus([true], {
        account: owner.account,
      });

      await expect(
        dcuAccounting.write.withdraw([0n], {
          account: user1.account,
        })
      ).to.be.rejectedWith("Amount must be greater than 0");
    });
  });

  describe("Admin Operations", function () {
    it("Should allow owner to deposit for a user", async function () {
      const { dcuToken, dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: owner.account,
      });

      await dcuAccounting.write.depositFor(
        [getAddress(user1.account.address), amount],
        { account: owner.account }
      );

      const balance = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(amount);

      // Check total deposits
      const totalDeposits = await dcuAccounting.read.totalDeposits();
      expect(totalDeposits).to.equal(amount);
    });

    it("Should allow owner to withdraw for a user", async function () {
      const { dcuToken, dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // Set TGE as completed to allow withdrawals
      await dcuAccounting.write.setTGEStatus([true], {
        account: owner.account,
      });

      // First deposit some tokens
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: owner.account,
      });

      await dcuAccounting.write.depositFor(
        [getAddress(user1.account.address), amount],
        { account: owner.account }
      );

      // Now withdraw on behalf of the user
      await dcuAccounting.write.withdrawFor(
        [getAddress(user1.account.address), amount],
        { account: owner.account }
      );

      const balance = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(0n);

      // Check total deposits
      const totalDeposits = await dcuAccounting.read.totalDeposits();
      expect(totalDeposits).to.equal(0n);
    });

    it("Should prevent non-owners from depositing for others", async function () {
      const { dcuToken, dcuAccounting, user1, user2 } = await loadFixture(
        deployAccountingFixture
      );

      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });

      await expect(
        dcuAccounting.write.depositFor(
          [getAddress(user2.account.address), amount],
          { account: user1.account }
        )
      ).to.be.rejected;
    });

    it("Should prevent non-owners from withdrawing for others", async function () {
      const { dcuToken, dcuAccounting, owner, user1, user2 } =
        await loadFixture(deployAccountingFixture);

      // First deposit some tokens as owner
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: owner.account,
      });

      await dcuAccounting.write.depositFor(
        [getAddress(user2.account.address), amount],
        { account: owner.account }
      );

      // Try to withdraw as non-owner
      await expect(
        dcuAccounting.write.withdrawFor(
          [getAddress(user2.account.address), amount],
          { account: user1.account }
        )
      ).to.be.rejected;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to perform emergency withdrawal", async function () {
      const { dcuToken, dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // First deposit some tokens
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });

      await dcuAccounting.write.deposit([amount], {
        account: user1.account,
      });

      // Get owner's initial balance
      const initialOwnerBalance = await dcuToken.read.balanceOf([
        getAddress(owner.account.address),
      ]);

      // Perform emergency withdrawal
      await dcuAccounting.write.emergencyWithdraw({
        account: owner.account,
      });

      // Check owner's new balance
      const newOwnerBalance = await dcuToken.read.balanceOf([
        getAddress(owner.account.address),
      ]);
      expect(newOwnerBalance).to.equal(initialOwnerBalance + amount);

      // Contract balance should be 0
      const contractBalance = await dcuToken.read.balanceOf([
        dcuAccounting.address,
      ]);
      expect(contractBalance).to.equal(0n);
    });

    it("Should prevent non-owners from performing emergency withdrawal", async function () {
      const { dcuAccounting, user1 } = await loadFixture(
        deployAccountingFixture
      );

      await expect(
        dcuAccounting.write.emergencyWithdraw({ account: user1.account })
      ).to.be.rejected;
    });
  });

  describe("Balance Tracking", function () {
    it("Should correctly track balances for multiple users", async function () {
      const { dcuToken, dcuAccounting, owner, user1, user2 } =
        await loadFixture(deployAccountingFixture);

      // Set TGE as completed to allow withdrawals
      await dcuAccounting.write.setTGEStatus([true], {
        account: owner.account,
      });

      // User 1 deposits
      const amount1 = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount1], {
        account: user1.account,
      });
      await dcuAccounting.write.deposit([amount1], {
        account: user1.account,
      });

      // User 2 deposits
      const amount2 = 150n * 10n ** 18n; // 150 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount2], {
        account: user2.account,
      });
      await dcuAccounting.write.deposit([amount2], {
        account: user2.account,
      });

      // Check individual balances
      const balance1 = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(balance1).to.equal(amount1);

      const balance2 = await dcuAccounting.read.balances([
        getAddress(user2.account.address),
      ]);
      expect(balance2).to.equal(amount2);

      // Check total deposits
      const totalDeposits = await dcuAccounting.read.totalDeposits();
      expect(totalDeposits).to.equal(amount1 + amount2);

      // User 1 withdraws partial amount
      const withdrawAmount = 50n * 10n ** 18n; // 50 tokens
      await dcuAccounting.write.withdraw([withdrawAmount], {
        account: user1.account,
      });

      // Check updated balances
      const updatedBalance1 = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(updatedBalance1).to.equal(amount1 - withdrawAmount);

      // Check updated total deposits
      const updatedTotalDeposits = await dcuAccounting.read.totalDeposits();
      expect(updatedTotalDeposits).to.equal(amount1 + amount2 - withdrawAmount);
    });

    it("Should correctly report balances using getBalance function", async function () {
      const { dcuToken, dcuAccounting, user1 } = await loadFixture(
        deployAccountingFixture
      );

      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });
      await dcuAccounting.write.deposit([amount], {
        account: user1.account,
      });

      const balance = await dcuAccounting.read.getBalance([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(amount);
    });
  });

  describe("TGE Restrictions", function () {
    it("Should prevent non-whitelisted users from withdrawing before TGE", async function () {
      const { dcuToken, dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // First deposit some tokens
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });

      await dcuAccounting.write.deposit([amount], {
        account: user1.account,
      });

      // Verify TGE is not completed
      const tgeStatus = await dcuAccounting.read.tgeCompleted();
      expect(tgeStatus).to.equal(false);

      // Try to withdraw as non-whitelisted user
      await expect(
        dcuAccounting.write.withdraw([amount], {
          account: user1.account,
        })
      ).to.be.rejectedWith("Transfers not allowed before TGE");
    });

    it("Should allow whitelisted users to withdraw before TGE", async function () {
      const { dcuToken, dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // Add user1 to whitelist
      await dcuAccounting.write.addToWhitelist(
        [getAddress(user1.account.address)],
        {
          account: owner.account,
        }
      );

      // Verify user1 is whitelisted
      const isWhitelisted = await dcuAccounting.read.isWhitelisted([
        getAddress(user1.account.address),
      ]);
      expect(isWhitelisted).to.equal(true);

      // Deposit and withdraw
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });

      await dcuAccounting.write.deposit([amount], {
        account: user1.account,
      });

      await dcuAccounting.write.withdraw([amount], {
        account: user1.account,
      });

      const balance = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(0n);
    });

    it("Should allow all users to withdraw after TGE", async function () {
      const { dcuToken, dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // First deposit some tokens
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });

      await dcuAccounting.write.deposit([amount], {
        account: user1.account,
      });

      // Set TGE as completed
      await dcuAccounting.write.setTGEStatus([true], {
        account: owner.account,
      });

      // Verify TGE is completed
      const tgeStatus = await dcuAccounting.read.tgeCompleted();
      expect(tgeStatus).to.equal(true);

      // Withdraw as non-whitelisted user after TGE
      await dcuAccounting.write.withdraw([amount], {
        account: user1.account,
      });

      const balance = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(balance).to.equal(0n);
    });
  });

  describe("Whitelist Management", function () {
    it("Should allow owner to add and remove addresses from whitelist", async function () {
      const { dcuAccounting, owner, user1 } = await loadFixture(
        deployAccountingFixture
      );

      // Add user1 to whitelist
      await dcuAccounting.write.addToWhitelist(
        [getAddress(user1.account.address)],
        {
          account: owner.account,
        }
      );

      // Verify user1 is whitelisted
      let isWhitelisted = await dcuAccounting.read.isWhitelisted([
        getAddress(user1.account.address),
      ]);
      expect(isWhitelisted).to.equal(true);

      // Remove user1 from whitelist
      await dcuAccounting.write.removeFromWhitelist(
        [getAddress(user1.account.address)],
        {
          account: owner.account,
        }
      );

      // Verify user1 is no longer whitelisted
      isWhitelisted = await dcuAccounting.read.isWhitelisted([
        getAddress(user1.account.address),
      ]);
      expect(isWhitelisted).to.equal(false);
    });

    it("Should prevent non-owners from managing whitelist", async function () {
      const { dcuAccounting, owner, user1, user2 } = await loadFixture(
        deployAccountingFixture
      );

      await expect(
        dcuAccounting.write.addToWhitelist(
          [getAddress(user2.account.address)],
          {
            account: user1.account,
          }
        )
      ).to.be.rejected;

      // Owner adds user2 to whitelist
      await dcuAccounting.write.addToWhitelist(
        [getAddress(user2.account.address)],
        {
          account: owner.account,
        }
      );

      await expect(
        dcuAccounting.write.removeFromWhitelist(
          [getAddress(user2.account.address)],
          {
            account: user1.account,
          }
        )
      ).to.be.rejected;
    });
  });

  describe("Internal Transfers", function () {
    it("Should allow internal transfers between users", async function () {
      const { dcuToken, dcuAccounting, user1, user2 } = await loadFixture(
        deployAccountingFixture
      );

      // User1 deposits tokens
      const amount = 100n * 10n ** 18n; // 100 tokens
      await dcuToken.write.approve([dcuAccounting.address, amount], {
        account: user1.account,
      });

      await dcuAccounting.write.deposit([amount], {
        account: user1.account,
      });

      // User1 transfers internally to user2
      const transferAmount = 50n * 10n ** 18n; // 50 tokens
      await dcuAccounting.write.internalTransfer(
        [getAddress(user2.account.address), transferAmount],
        { account: user1.account }
      );

      // Check balances
      const user1Balance = await dcuAccounting.read.balances([
        getAddress(user1.account.address),
      ]);
      expect(user1Balance).to.equal(amount - transferAmount);

      const user2Balance = await dcuAccounting.read.balances([
        getAddress(user2.account.address),
      ]);
      expect(user2Balance).to.equal(transferAmount);

      // Total deposits should remain unchanged
      const totalDeposits = await dcuAccounting.read.totalDeposits();
      expect(totalDeposits).to.equal(amount);
    });

    it("Should prevent internal transfers with insufficient balance", async function () {
      const { dcuAccounting, user1, user2 } = await loadFixture(
        deployAccountingFixture
      );

      const transferAmount = 50n * 10n ** 18n; // 50 tokens
      await expect(
        dcuAccounting.write.internalTransfer(
          [getAddress(user2.account.address), transferAmount],
          { account: user1.account }
        )
      ).to.be.rejectedWith("Insufficient balance");
    });
  });
});
