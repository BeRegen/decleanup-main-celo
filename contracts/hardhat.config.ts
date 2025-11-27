import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-viem";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000000";

// Arbitrum networks (original)
const ARBITRUM_ONE_RPC_URL = process.env.ARBITRUM_ONE_RPC_URL || "";
const ARBITRUM_SEPOLIA_RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC_URL || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || "";

// Celo networks
const CELO_RPC_URL = process.env.CELO_RPC_URL || "https://forno.celo.org";
const CELO_ALFAJORES_RPC_URL = process.env.CELO_ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org";
const CELOSCAN_API_KEY = process.env.CELOSCAN_API_KEY || "";

const config = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 2000,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    // Arbitrum networks (original)
    arbitrum: {
      url: ARBITRUM_ONE_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 42161,
    },
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 421614,
    },
    // Celo networks
    celo: {
      url: CELO_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 42220,
    },
    celoAlfajores: {
      url: CELO_ALFAJORES_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 44787,
    },
    celoSepolia: {
      url: process.env.CELO_SEPOLIA_RPC_URL || "https://alfajores-forno.celo-testnet.org",
      accounts: [PRIVATE_KEY],
      chainId: 11142220,
    },
  },
  etherscan: {
    apiKey: {
      // Arbitrum
      arbitrum: ARBISCAN_API_KEY,
      arbitrumSepolia: ARBISCAN_API_KEY,
      // Celo
      celo: CELOSCAN_API_KEY,
      celoAlfajores: CELOSCAN_API_KEY,
      celoSepolia: CELOSCAN_API_KEY,
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/",
        },
      },
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io/",
        },
      },
      {
        network: "celoAlfajores",
        chainId: 44787,
        urls: {
          apiURL: "https://api-alfajores.celoscan.io/api",
          browserURL: "https://alfajores.celoscan.io/",
        },
      },
      {
        network: "celoSepolia",
        chainId: 11142220,
        urls: {
          apiURL: "https://api-sepolia.celoscan.io/api",
          browserURL: "https://celo-sepolia.blockscout.com/",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
    externalArtifacts: ["externalArtifacts/*.json"],
    dontOverrideCompile: false,
  },
} as const;

export default config;
