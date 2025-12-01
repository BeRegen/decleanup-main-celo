# DeCleanup Network - Project Status Report
**Date:** 2025-01-XX  
**Prepared for:** Token + Mainnet Launch Preparation

---

## 📋 Table of Contents
1. [Current Contract Files](#current-contract-files)
2. [Known Issues & Expected vs Actual Behavior](#known-issues)
3. [Testing Flow](#testing-flow)
4. [Deployment Information](#deployment-information)
5. [Frontend Errors & Issues](#frontend-errors)
6. [Sprint Plan](#sprint-plan)

---

## 📁 Current Contract Files

### Core Contracts

#### 1. **Submission.sol** (`contracts/contracts/Submission.sol`)
- **Purpose:** Main contract for cleanup submissions, verification, and Impact Product claims
- **Key Features:**
  - Cleanup submission with photos, location, impact reports, recyclables
  - Verifier approval/rejection (uses `VERIFIER_ROLE`)
  - Impact Product claim (mints/upgrades NFT, gives 10 $cDCU, referral rewards)
  - Hypercert submission for admin review
  - Fee management (submission fee: 0.01 CELO, claim fee: 0.01 CELO)
  - Referral tracking
- **Roles:**
  - `DEFAULT_ADMIN_ROLE`: Full admin (hypercert approval, fee config)
  - `VERIFIER_ROLE`: Can approve/reject cleanups only
  - `ADMIN_ROLE`: Legacy role (should be migrated to VERIFIER_ROLE)
- **Status:** ✅ Recently updated with hypercert submission flow and role separation

#### 2. **DCURewardManager.sol** (`contracts/contracts/DCURewardManager.sol`)
- **Purpose:** Main reward accrual and distribution system
- **Key Features:**
  - Stores rewards in `userBalances` mapping (points/storage before token launch)
  - Mints actual $cDCU tokens when user calls `claimRewards()`
  - Impact Product claim reward: 10 $cDCU
  - Referral rewards: 3 $cDCU each (referrer + referred)
  - Verifier rewards: 1 $cDCU per verification
  - Impact report rewards: 5 $cDCU per form
  - Hypercert bonus: 10 $cDCU (when hypercert is minted)
  - Streak rewards: 3 $cDCU (if implemented)
- **How it works:** 
  - Before token launch: Stores rewards as points (signals to frontend)
  - After token launch: Mints actual tokens when user claims
- **Status:** ✅ Functional, but needs audit for token launch

#### 3. **DCUToken.sol** (`contracts/contracts/tokens/DCUToken.sol`)
- **Purpose:** ERC20 token for $cDCU rewards
- **Status:** ⚠️ Needs review for mainnet deployment

#### 4. **ImpactProductNFT.sol** (`contracts/contracts/tokens/ImpactProductNFT.sol`)
- **Purpose:** ERC721 NFT that levels up (1-10) based on cleanups
- **Key Features:**
  - Transferable (NOT soulbound)
  - Levels up one by one (no skipping)
  - POI verification required before claiming
- **Status:** ✅ Functional

#### 5. **RecyclablesReward.sol** (`contracts/contracts/RecyclablesReward.sol`)
- **Purpose:** Separate contract for cRECY token rewards
- **Key Features:**
  - Fixed reward: 5 cRECY per submission
  - Cap: 5000 cRECY total reserve
  - Can be easily removed when promotion ends
- **Deployed Address:** `0xa8BfaF990bEA1d471CBE408Ee74e3Fa6700259a3`
- **Token Address:** `0x34C11A932853Ae24E845Ad4B633E3cEf91afE583`
- **Status:** ✅ Deployed and linked

#### 6. **DCUStorage.sol** (`contracts/contracts/DCUStorage.sol`)
- **Purpose:** Storage contract for data management
- **Status:** ✅ Functional

#### 7. **DCUAccounting.sol** (`contracts/contracts/DCUAccounting.sol`)
- **Purpose:** Manages $cDCU token deposits and withdrawals with TGE restrictions
- **Key Features:**
  - Users deposit/withdraw existing tokens (not for rewards)
  - Handles TGE (Token Generation Event) restrictions
  - Whitelist management for pre-TGE transfers
- **Status:** ✅ Functional - Different purpose, not redundant

#### 8. **RewardLogic.sol** (`contracts/contracts/RewardLogic.sol`)
- **Purpose:** Legacy reward distribution contract
- **Key Features:**
  - Mints tokens directly (no storage/accrual)
  - Only used in `Submission.claimRewards()` function
- **Status:** ⚠️ **REDUNDANT** - Should be removed/consolidated into DCURewardManager
- **Issue:** Overlaps with DCURewardManager functionality

---

## 🐛 Known Issues & Expected vs Actual Behavior

### Issue 0: Contract Architecture - Redundant Reward Systems
**Expected:** Single, unified reward system  
**Actual:** 
- **DCURewardManager**: Main reward system - stores rewards as points, mints on claim ✅
- **RewardLogic**: Legacy contract - mints tokens directly, only used in `Submission.claimRewards()` ⚠️
- **Two separate reward flows:**
  1. `Submission.claimRewards()` → `RewardLogic.distributeDCU()` → mints directly
  2. `DCURewardManager.claimRewards()` → mints from stored `userBalances`
**Impact:** High - Confusing architecture, unnecessary contract, maintenance burden  
**Fix Needed:** 
1. **Remove RewardLogic contract** - Consolidate all rewards into DCURewardManager
2. Update `Submission.claimRewards()` to use DCURewardManager instead
3. Or remove `Submission.claimRewards()` entirely if rewards go directly to DCURewardManager
4. Update deployment scripts to remove RewardLogic
5. **Note:** Before token launch, DCURewardManager stores rewards as points (signals to frontend). After launch, it mints actual tokens on claim.

### Issue 0.1: Terminology Inconsistency - DCU vs $cDCU
**Expected:** All contracts use "$cDCU" terminology  
**Actual:** 
- Contracts use "DCU" in comments, events, and documentation
- Should be "$cDCU" for consistency
**Impact:** Medium - Inconsistent branding, confusion about token name  
**Fix Needed:** 
1. Update all contract comments to use "$cDCU" instead of "DCU"
2. Update event names and documentation
3. Update all references in codebase

### Issue 1: Role Separation Not Fully Implemented
**Expected:** Verifiers have `VERIFIER_ROLE`, Admins have `DEFAULT_ADMIN_ROLE`  
**Actual:** 
- Contract has `VERIFIER_ROLE` constant defined ✅
- `approveSubmission()` and `rejectSubmission()` use `VERIFIER_ROLE` ✅
- But `setup-roles.ts` still grants `ADMIN_ROLE` to verifier ❌
- Verifier wallet: `0x7d85fcbb505d48e6176483733b62b51704e0bf95` currently has `ADMIN_ROLE`
**Impact:** Medium - Verifier has admin privileges they shouldn't have  
**Fix Needed:** 
1. Update `setup-roles.ts` to grant `VERIFIER_ROLE` instead of `ADMIN_ROLE`
2. Run setup script to migrate existing verifier role
3. Revoke `ADMIN_ROLE` from verifier wallet

### Issue 2: Hypercert Submission Loading Not Implemented
**Expected:** Admin dashboard shows pending hypercert submissions  
**Actual:** `HypercertReview` component has TODO placeholder  
**Impact:** Low - Feature exists but not connected to contract events  
**Fix Needed:** Implement event listener or query function to load pending submissions

### Issue 3: Hypercert Eligibility Based on Cleanup Count vs Level
**Expected:** Eligibility based on Impact Product level (10, 20, 30, etc.)  
**Actual:** 
- Contract's `getHypercertEligibility()` checks `userCleanupCount % 10 == 0` (based on cleanup count)
- Frontend's `getHypercertEligibility()` checks Impact Product level ✅
- Contract's `submitHypercertForReview()` checks `userHypercertCount >= hypercertNumber` which is based on cleanup count
- **Important:** Frontend enforces that users cannot submit new cleanups until previous cleanup is verified AND Impact Product is claimed ✅ (see `frontend/src/features/cleanup/pages/page.tsx` lines 505-512)
**Impact:** Medium - Users are prevented from submitting more cleanups before claiming (frontend restriction), but contract-level eligibility still uses cleanup count instead of level. If users bypass frontend, they could theoretically be eligible for hypercerts before reaching required levels.  
**Fix Needed:** 
1. Update contract's `getHypercertEligibility()` to check Impact Product level via `impactProductNFT.getUserNFTData()`
2. Update `submitHypercertForReview()` to verify user has reached the required Impact Product level (not just cleanup count)
3. Ensure frontend and contract logic are aligned
4. **Note:** Frontend restriction ensures users must claim each Impact Product before submitting next cleanup, which mitigates the issue but contract should still be fixed for consistency and security

### Issue 4: Referral Reward Logic
**Expected:** 3 $cDCU each for referrer and referred user when Impact Product is claimed  
**Actual:** 
- `claimImpactProduct()` hardcodes `3 ether` in the calls ✅ (not using `referralReward` variable)
- `DCURewardManager.referralReward` is set to `1 ether` (not used in claimImpactProduct, but should be updated for consistency)
- Both referrer and referred user should receive 3 $cDCU ✅
**Impact:** Low - Code hardcodes correct amount, but variable is inconsistent  
**Fix Needed:** 
1. Update `DCURewardManager.referralReward` to `3 ether` for consistency
2. Test referral flow end-to-end to verify both parties receive rewards
3. Consider using the variable instead of hardcoding (or keep hardcoding if intentional)

### Issue 5: Transaction Status Checker
**Expected:** Users can see pending transaction status  
**Actual:** Component exists but may not be integrated everywhere  
**Impact:** Low - UX improvement  
**Fix Needed:** Ensure all contract interactions use the transaction tracker

### Issue 6: Frontend $bDCU vs $cDCU References
**Expected:** All references should be $cDCU  
**Actual:** Some comments or strings might still say $bDCU  
**Impact:** Low - Cosmetic  
**Fix Needed:** Final sweep of all frontend files

### Issue 11: Contract Comments Use "DCU" Instead of "$cDCU"
**Expected:** All contract comments use "$cDCU"  
**Actual:** Contracts use "DCU" in comments (e.g., "10 DCU", "DCU token")  
**Impact:** Medium - Inconsistent branding  
**Fix Needed:** 
1. Search and replace "DCU" with "$cDCU" in all contract files
2. Update event names if needed
3. Update documentation

### Issue 7: Cleanup Submission Lock
**Expected:** Users cannot submit new cleanup until previous is verified AND claimed  
**Actual:** ✅ Implemented in frontend  
**Impact:** None - Working as expected

### Issue 8: Impact Product Claim Fee
**Expected:** 0.01 CELO fee on claim transaction  
**Actual:** ✅ Implemented  
**Impact:** None - Working as expected

### Issue 9: Hypercert Minting Fee
**Expected:** Fee on hypercert minting  
**Actual:** ⚠️ Not yet implemented  
**Impact:** Medium - Revenue opportunity  
**Fix Needed:** Add fee to hypercert minting flow

### Issue 10: Automated Banner/Logo Generation
**Expected:** System generates hypercert banner and logo automatically  
**Actual:** Code exists in `hypercert-image-generator.ts` but may need updates  
**Impact:** Low - UX improvement  
**Fix Needed:** Test and verify image generation works correctly

---

## 🧪 Testing Flow

### Current Testing Steps

1. **Cleanup Submission**
   - User connects wallet
   - Submits cleanup with photos, location
   - Optionally adds impact report and recyclables
   - Pays 0.01 CELO submission fee
   - **Expected:** Transaction succeeds, cleanup shows as pending
   - **Check:** Transaction hash, pending cleanup status

2. **Verifier Approval**
   - Verifier connects wallet (with `VERIFIER_ROLE`)
   - Views pending cleanups in verifier dashboard
   - Reviews cleanup details (photos, impact report, recyclables)
   - Approves cleanup
   - **Expected:** User verified as POI, rewards distributed, cleanup count incremented
   - **Check:** User's POI status, reward balance, cleanup count

3. **Impact Product Claim**
   - User sees "CLAIM LEVEL" button on dashboard
   - Clicks to claim Impact Product
   - Pays 0.01 CELO claim fee
   - **Expected:** NFT minted/upgraded, 10 $cDCU rewarded, referral rewards (3 $cDCU each)
   - **Check:** NFT level, $cDCU balance, referral rewards

4. **Hypercert Submission**
   - User reaches level 10, 20, 30, etc.
   - Sees "CREATE HYPERCERT" button (if eligible)
   - Submits hypercert metadata
   - **Expected:** Submission shows as pending in admin dashboard
   - **Check:** Admin dashboard shows pending submission

5. **Hypercert Approval**
   - Admin reviews hypercert submission
   - Approves or rejects
   - **Expected:** User can mint hypercert after approval
   - **Check:** User sees "MINT HYPERCERT" button after approval

6. **Hypercert Minting**
   - User mints hypercert (after admin approval)
   - **Expected:** Hypercert minted, 10 $cDCU reward claimed
   - **Check:** Hypercert on hypercerts.org, $cDCU balance

### Known Testing Issues

- **Issue:** Hypercert eligibility check may not work correctly
  - **Steps to Reproduce:** Reach level 10, check if hypercert button is active
  - **Expected:** Button active at level 10
  - **Actual:** May not activate correctly

- **Issue:** Transaction status checker may not show all transactions
  - **Steps to Reproduce:** Submit cleanup, check transaction status
  - **Expected:** Transaction shows in status checker
  - **Actual:** May not appear

- **Issue:** Referral rewards may not be distributed
  - **Steps to Reproduce:** Claim Impact Product with referrer set
  - **Expected:** Both referrer and referred get 3 $cDCU
  - **Actual:** Need to verify both receive rewards

---

## 📦 Deployment Information

### Deployed Addresses

**Network:** Celo Sepolia (Chain ID: 11142220)  
**Deployer:** `0x173D87dfa68aEB0E821C6021f5652B9C3a7556b4`  
**Deployed At:** 2025-11-28T14:05:18.001Z  
**Redeployed At:** 2025-11-29T11:25:13.514Z

**Current Deployments:**
- **DCUStorage:** `0x8027dFcFB3643A97f346C2DfB969F1c790EC38a4`
- **DCUAccounting:** `0x71c69249A803eACE55bC11c57bB7Ae6cc671c6C8`
- **NFTCollection:** `0x04d563185f5b43a0ef18151689574B87c0c9A7B4`
- **RewardLogic:** `0xaC121989B5Af3d18946928195484db6cCc56D9D7`
- **DCUToken:** `0x67894Cc350F0d283c4a963817ff8e699bF316aC8`
- **DCURewardManager:** `0x614E993974880e3f9799bd671e61A4f20288923e`
- **ImpactProductNFT:** `0xa1Efb65d0Cb1aF4976fD9687652174020405fcb2`
- **Submission:** `0x18366208f4D27C0C050d6dED267d3763C26Ea5D0` (Current)
- **Old Submission:** `0x396502B9e7C1BD9120a75f7C26072C0cf68cF724` (Deprecated)

**External Contracts:**
- **RecyclablesReward:** `0xa8BfaF990bEA1d471CBE408Ee74e3Fa6700259a3`
- **cRECY Token:** `0x34C11A932853Ae24E845Ad4B633E3cEf91afE583`

**Key Wallets:**
- **Community Wallet (decleanupnet.eth):** `0x173d87dfa68aeb0e821c6021f5652b9c3a7556b4` (Holds 5000 cRECY reserve)
- **Main Deployer/Admin:** `0x520e40e346ea85d72661fce3ba3f81cb2c560d84` (Receives contract fees)
- **Verifier:** `0x7d85fcbb505d48e6176483733b62b51704e0bf95` (Has ADMIN_ROLE - needs migration to VERIFIER_ROLE)

### Deployment Scripts

- **Main Deployment:** `contracts/ignition/modules/DCUContracts.ts`
- **Role Setup:** `contracts/scripts/setup-roles.ts`
- **Recyclables Linking:** `contracts/scripts/link-recyclables-reward.ts`
- **Reward Manager Linking:** `contracts/scripts/link-reward-manager.ts`

### Network Configuration

**Current Network:** Celo Sepolia (testnet)  
**Target Network:** Celo Mainnet

**Frontend Config:** `frontend/src/lib/blockchain/wagmi.ts`
- Check `REQUIRED_CHAIN_ID` and `REQUIRED_CHAIN_NAME`
- Verify RPC endpoints are correct

### Hardhat Configuration

See `contracts/hardhat.config.ts` for:
- Network configurations
- Compiler settings
- Gas optimization settings

---

## 🖥️ Frontend Errors & Issues

### Console Errors (Filtered)

The following errors are suppressed (harmless):
- WalletConnect stale session errors
- IndexedDB connection closing errors

### Known Frontend Issues

1. **Hypercert Review Loading**
   - **File:** `frontend/src/app/admin/page.tsx`
   - **Issue:** `HypercertReview` component doesn't load pending submissions
   - **Fix:** Implement event listener or query function

2. **Transaction Status Integration**
   - **File:** Multiple files
   - **Issue:** Not all contract interactions use transaction tracker
   - **Fix:** Add `window.addTransaction()` calls to all write operations

3. **Chain Switching**
   - **File:** `frontend/src/lib/blockchain/contracts.ts`
   - **Issue:** ✅ Fixed - Now uses `switchChain` from `wagmi/actions`
   - **Status:** Working correctly

4. **Role Checking**
   - **File:** `frontend/src/lib/blockchain/admin.ts`
   - **Issue:** ✅ Fixed - Now uses `VERIFIER_ROLE` and `DEFAULT_ADMIN_ROLE`
   - **Status:** Working correctly

5. **Impact Product Display Refresh**
   - **File:** `frontend/src/app/page.tsx`
   - **Issue:** Dashboard may not refresh immediately after claim
   - **Fix:** Ensure `checkStatus()` is called after transaction confirmation

---

## 🚀 Sprint Plan

### Sprint 1: Fix Testnet Flow & Contract Consolidation
**Goal:** Ensure entire flow works end-to-end on testnet and consolidate contracts

#### Tasks:
1. ✅ Fix role separation (VERIFIER_ROLE vs ADMIN_ROLE)
2. ✅ Implement hypercert submission flow
3. ⚠️ **HIGH PRIORITY:** Remove RewardLogic contract and consolidate into DCURewardManager
4. ⚠️ **HIGH PRIORITY:** Update all contract comments to use "$cDCU" instead of "DCU"
5. ⚠️ Fix hypercert eligibility check (level-based, not cleanup count)
6. ⚠️ Implement hypercert submission loading in admin dashboard
7. ⚠️ Verify referral rewards are distributed correctly
8. ⚠️ Test entire flow: submission → approval → claim → hypercert
9. ⚠️ Fix any transaction status tracking issues
10. ⚠️ Add hypercert minting fee

#### Deliverables:
- Working testnet deployment
- All flows tested and documented
- Known issues list updated

### Sprint 2: Finalize + Audit Token Contract
**Goal:** Prepare DCUToken for mainnet launch

#### Tasks:
1. Review DCUToken.sol for security
2. Add any missing features (pause, upgradeability, etc.)
3. Write comprehensive tests
4. External audit (if needed)
5. Update documentation

#### Deliverables:
- Audited token contract
- Test coverage > 90%
- Deployment scripts ready

### Sprint 3: Mainnet Deployment & Cleanup
**Goal:** Deploy to mainnet and finalize

#### Tasks:
1. Deploy all contracts to Celo Mainnet
2. Set up monitoring and alerts
3. Configure admin roles
4. Test on mainnet (small transactions first)
5. Update frontend to point to mainnet
6. Final documentation

#### Deliverables:
- Live mainnet deployment
- Monitoring dashboard
- User documentation

---

## 📝 Next Steps

1. **Review this document** and confirm accuracy
2. **Test the current testnet deployment** and document any new issues
3. **Prioritize Sprint 1 tasks** based on criticality
4. **Set up testing environment** for systematic testing
5. **Begin Sprint 1** with highest priority fixes

---

## 🔗 Key Files Reference

### Contracts
- `contracts/contracts/Submission.sol` - Main submission contract
- `contracts/contracts/DCURewardManager.sol` - Main reward system (stores points, mints on claim)
- `contracts/contracts/RewardLogic.sol` - ⚠️ **REDUNDANT** - Should be removed
- `contracts/contracts/tokens/DCUToken.sol` - ERC20 token ($cDCU)
- `contracts/contracts/tokens/ImpactProductNFT.sol` - NFT contract
- `contracts/contracts/RecyclablesReward.sol` - Recyclables rewards
- `contracts/contracts/DCUAccounting.sol` - Token deposit/withdrawal system

### Architecture Documentation
- `CONTRACT_ANALYSIS.md` - Detailed contract architecture analysis and recommendations

### Frontend
- `frontend/src/app/page.tsx` - Main dashboard
- `frontend/src/app/admin/page.tsx` - Admin dashboard
- `frontend/src/features/verifier/pages/page.tsx` - Verifier dashboard
- `frontend/src/lib/blockchain/contracts.ts` - Contract interactions
- `frontend/src/lib/blockchain/hypercert-submission.ts` - Hypercert functions

### Scripts
- `contracts/scripts/deployed_addresses.json` - Deployment addresses
- `contracts/scripts/setup-roles.ts` - Role configuration
- `contracts/ignition/modules/DCUContracts.ts` - Main deployment

---

---

## 🔍 Additional Notes

### Contract Configuration
- **DCURewardManager.referralReward:** `1 ether` (variable not used; code hardcodes `3 ether` in `claimImpactProduct`)
- **DCURewardManager.impactProductClaimReward:** `10 ether` ✅ (10 $cDCU)
- **Submission.submissionFee:** `0.01 ether` ✅
- **Submission.claimFee:** `0.01 ether` ✅
- **RecyclablesReward.rewardAmount:** `5 ether` ✅ (5 cRECY)

### Contract Architecture Notes
- **Reward System:** Currently uses DCURewardManager (stores points, mints on claim) + RewardLogic (mints directly) - **NEEDS CONSOLIDATION**
- **Before Token Launch:** DCURewardManager stores rewards as points (signals to frontend for display)
- **After Token Launch:** DCURewardManager will mint actual $cDCU tokens when users claim
- **Redundant Contracts:** RewardLogic should be removed - all rewards should go through DCURewardManager

### Frontend Configuration
- **Network:** Celo Sepolia (Chain ID: 11142220)
- **RPC URL:** From `NEXT_PUBLIC_SEPOLIA_RPC_URL` env var
- **Block Explorer:** CeloScan Sepolia

### Testing Checklist
- [ ] Cleanup submission with photos
- [ ] Cleanup submission with impact report
- [ ] Cleanup submission with recyclables
- [ ] Verifier approval
- [ ] Impact Product claim
- [ ] Referral rewards (both referrer and referred)
- [ ] Hypercert eligibility check
- [ ] Hypercert submission
- [ ] Admin hypercert approval
- [ ] Hypercert minting
- [ ] Fee collection
- [ ] Role separation (verifier vs admin)

---

**Status:** Ready for Sprint 1  
**Last Updated:** 2025-01-XX

---

## 📊 Contract Consolidation Plan

### Current State
- **DCURewardManager**: Main reward system ✅
  - Stores rewards in `userBalances` (points before launch, actual tokens after)
  - Mints tokens on `claimRewards()` call
  - Handles all reward types
  
- **RewardLogic**: Redundant contract ⚠️
  - Only used in `Submission.claimRewards()`
  - Mints tokens directly (no storage)
  - Should be removed

### Migration Steps
1. **Update Submission.sol:**
   - Remove `rewardLogic` reference
   - Update `claimRewards()` to use `DCURewardManager` instead
   - Or: Remove `claimRewards()` if rewards go directly to DCURewardManager

2. **Update Deployment:**
   - Remove RewardLogic from `DCUContracts.ts`
   - Update Submission constructor to not require RewardLogic

3. **Update Terminology:**
   - Search/replace "DCU" with "$cDCU" in all contract files
   - Update comments, events, documentation

4. **Testing:**
   - Verify all reward flows work with DCURewardManager only
   - Test claim functionality
   - Verify no references to RewardLogic remain

### Expected Outcome
- Single reward system (DCURewardManager)
- Cleaner architecture
- Easier maintenance
- Consistent "$cDCU" terminology throughout

