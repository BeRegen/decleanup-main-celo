// Gas comparison script to demonstrate savings from storage optimization
import { ethers } from "hardhat";
import { TransactionReceipt } from "@ethersproject/abstract-provider";

async function main(): Promise<void> {
  console.log("Comparing gas costs before and after storage optimization...");
  console.log("=========================================================");

  // Deploy ImpactProductNFT and DCURewardManager contracts
  console.log("Deploying contracts...");

  // Get signers
  const [owner, user1] = await ethers.getSigners();

  // Deploy optimized contracts
  const DCUToken = await ethers.getContractFactory("DCUToken");
  const maxSupply = ethers.utils.parseEther("1000000"); // 1M tokens
  const dcuToken = await DCUToken.deploy(owner.address, maxSupply);

  const ImpactProductNFT = await ethers.getContractFactory("ImpactProductNFT");
  const impactProductNFT = await ImpactProductNFT.deploy();

  const RewardManager = await ethers.getContractFactory("DCURewardManager");
  const rewardManager = await RewardManager.deploy(dcuToken.address);

  // Setup contracts
  await dcuToken.updateRewardLogicContract(rewardManager.address);
  await impactProductNFT.setRewardsContract(rewardManager.address);

  // Measure deployment costs
  const impactProductNFTDeploymentGas = (await ethers.provider.getTransactionReceipt(
    impactProductNFT.deployTransaction.hash
  )) as TransactionReceipt;

  const rewardManagerDeploymentGas =
    (await ethers.provider.getTransactionReceipt(
      rewardManager.deployTransaction.hash
    )) as TransactionReceipt;

  console.log("Deployment gas costs:");
  console.log(`ImpactProductNFT: ${impactProductNFTDeploymentGas.gasUsed.toString()} gas units`);
  console.log(
    `DCURewardManager: ${rewardManagerDeploymentGas.gasUsed.toString()} gas units`
  );
  console.log("=========================================================");

  // Measure function call gas costs
  console.log("Function call gas costs:");

  // Verify a user
  const verifyPoiTx = await impactProductNFT.verifyPOI(user1.address);
  const verifyPoiReceipt = await verifyPoiTx.wait();
  console.log(`verifyPOI: ${verifyPoiReceipt.gasUsed.toString()} gas units`);

  // Set PoI verification status in reward manager
  const setPoiTx = await rewardManager.setPoiVerificationStatus(
    user1.address,
    true
  );
  const setPoiReceipt = await setPoiTx.wait();
  console.log(
    `setPoiVerificationStatus: ${setPoiReceipt.gasUsed.toString()} gas units`
  );

  // Mint an NFT
  const mintTx = await impactProductNFT.connect(user1).safeMint();
  const mintReceipt = await mintTx.wait();
  console.log(`safeMint: ${mintReceipt.gasUsed.toString()} gas units`);

  // Update impact level
  const updateImpactLevelTx = await impactProductNFT.updateImpactLevel(0, 5);
  const updateImpactLevelReceipt = await updateImpactLevelTx.wait();
  console.log(
    `updateImpactLevel: ${updateImpactLevelReceipt.gasUsed.toString()} gas units`
  );

  // Reward an impact product claim
  const rewardTx = await rewardManager.rewardImpactProductClaim(
    user1.address,
    1
  );
  const rewardReceipt = await rewardTx.wait();
  console.log(
    `rewardImpactProductClaim: ${rewardReceipt.gasUsed.toString()} gas units`
  );

  console.log("=========================================================");

  console.log(
    "Note: To compare with pre-optimization costs, run this script on the original contracts"
  );
  console.log("and compare the gas usage values manually.");
  console.log(
    "The storage-optimized version should show lower gas costs, especially for deployment"
  );
  console.log("and state-changing operations.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
