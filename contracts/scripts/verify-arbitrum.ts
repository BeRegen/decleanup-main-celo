import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Read deployed addresses from deployment file
const deployedAddressesPath = path.join(__dirname, "deployed_addresses.json");

async function main() {
  console.log("Starting contract verification on Arbitrum...");
  console.log("\nBefore running verification, please ensure:");
  console.log("1. You have set ARBISCAN_API_KEY in your .env file");
  console.log(
    "2. The hardhat.config.ts file has etherscan configuration for Arbitrum\n"
  );

  // Check if the deployment file exists
  if (!fs.existsSync(deployedAddressesPath)) {
    console.error(`Deployment file not found at ${deployedAddressesPath}`);
    console.error(
      "Please run deploy:arbitrum or deploy:arbitrum-testnet first"
    );
    process.exit(1);
  }

  const deployedAddresses = JSON.parse(
    fs.readFileSync(deployedAddressesPath, "utf8")
  );

  console.log("Using addresses from deployment file:", deployedAddressesPath);
  console.log(deployedAddresses);

  // Verify DCUToken
  console.log("\nVerifying DCUToken...");
  try {
    await run("verify:verify", {
      address: deployedAddresses.DCUToken,
      constructorArguments: [
        deployedAddresses.deployer ||
          deployedAddresses.RewardLogic ||
          "0x0000000000000000000000000000000000000000",
      ],
    });
    console.log("✅ DCUToken verified successfully!");
  } catch (error: any) {
    handleVerificationError("DCUToken", error);
  }

  // Verify RewardLogic
  console.log("\nVerifying RewardLogic...");
  try {
    await run("verify:verify", {
      address: deployedAddresses.RewardLogic,
      constructorArguments: [
        deployedAddresses.DCUToken,
        deployedAddresses.ImpactProductNFT ||
          "0x0000000000000000000000000000000000000000",
      ],
    });
    console.log("✅ RewardLogic verified successfully!");
  } catch (error: any) {
    handleVerificationError("RewardLogic", error);
  }

  // Verify DCUAccounting
  console.log("\nVerifying DCUAccounting...");
  try {
    await run("verify:verify", {
      address: deployedAddresses.DCUAccounting,
      constructorArguments: [deployedAddresses.DCUToken],
    });
    console.log("✅ DCUAccounting verified successfully!");
  } catch (error: any) {
    handleVerificationError("DCUAccounting", error);
  }

  // Verify DCUStorage (no constructor args)
  console.log("\nVerifying DCUStorage...");
  try {
    await run("verify:verify", {
      address: deployedAddresses.DCUStorage,
      constructorArguments: [],
    });
    console.log("✅ DCUStorage verified successfully!");
  } catch (error: any) {
    handleVerificationError("DCUStorage", error);
  }

  // Verify DCURewardManager
  console.log("\nVerifying DCURewardManager...");
  try {
    await run("verify:verify", {
      address: deployedAddresses.DCURewardManager,
      constructorArguments: [
        deployedAddresses.DCUToken,
        deployedAddresses.ImpactProductNFT ||
          "0x0000000000000000000000000000000000000000",
      ],
    });
    console.log("✅ DCURewardManager verified successfully!");
  } catch (error: any) {
    handleVerificationError("DCURewardManager", error);
  }

  // Verify ImpactProductNFT
  console.log("\nVerifying ImpactProductNFT...");
  try {
    await run("verify:verify", {
      address: deployedAddresses.ImpactProductNFT,
      constructorArguments: [deployedAddresses.DCURewardManager],
    });
    console.log("✅ ImpactProductNFT verified successfully!");
  } catch (error: any) {
    handleVerificationError("ImpactProductNFT", error);
  }

  console.log("\nVerification process completed!");
}

function handleVerificationError(contractName: string, error: any) {
  if (error.message.includes("Already Verified")) {
    console.log(`✅ ${contractName} already verified!`);
  } else {
    console.error(`❌ Failed to verify ${contractName}:`, error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
