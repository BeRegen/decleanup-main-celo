import { HardhatRuntimeEnvironment } from "hardhat/types";
import hardhat from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Access ethers from the hardhat runtime environment
  const { ethers } = hardhat as any;

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get current balances
  const balance = await deployer.getBalance();
  console.log("Account balance:", ethers.utils.formatEther(balance));

  // Deploy DCUToken first
  console.log("Deploying DCUToken...");
  const DCUToken = await ethers.getContractFactory("DCUToken");
  const dcuToken = await DCUToken.deploy(deployer.address);
  await dcuToken.deployed();
  const dcuTokenAddress = dcuToken.address;
  console.log("DCUToken deployed to:", dcuTokenAddress);

  // Deploy RewardLogic
  console.log("Deploying RewardLogic...");
  const RewardLogic = await ethers.getContractFactory("RewardLogic");
  const rewardLogic = await RewardLogic.deploy(
    dcuTokenAddress,
    ethers.constants.AddressZero // No NFT collection initially
  );
  await rewardLogic.deployed();
  const rewardLogicAddress = rewardLogic.address;
  console.log("RewardLogic deployed to:", rewardLogicAddress);

  // Update reward logic contract in DCUToken
  console.log("Updating RewardLogic address in DCUToken...");
  await dcuToken.updateRewardLogicContract(rewardLogicAddress);
  console.log("RewardLogic address updated in DCUToken.");

  // Deploy DCUAccounting
  console.log("Deploying DCUAccounting...");
  const DCUAccounting = await ethers.getContractFactory("DCUAccounting");
  const dcuAccounting = await DCUAccounting.deploy(dcuTokenAddress);
  await dcuAccounting.deployed();
  const dcuAccountingAddress = dcuAccounting.address;
  console.log("DCUAccounting deployed to:", dcuAccountingAddress);

  // Deploy DCUStorage
  console.log("Deploying DCUStorage...");
  const DCUStorage = await ethers.getContractFactory("DCUStorage");
  const dcuStorage = await DCUStorage.deploy();
  await dcuStorage.deployed();
  const dcuStorageAddress = dcuStorage.address;
  console.log("DCUStorage deployed to:", dcuStorageAddress);

  // Deploy DCURewardManager without initializing the NFT collection reference
  console.log("Deploying DCURewardManager...");
  const DCURewardManager = await ethers.getContractFactory("DCURewardManager");
  const dcuRewardManager = await DCURewardManager.deploy(
    dcuTokenAddress,
    ethers.constants.AddressZero // No NFT collection initially
  );
  await dcuRewardManager.deployed();
  const dcuRewardManagerAddress = dcuRewardManager.address;
  console.log("DCURewardManager deployed to:", dcuRewardManagerAddress);

  // Deploy NFTCollection
  console.log("Deploying NFTCollection...");
  const NFTCollection = await ethers.getContractFactory("NFTCollection");
  const nftCollection = await NFTCollection.deploy();
  await nftCollection.deployed();
  const nftCollectionAddress = nftCollection.address;
  console.log("NFTCollection deployed to:", nftCollectionAddress);

  // Deploy ImpactProductNFT with the reward manager address
  console.log("Deploying ImpactProductNFT...");
  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactProductNFT = await ImpactProductNFT.deploy(dcuRewardManagerAddress);
  await impactProductNFT.deployed();
  const impactProductNFTAddress = impactProductNFT.address;
  console.log("ImpactProductNFT deployed to:", impactProductNFTAddress);

  // Deploy Submission contract
  console.log("Deploying Submission...");
  const Submission = await ethers.getContractFactory("Submission");
  const submission = await Submission.deploy(
    dcuTokenAddress,
    rewardLogicAddress,
    ethers.utils.parseEther("10") // Default reward amount: 10 DCU
  );
  await submission.deployed();
  const submissionAddress = submission.address;
  console.log("Submission deployed to:", submissionAddress);

  // Update NFT collection references in both contracts
  console.log("Updating NFT collection in RewardLogic...");
  await rewardLogic.setNFTCollection(impactProductNFTAddress);
  console.log("NFT collection updated in RewardLogic.");

  console.log("Updating NFT collection in DCURewardManager...");
  await dcuRewardManager.updateNftCollection(impactProductNFTAddress);
  console.log("NFT collection updated in DCURewardManager.");

  // Save deployed contract addresses
  const deployedAddresses = {
    DCUToken: dcuTokenAddress,
    RewardLogic: rewardLogicAddress,
    DCUAccounting: dcuAccountingAddress,
    DCUStorage: dcuStorageAddress,
    DCURewardManager: dcuRewardManagerAddress,
    ImpactProductNFT: impactProductNFTAddress,
    NFTCollection: nftCollectionAddress,
    Submission: submissionAddress,
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
  };

  const deploymentsPath = path.join(__dirname, "deployed_addresses.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployedAddresses, null, 2));
  console.log("Deployed addresses saved to:", deploymentsPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
