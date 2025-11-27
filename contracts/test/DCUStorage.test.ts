import { expect } from "chai";
import hre from "hardhat";
import { Contract, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("DCUStorage", function () {
  let DCUStorage: any;
  let dcuStorage: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  beforeEach(async function () {
    // Get the ContractFactory and Signers
    const ethers = hre.ethers;
    DCUStorage = await ethers.getContractFactory("DCUStorage");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy the contract
    dcuStorage = await DCUStorage.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await dcuStorage.owner()).to.equal(owner.address);
    });

    it("Should assign roles to the owner", async function () {
      const MINTER_ROLE = await dcuStorage.MINTER_ROLE();
      const GOVERNANCE_ROLE = await dcuStorage.GOVERNANCE_ROLE();

      expect(await dcuStorage.hasRole(MINTER_ROLE, owner.address)).to.equal(
        true
      );
      expect(await dcuStorage.hasRole(GOVERNANCE_ROLE, owner.address)).to.equal(
        true
      );
    });

    it("Should whitelist the owner and contract", async function () {
      expect(await dcuStorage.whitelisted(owner.address)).to.equal(true);
      expect(await dcuStorage.whitelisted(dcuStorage.address)).to.equal(true);
    });

    it("Should set TGE status to false initially", async function () {
      expect(await dcuStorage.tgeCompleted()).to.equal(false);
    });
  });

  describe("TGE and Whitelist Management", function () {
    it("Should allow governance to set TGE status", async function () {
      await dcuStorage.setTGEStatus(true);
      expect(await dcuStorage.tgeCompleted()).to.equal(true);
    });

    it("Should allow governance to add addresses to whitelist", async function () {
      await dcuStorage.addToWhitelist(addr1.address);
      expect(await dcuStorage.whitelisted(addr1.address)).to.equal(true);
    });

    it("Should allow governance to remove addresses from whitelist", async function () {
      await dcuStorage.addToWhitelist(addr1.address);
      await dcuStorage.removeFromWhitelist(addr1.address);
      expect(await dcuStorage.whitelisted(addr1.address)).to.equal(false);
    });

    it("Should prevent non-governance from managing whitelist", async function () {
      await expect(dcuStorage.connect(addr1).addToWhitelist(addr2.address)).to
        .be.rejected;
    });
  });

  describe("Claimable Balances", function () {
    beforeEach(async function () {
      // Grant REWARD_MANAGER_ROLE to addr1 for testing
      const REWARD_MANAGER_ROLE = await dcuStorage.REWARD_MANAGER_ROLE();
      await dcuStorage.grantRole(REWARD_MANAGER_ROLE, addr1.address);
    });

    it("Should allow reward manager to add claimable balances", async function () {
      await dcuStorage
        .connect(addr1)
        .addClaimableBalance(addr2.address, utils.parseEther("100"));

      const balance = await dcuStorage.getClaimableBalance(addr2.address);
      expect(balance.toString()).to.equal(utils.parseEther("100").toString());

      const total = await dcuStorage.totalClaimable();
      expect(total.toString()).to.equal(utils.parseEther("100").toString());
    });

    it("Should prevent claiming tokens before TGE if not whitelisted", async function () {
      await dcuStorage
        .connect(addr1)
        .addClaimableBalance(addr2.address, utils.parseEther("100"));

      await expect(
        dcuStorage.connect(addr2).claimTokens(utils.parseEther("50"))
      ).to.be.rejectedWith("Transfers not allowed before TGE");
    });

    it("Should allow claiming tokens after TGE", async function () {
      await dcuStorage
        .connect(addr1)
        .addClaimableBalance(addr2.address, utils.parseEther("100"));
      await dcuStorage.setTGEStatus(true);

      await dcuStorage.connect(addr2).claimTokens(utils.parseEther("50"));

      const claimableBalance = await dcuStorage.getClaimableBalance(
        addr2.address
      );
      expect(claimableBalance.toString()).to.equal(
        utils.parseEther("50").toString()
      );

      const totalClaimable = await dcuStorage.totalClaimable();
      expect(totalClaimable.toString()).to.equal(
        utils.parseEther("50").toString()
      );

      const tokenBalance = await dcuStorage.balanceOf(addr2.address);
      expect(tokenBalance.toString()).to.equal(
        utils.parseEther("50").toString()
      );
    });

    it("Should allow whitelisted addresses to claim tokens before TGE", async function () {
      await dcuStorage
        .connect(addr1)
        .addClaimableBalance(addr2.address, utils.parseEther("100"));
      await dcuStorage.addToWhitelist(addr2.address);

      await dcuStorage.connect(addr2).claimTokens(utils.parseEther("50"));

      const claimableBalance = await dcuStorage.getClaimableBalance(
        addr2.address
      );
      expect(claimableBalance.toString()).to.equal(
        utils.parseEther("50").toString()
      );

      const tokenBalance = await dcuStorage.balanceOf(addr2.address);
      expect(tokenBalance.toString()).to.equal(
        utils.parseEther("50").toString()
      );
    });
  });

  describe("Token Transfers", function () {
    beforeEach(async function () {
      // Grant MINTER_ROLE to owner for testing
      await dcuStorage.mint(owner.address, utils.parseEther("1000"));
    });

    it("Should prevent transfers before TGE if not whitelisted", async function () {
      await expect(dcuStorage.transfer(addr1.address, utils.parseEther("100")))
        .to.not.be.rejected; // Owner is whitelisted by default

      await expect(
        dcuStorage
          .connect(addr1)
          .transfer(addr2.address, utils.parseEther("50"))
      ).to.be.rejectedWith("Transfers not allowed before TGE");
    });

    it("Should allow transfers after TGE", async function () {
      await dcuStorage.setTGEStatus(true);
      await dcuStorage.transfer(addr1.address, utils.parseEther("100"));

      await dcuStorage
        .connect(addr1)
        .transfer(addr2.address, utils.parseEther("50"));

      const balance = await dcuStorage.balanceOf(addr2.address);
      expect(balance.toString()).to.equal(utils.parseEther("50").toString());
    });
  });

  describe("Staking and Locking", function () {
    beforeEach(async function () {
      // Mint tokens to addr1 for testing
      await dcuStorage.mint(addr1.address, utils.parseEther("1000"));
      // Set TGE to true for easier testing
      await dcuStorage.setTGEStatus(true);
    });

    it("Should allow users to stake tokens", async function () {
      await dcuStorage.connect(addr1).stake(utils.parseEther("500"));

      const stakedBalance = await dcuStorage.getStakedBalance(addr1.address);
      expect(stakedBalance.toString()).to.equal(
        utils.parseEther("500").toString()
      );

      const userBalance = await dcuStorage.balanceOf(addr1.address);
      expect(userBalance.toString()).to.equal(
        utils.parseEther("500").toString()
      );

      const contractBalance = await dcuStorage.balanceOf(dcuStorage.address);
      expect(contractBalance.toString()).to.equal(
        utils.parseEther("500").toString()
      );
    });

    it("Should allow users to unstake tokens", async function () {
      await dcuStorage.connect(addr1).stake(utils.parseEther("500"));
      await dcuStorage.connect(addr1).unstake(utils.parseEther("200"));

      const stakedBalance = await dcuStorage.getStakedBalance(addr1.address);
      expect(stakedBalance.toString()).to.equal(
        utils.parseEther("300").toString()
      );

      const userBalance = await dcuStorage.balanceOf(addr1.address);
      expect(userBalance.toString()).to.equal(
        utils.parseEther("700").toString()
      );
    });

    it("Should allow users to lock tokens", async function () {
      const oneWeek = 7 * 24 * 60 * 60; // 1 week in seconds

      await dcuStorage
        .connect(addr1)
        .lockTokens(utils.parseEther("300"), oneWeek);

      const [lockedAmount, releaseTime] = await dcuStorage.getLockedBalance(
        addr1.address
      );
      expect(lockedAmount.toString()).to.equal(
        utils.parseEther("300").toString()
      );

      const userBalance = await dcuStorage.balanceOf(addr1.address);
      expect(userBalance.toString()).to.equal(
        utils.parseEther("700").toString()
      );
    });

    it("Should prevent unlocking tokens before release time", async function () {
      const oneWeek = 7 * 24 * 60 * 60; // 1 week in seconds

      await dcuStorage
        .connect(addr1)
        .lockTokens(utils.parseEther("300"), oneWeek);

      await expect(dcuStorage.connect(addr1).unlockTokens()).to.be.rejectedWith(
        "Tokens still locked"
      );
    });
  });

  describe("Governance", function () {
    it("Should allow updating governance address", async function () {
      await dcuStorage.updateGovernance(addr1.address);

      const GOVERNANCE_ROLE = await dcuStorage.GOVERNANCE_ROLE();
      expect(await dcuStorage.hasRole(GOVERNANCE_ROLE, addr1.address)).to.equal(
        true
      );
      expect(await dcuStorage.hasRole(GOVERNANCE_ROLE, owner.address)).to.equal(
        false
      );
    });

    it("Should allow setting staking contract", async function () {
      await dcuStorage.setStakingContract(addr1.address);

      const STAKING_ROLE = await dcuStorage.STAKING_ROLE();
      expect(await dcuStorage.hasRole(STAKING_ROLE, addr1.address)).to.equal(
        true
      );
    });

    it("Should allow setting reward manager", async function () {
      await dcuStorage.setRewardManager(addr1.address);

      const REWARD_MANAGER_ROLE = await dcuStorage.REWARD_MANAGER_ROLE();
      expect(
        await dcuStorage.hasRole(REWARD_MANAGER_ROLE, addr1.address)
      ).to.equal(true);
    });
  });
});
