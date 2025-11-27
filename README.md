# decleanup-main-celo

DeCleanup Network’s Celo-native stack for turning verified cleanups into onchain **Impact Products**, **Hypercerts**, and token rewards.  
This repo brings the polished dashboard/profile experience together with the Solidity contracts that tokenize impact and distribute $DCU / cRECY incentives.

## What’s ready

- **Frontend rebuild** – Next.js 16 + shadcn UI with compact dashboard layout, verifier cabinet entry point, leaderboard link, and CTA flow tuned for tablets/desktop. We still plan to adjust spacing + cards based on live feedback, but all critical components (stats, Impact Product, actions, invites, verifier tools) are wired up.
- **Hypercert pipeline** – After every 10 verified cleanups the app aggregates impact reports, generates logo/banner/collage assets, uploads metadata to IPFS, mints the Hypercert via `@hypercerts-org/sdk`, and calls `claimHypercertReward` (10 $DCU bonus). Robust error handling + retryable IPFS fetches are in place.
- **Impact + recyclables reporting** – Cleanup flow now adds the Farcaster mini-app’s impact form (weight/area/time/waste types) and an optional recyclables step (photo + receipt hash). On approval, `Submission.sol` triggers `RecyclablesReward.rewardRecyclables` (up to 5000 cRECY cap) and `rewardImpactReports`.
- **Contracts deployment-ready** – `Submission`, `DCURewardManager`, `RecyclablesReward`, `ImpactProductNFT`, `RewardLogic`, and `DCUToken` were refactored for the Celo treasury addresses, role setup script, hypercert eligibility checks, and verifier incentives. `DCUContracts.ts` now injects the reward manager address correctly.

## Repo layout

```
contracts/      # Hardhat project (Solidity, tests, Ignition module, scripts)
frontend/       # Next.js 16 app, wagmi config, dashboard/profile/cleanup flows
docs/           # High-level docs for architecture, hypercerts, deployment
+ README.md     # You are here
```

## Local setup

```bash
# install deps
cd frontend && npm install
cd ../contracts && npm install

# run web app
cd ../frontend && npm run dev  # http://localhost:3000

# run hardhat tests
cd ../contracts && npx hardhat test
```

### Environment variables

Copy `frontend/ENV_TEMPLATE.md` → `.env.local` and fill the values (Chain ID, RPCs, WalletConnect ID, contract addresses, Pinata keys, Hypercerts network).  
For contracts, create `contracts/.env` with your RPC + explorer keys if you plan to verify on CeloScan.

## Deployment status

- ✅ Contracts audited for reentrancy/access control (see `docs/system-architecture.md` + `CONTRACT_SECURITY_REVIEW.md`)
- ✅ `scripts/setup-roles.ts` assigns treasury + verifier/admin roles (community wallet cRECY reserve, main deployer, verifier)
- ✅ Frontend wired to new ABIs (attach recyclables, hypercert eligibility, reward claiming)
- ⏳ Remaining UI TODO: tighten the dashboard spacing and verify breakpoints once live data flows in

## Docs

| Doc | Purpose |
| --- | ------- |
| `docs/system-architecture.md` | End-to-end diagram of frontend/client, contracts, IPFS + Hypercerts interactions |
| `docs/hypercerts-and-impact.md` | How aggregated impact reports & photos become Hypercerts + rewards |
| `docs/recyclables-module.md` | cRECY reserve requirements, Submission hook, reserve sync checklist |
| `docs/deployment-plan.md` | One-pager for final deployment steps and env requirements |

> Note: Legacy Farcaster/Base docs were removed; this repo only tracks the Celo deployment path.

## Initial commit message (suggested)

```
chore: bootstrap decleanup-main-celo

- add tightened dashboard/profile layout and verifier entry points
- wire hypercert minting flow (impact data aggregation, IPFS assets, reward claim)
- integrate recyclables + impact-form steps into cleanup UX
- document system architecture, deployment plan, and hypercert pipeline
- prep contracts + scripts for Celo deployment (treasury, roles, hypercert rewards)
```

Happy cleaning 🌍

Full V2 of DeCleanup Rewards app on Celo, including expanded impact reporting, Hypercerts, leaderboard, and recyclables submission.
