# Changelog

All notable changes to this project will be documented in this file.

This project adheres to Semantic Versioning.

---

## [0.2.0] – 2025-12-02  
🚀 Major Refactor: Unified Reward System

This release removes the legacy reward engine, consolidates all reward logic under DCURewardManager, and updates the entire test suite to reflect the new architecture.

### Removed

- RewardLogic.sol  
  Fully removed from the codebase  
  All imports, references, and test files deleted

- Deprecated functions in Submission.sol:  
  - claimRewards  
  - claimableRewards  
  - getClaimableRewards  
  - RewardClaimed event

- Legacy reward pathways across contracts and tests  
- Unused or outdated deployment scripts related to RewardLogic

### Added

- New external function in DCURewardManager:  
  `distributeRewards(submissionId, user)`  
  Centralizes reward minting and distribution

- New RewardSource.Submission enum entry  
- Constructor-based role setup for DCUToken (MINTER_ROLE)  
- Test utilities supporting the new unified reward flow

### Changed — Contracts

**Submission.sol**
- Fully migrated to use DCURewardManager
- Removed internal reward-tracking state
- Updated events and state transitions

**DCURewardManager.sol**
- Centralized all reward logic (submission, referral, verifier, impact reports)
- Single source of truth for reward calculations

**DCUToken.sol**
- Removed legacy mint logic
- Cleaned constructor
- Added MINTER_ROLE for RewardManager

**ImpactProductNFT.sol**
- Minting flow aligned with unified reward system

### Deployment

**contracts/ignition/modules/DCUContracts.ts**
- Removed RewardLogic deployment
- Updated wiring and constructor params
- Consistent role assignments

### Tests

- Full test suite migrated to viem
- Updated mocks, addresses, event assertions
- All tests passing with unified reward architecture

### Security & Architecture

- All minting centralized under DCURewardManager
- Removed duplicate mint paths
- Reduced attack surface
- Improved auditability and predictability

---

## [Unreleased] – Sprint 1 Progress

### 🔧 Core Contract Fixes & Improvements
- Correct reward distribution for approved submissions
- Fully operational impact-report and recyclables reward paths
- Stable Submission → RewardManager → DCUToken integration
- Fixed userImpactFormCount tracking
- Corrected Hypercert eligibility logic
- Event reorganization for clarity

### 🪪 Roles & Access Control
- Strict separation between ADMIN_ROLE and VERIFIER_ROLE
- MAIN_DEPLOYER owns Submission and admin roles
- DCURewardManager granted MINTER_ROLE
- setup-roles.ts improved with validation and syncing

### 📦 Deployment & Ignition
- Ignition modules updated to deploy:
  - DCUToken
  - DCURewardManager
  - Submission
  - ImpactProductNFT
  - DCUStorage
  - DCUAccounting
- Automatic role grants during deployment
- Export of deployed addresses to deployed_addresses.json

### 🛠 Scripts
- setup-roles.ts updated to:
  - Sync ownership
  - Grant core roles
  - Validate configuration

---

## [Sprint 1 – Backend Stabilization] – 2025-12-10

### Added
- Referral reward variable fully implemented
- VERIFIER_ROLE enforcement fixed
- Hypercert eligibility based on ImpactProductNFT level
- New end-to-end reward tests

### Changed
- setup-roles.ts assigns:
  - VERIFIER_ROLE only to verifiers
  - ADMIN_ROLE only to deployer
- Submission approval flow stabilized

### Fixed
- Recyclables reward path
- Removal of all fee logic
- Reward consistency across all flows

### Removed
- Legacy submission fee logic
- Hardcoded referral reward branches
- Cleanup-count-based eligibility checks

### Security
- Only RewardManager may mint
- Submission has no privileged mint paths
- Single source of truth for eligibility

---

## Frontend – MVP Stabilization & Build Fixes (2025-12-13)

This phase focused on stabilizing the frontend, unblocking the build, and aligning UI behavior with the current contract surface and MVP scope.

### General
- Frontend builds cleanly with strict TypeScript enabled
- All blockchain interactions aligned with current contracts or explicit MVP stubs
- No partially enabled or broken features remain

### Blockchain Layer (Frontend)
- Removed assumption of a single contracts index
- Standardized imports under lib/blockchain/*
- Introduced explicit MVP stubs with predictable returns
- Removed non-existent exports and broken references
- Unified getCleanupDetails return shape across app

### Cleanup & Verification Flow
- Enforced single active cleanup per user in the UI
- Cleanup submission lock enforced:
  Submit → locked → verify → claim → unlock
- Verification relies on getCleanupDetails + localStorage
- Removed duplicated status helpers and redeclared symbols
- Verifier approve/reject flow stabilized and aligned with Submission

### Profile
- Fixed bigint vs number mismatches
- tokenId optional and nullable (MVP-safe)
- Graceful fallback for metadata and images
- Staking, streak, and level logic aligned with stubs

### Leaderboard
- Corrected cleanup ownership (submitter → user)
- Normalized DCU balances for sorting
- Limited scan range for safety
- Optional and resilient geolocation enrichment

### Utilities & Debug
- Fixed find-cleanup utility
- Scoped helpers to configured contract addresses
- Improved error handling

### Hypercerts (MVP Scope)
- Image generation utilities exist but are disabled
- CleanupData import assumptions corrected
- Ensured IPFS uploads use File objects
- Hypercert minting remains experimental

### Result
- Clean build
- Clear MVP scope
- Predictable UI flows
- Ready for deploy and iteration

