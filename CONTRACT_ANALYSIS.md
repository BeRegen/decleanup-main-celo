# Contract Architecture Analysis

## Current Contract Structure

### 1. **DCURewardManager** (Main Reward System)
- **Purpose**: Handles reward accrual and distribution
- **How it works**: 
  - Stores rewards in `userBalances` mapping (points/storage)
  - When user calls `claimRewards()`, it mints actual tokens: `dcuToken.mint(msg.sender, amount)`
- **Used for**: Impact Product claims, referrals, streaks, impact reports, verifier rewards, hypercerts
- **Status**: ✅ Main reward system - stores points, mints on claim

### 2. **RewardLogic** (Redundant?)
- **Purpose**: Handles DCU token rewards based on NFT claims and upgrades
- **How it works**: 
  - Mints tokens directly: `dcuToken.mint(user, amount)` (no storage/accrual)
- **Used for**: 
  - Only in `Submission.claimRewards()` function
  - NFT claim/upgrade rewards (but these are handled by DCURewardManager now)
- **Status**: ⚠️ **REDUNDANT** - DCURewardManager already handles this

### 3. **DCUAccounting** (Different Purpose)
- **Purpose**: Manages DCU token deposits and withdrawals with TGE restrictions
- **How it works**: 
  - Users deposit/withdraw existing tokens (not rewards)
  - Handles TGE restrictions and whitelisting
- **Status**: ✅ Different purpose - not redundant

## Issues Identified

### Issue 1: Redundant Reward Systems
**Problem**: Two separate reward claiming mechanisms:
1. `Submission.claimRewards()` → `RewardLogic.distributeDCU()` → mints directly
2. `DCURewardManager.claimRewards()` → mints from stored `userBalances`

**Impact**: 
- Confusing architecture
- Unnecessary contract deployment
- Two different reward flows to maintain

**Recommendation**: 
- Remove `RewardLogic` contract
- Use `DCURewardManager` for all rewards
- Update `Submission.claimRewards()` to use `DCURewardManager` instead

### Issue 2: Terminology Inconsistency
**Problem**: Contracts use "DCU" instead of "$cDCU" in comments and documentation

**Impact**: 
- Inconsistent branding
- Confusion about token name

**Recommendation**: 
- Update all contract comments to use "$cDCU"
- Update documentation to use "$cDCU"

## Recommended Architecture

### Simplified Structure:
1. **DCURewardManager** - Single source of truth for all rewards
   - Stores rewards as points (userBalances)
   - Mints tokens when user claims
   - Handles all reward types (Impact Product, referrals, streaks, etc.)

2. **DCUAccounting** - Token deposit/withdrawal system
   - Keep as-is (different purpose)

3. **Remove RewardLogic** - Consolidate into DCURewardManager

## Migration Plan

1. Update `Submission.sol`:
   - Remove `rewardLogic` reference
   - Change `claimRewards()` to use `DCURewardManager` instead
   - Or remove `claimRewards()` entirely if rewards go directly to DCURewardManager

2. Update all comments/docs:
   - Change "DCU" to "$cDCU" in all contract files
   - Update documentation

3. Update deployment scripts:
   - Remove RewardLogic deployment
   - Update Submission constructor to not require RewardLogic

## Current Reward Flow

### Flow 1: Submission.claimRewards()
```
User calls Submission.claimRewards()
  → Reads claimableRewards[user]
  → Calls rewardLogic.distributeDCU()
  → RewardLogic mints tokens directly
```

### Flow 2: DCURewardManager (Main System)
```
Submission approves cleanup
  → Calls rewardManager.rewardImpactProductClaim()
  → DCURewardManager._addReward() stores in userBalances
  → User calls rewardManager.claimRewards()
  → DCURewardManager mints tokens
```

**Recommendation**: Consolidate to Flow 2 only.

