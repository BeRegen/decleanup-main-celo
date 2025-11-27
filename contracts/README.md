# 🚀 DeCleanup Network – Smart Contracts Repository  

![Test and Coverage](https://github.com/DeCleanup/contracts/workflows/Test%20and%20Coverage/badge.svg)

## 🔹 Overview  
This repository contains the **smart contract infrastructure for DeCleanup Network**, responsible for:  
✅ **Minting & upgrading Dynamic Impact Products (dIP NFTs).**  
✅ **Tracking & storing Impact Value (IV) and level progression.**  
✅ **Managing $DCU rewards for Impact Product claims, streaks, and referrals.**  
✅ **$DCU ERC-20 Token Contract with claim restrictions pre-TGE.**  
✅ **Preparing for decentralized verification and governance elements in future phases.**  

To ensure **scalability and upgradeability**, the system is structured with **four modular contracts**:  
1️⃣ **Dynamic Impact Product (dIP NFT Contract)** – Handles **minting, metadata updates, and level progression tracking**.  
2️⃣ **$DCU Reward & Accounting Contract** – Stores **$DCU balances until users can claim them as tokens post-TGE**.  
3️⃣ **Reward Logic Contract** – Manages **PoI verification, reward calculations, and staking mechanics** (future expansion).  
4️⃣ **$DCU Token Contract (ERC-20)** – Implements **$DCU with upgradeable staking & governance support**.

---

## 🛠 Tech Stack  
- **Smart Contract Language:** Solidity  
- **Frameworks:** Hardhat, Foundry  
- **Standards Used:** OpenZeppelin (ERC-721 for NFTs, ERC-20 for $DCU)  
- **Blockchain Tools:** viem, wagmi, The Graph (indexing)  
- **Storage:** IPFS (for metadata storage)  

---

## 📌 Phase 1 – Current Development Focus  
✅ **Dynamic Impact Product (dIP) Contract** – Minting & upgrading ERC-721 NFTs.  
✅ **$DCU Reward Tracking Contract** – Storing earned $DCU until post-TGE claims are enabled.  
✅ **Reward Logic Contract** – Processing PoI claims, streaks, and referral bonuses.  
✅ **$DCU Token Contract (ERC-20)** – **Pre-TGE implementation with restricted transfers**.  
✅ **Onchain Events for Indexing** – Emitting blockchain events for leaderboard & impact tracking.  
✅ **Gas Optimization** – Reducing transaction costs for reward distribution.  

---

## 🔄 Phase 2 – Decentralization & Expansion  
🔹 **Decentralized Verification** – Smart contract-based PoI validation by verifiers.  
🔹 **Impact Circles & Group Cleanups** – Collaborative cleanups built on separate smart contracts with multipliers.  
🔹 **Staking & Locking** – Lock $DCU for verifier roles.  

---

## 🚀 Phase 3 – Scaling & Governance  
🌍 **Cross-Chain Deployment** – Expanding to L2s like Optimism, Arbitrum, and Supra.   
🏛 **Governance** – Community-driven reward system scaling.  
📊 **Advanced Analytics & Impact Tracking** – Smart contracts interacting with indexing tools.  

---

## ⚡ Scalability Considerations  
✅ **Modular Contract Architecture** – Allows upgrades without affecting core functionality.  
✅ **Efficient Gas Usage** – Optimized transactions for NFT minting, reward claims, and level upgrades.  
✅ **Event-Driven System** – Uses onchain events for indexers and leaderboard updates.  
✅ **Future-Ready Claim System** – $DCU is **tracked in the system until post-TGE**, when it will be claimable as tokens.  

---

## 🏗 Contributor Guidelines  
- Start with **Phase 1 issues** before working on staking, governance, or verification logic.  
- **Keep contract logic modular** to ensure easy upgradeability in future phases.  
- **Optimize gas usage** when handling NFT upgrades and reward claims.  
- Discuss **contract changes in GitHub Issues** before submitting PRs.  

## 🧪 Testing and Coverage

### Running Tests
To run the test suite:
```bash
npm test
```

To run tests for a specific contract:
```bash
npx hardhat test test/ImpactProductNFT.test.ts
```

### Test Coverage
To generate a test coverage report:
```bash
SOLIDITY_COVERAGE=true npm run test:coverage
```

This will generate a detailed coverage report in the `coverage/` directory and display a summary in the console.

Our coverage requirements:
- Statements: 85%
- Branches: 60%
- Functions: 80%
- Lines: 85%

### Continuous Integration
We use GitHub Actions to automatically run tests and check coverage on pull requests and pushes to the master branch. Pull requests that don't meet the minimum coverage thresholds will be flagged and blocked from merging.

## 🚨 Error Handling

We use a standardized error handling approach across all contracts to improve gas efficiency, provide better error information, and ensure a consistent user experience:

### Custom Error Format
All errors follow the naming convention `CONTRACT__ErrorType(parameters)` where:
- `CONTRACT` indicates which contract the error originated from (e.g., `NFT`, `REWARD`, `TOKEN`)
- `ErrorType` is a descriptive name of the error
- `parameters` provide relevant context information for debugging

### Benefits
- **Gas Efficiency**: Custom errors consume less gas than string-based error messages
- **Better Developer Experience**: Structured errors with parameters provide better context
- **Improved User Experience**: Frontend applications can parse errors and display meaningful messages
- **Code Maintainability**: Consistent error handling approach across contracts

For a complete list of error codes, see the [ERROR_CODES.md](./docs/ERROR_CODES.md) documentation file.
