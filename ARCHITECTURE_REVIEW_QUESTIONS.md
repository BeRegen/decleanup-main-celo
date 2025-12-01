# Architecture Review & Clarifying Questions

## ✅ What I Understand

### Core Flow
1. **User submits cleanup** → Photos + location + optional impact report + optional recyclables
2. **Verifier approves** → User verified as POI, rewards distributed, cleanup count incremented
3. **User claims Impact Product** → Mints/upgrades NFT, gets 10 $bDCU, referral rewards (3 $cDCU each)
4. **User can submit new cleanup** → Only after previous is verified AND claimed

### Contracts Structure
- **Submission.sol**: Main contract for cleanups, verification, Impact Product claims
- **DCURewardManager.sol**: Handles all reward accrual and distribution
- **ImpactProductNFT.sol**: Soulbound NFT that levels up (1-10) - THEY ARE NOT SOULBOUND, CAN BE TRANSFERRED
- **DCUToken.sol**: ERC20 token for rewards 
- **RecyclablesReward.sol**: Separate contract for recyclables rewards (cRECY tokens) - MUST BE BUILT IN A WAY< SO WE CAN EASY REMOVE WHEN RESERVE OF CRECY TOKENS IS GONE AND THIS PROMOTION IS OVER>

### Reward System
- **Impact Product Claim**: 10 $bDCU (via `rewardImpactProductClaim`)
- **Referral Rewards**: 3 $cDCU each (referrer + referred user) when Impact Product is claimed
- **Verifier Rewards**: 1 $cDCU per verification
- **Impact Reports**: 5 $cDCU per form
- **Recyclables**: cRECY tokens (via RecyclablesReward contract) 5 $cRECY!
- **Streaks**: 3 $cDCU (if implemented) - once a week 1 cleanup
- **Hypercert Bonus**: 10 $cDCU (when hypercert is minted)

---

## ❓ Questions & Unclear Areas

### 1. Hypercerts Flow - User Side

**Question 1.1**: When exactly does a user become eligible for a Hypercert?
- I see `userHypercertCount` increments every 10 cleanups
- But when does the frontend check eligibility? On every page load? After each verification? AFTER WHEN FRONTEND SEES IMPACT PRODUCT AVAILABLE ON DASHBOARD IS 10 LEVEL (OR 20, 30, 40, 50 ETC), THE SECTION OF HYPERCERTS BUTTON BECOMES ACTIVE
- Should there be a notification/prompt when user becomes eligible? YES. AFTER EVERY 10 CLEANUP YOU CAN NOTIFY THAT ITS TIME FOR HYPERCERT EVENT

**Question 1.2**: Hypercert minting process - who initiates it? - USER PRESSES BUTTON "CREATE HYPERCERT" (IF HE LOADED AT LEAST ONE IMPACT FORM DURING 10 CLEANUPS HE IS ELIGIBLE)
- Does the user manually click "MINT HYPERCERT" button when eligible? CREATE HYPERCERT, YES MANUALLY
- Or is it automatic after 10th verification? NO
- What if user has 10 cleanups but some aren't verified yet? HAVE TO BE VERIFIED AND CLAIMED LEVELS

**Question 1.3**: Hypercert reward claiming
- I see `claimHypercertReward(hypercertNumber)` in DCURewardManager 
- The minting function tries to claim automatically, but what if it fails? NO AUTOMATICALLY, AS I UNDERSTAND USER MUST SUBMIT LOGO AND BANNER BY HIMSELF... CAN WE PROVIDE AUTOMATED FUNCTION FOR THAT? LET SYSTEM GENERATE BANNER AND LOGO THAT FIT IN HYPERCERT REQUIEREMENTS?
- Should there be a separate "Claim Hypercert Reward" button on dashboard? YEAH,BUT IT'S CALLED CREATE HYPERCERT AND IT'S LEADING TO SPECIAL HYPERCERTS PAGE. SO THIS BUTTON IS GATED UNTIL USER BECOMES ELIGIBLE. IF YOU ARE PLANNING TO KEEP THIS BUTTON ALL THE TIME, BUT MAKE IT NOT ACTIVE, WRITE A LITTLE EXPANDING NOTE WITH "?" EXPLAINIG WHEN IT WILL BECOME ACTIVE AND WHAT THE CONDITIONS ARE (SUBMIT IMPACT REPORTS)
- How does user know which hypercertNumber to use? (1st hypercert = 1, 2nd = 2, etc.) AFTER EACH 10 CLEANUPS THERE IS ONE HYPERCETS, WHATS THE PROBLEM

**Question 1.4**: Hypercert data aggregation
- The code aggregates last 10 cleanups (from `hypercertNumber * 10 - 9` to `hypercertNumber * 10`)
- What if user has 15 cleanups? Does hypercert #2 use cleanups 11-20? YES
- What if some cleanups in that range don't have impact reports? Are they still included? AT LEAST ONE PROVIDED - ELIGIBLE

### 2. Hypercerts Flow - Admin Side

**Question 2.1**: Admin role in Hypercerts
- I see `rewardHypercertMint(address user)` is `onlyOwner` in DCURewardManager
- When would an admin manually call this? Is this a backup mechanism?
- Should admins be able to mint hypercerts on behalf of users? NO, FIX IT, NOT OUR OBLIGATION

**Question 2.2**: Hypercert verification/validation
- Do admins need to verify hypercert data before it's minted? YES KEEP IT ONLY FOR ADMIN, WHICH IS SAME WALLET WE USED (REMIND ME WHO IS AMDIN HERE - AND WHO IS OUR FIRST VERIFIER) AND KEEP NOTE FOR USER THAT THEIR HYPERCERT IS UNDER VERIFICATION. AFTER VERIFICATION IS DONE THEY SEE BUTTON "MINT HYPERCERT"
- Should there be an admin dashboard to review hypercert eligibility? YES MAKE IT, IF YOU SEE HOW TO BUILD IT GOOD
- Can admins reject or modify hypercert metadata? YES, ONLY REJECT

**Question 2.3**: Hypercert metadata updates
- Can hypercert metadata be updated after minting? I DON'T KNOW, MAYBE NOT
- What if impact report data is found to be incorrect? ADMIN WILL BE CHECKING
- Is there a mechanism to revoke or invalidate hypercerts? I DON'T KNOW

### 3. Reward Distribution & Claiming

**Question 3.1**: Reward claiming flow
- Users accrue rewards in `DCURewardManager.userBalances` 
- When do users claim? Is there a "Claim All Rewards" button? NO THEY DON'T CLAIM REWARDS IF YOU MEAN $CDCU, IT COMES AUTOMATED
- Or do rewards auto-claim on certain actions (like Impact Product claim)? AUTOCLAIM 10 AFTER EACH LEVEL OF IMPACT PRODUCT
- I see `claimRewards(uint256 amount)` - can users claim partial amounts? NO CLAIM MANUALLY OF $CDCU UNTIL TOKEN LAUNCH DAY. FOR NOW THEY STAY IN THE SYSTEM, THEN WE MAKE THE CLAIM'STAKE PAGE

**Question 3.2**: Reward types breakdown
- Should dashboard show breakdown: "10 $cDCU from Impact Product, 3 $cDCU from referral, etc."? YEAH I THOUGHT IT IS SHOWING IT NOW
- Or just total balance? NO
- How do users see their reward history? GIVE THEM MODAL IF YOU WANT

**Question 3.3**: $bDCU vs $cDCU
- I see references to both `$bDCU` and `$cDCU` in code NO NO, ONLY $cDCU please and make sure it is this way everywhere
- Are these the same token (DCUToken)? it's just one on base one on celo, base is from other project, mistkenly here
- Or are they different tokens? If different, what's the relationship?

### 4. Impact Product NFT Levels

**Question 4.1**: Level progression logic
- User starts at level 0 (no NFT)
- First claim → Level 1 NFT
- Each subsequent claim → Level +1 (max 10)
- Is this correct? Or can user skip levels? no skipping. and more levels coming soon when i'm ready with content. 

**Question 4.2**: Level assignment on verification
- I see verifier assigns a level when approving: `verifyCleanup(cleanupId, nextLevel)` 
- But `nextLevel` is calculated automatically based on user's current level
- So verifier doesn't actually choose the level - it's automatic? no doesnt choose, systemm counts for user
- Why does verifier need to pass `nextLevel` if it's always `currentLevel + 1`? maybe that's wrong. we go level by level one by one

**Question 4.3**: Multiple cleanups at same level
- If user has 3 verified cleanups but hasn't claimed any Impact Product yet not possible! one cleanup - one level, no submissions can be accepted
- Can they claim all 3 at once? Or must claim one at a time? no no no, one by one
- What happens if they claim cleanup #2 before cleanup #1? not posisb;e 

### 5. Referral System

**Question 5.1**: Referral registration
- Referrer is set on first submission if `referrer != address(0)` 
- Is this a one-time thing? Or can user change referrer? one time
- What if user was referred but referrer address is invalid? count anyway, but what you mean invalid

**Question 5.2**: Referral rewards timing
- Referral rewards (3 $cDCU each) are given when Impact Product is claimed
- What if user never claims Impact Product? Do referrer and referred user never get rewards? not given $cDCU
- Should there be a separate referral reward for just submitting/verifying (not claiming)? no

**Question 5.3**: Referral tracking
- How do admins track referral performance? system tracks it, not admins, just give peiple tokens thats all
- Should there be a referral dashboard showing who referred whom? no, no need. just maybe count the stats in leaderboard, along with total $cDCU earned. 
- Can users see their referral stats (how many people they referred, total rewards earned)? in leaderboard, i thought you made it already

### 6. Recyclables System

**Question 6.1**: RecyclablesReward contract
- Separate contract for recyclables (cRECY tokens) 
- Is this deployed? What's the contract address? 0xa8BfaF990bEA1d471CBE408Ee74e3Fa6700259a3 and token address is 0x34C11A932853Ae24E845Ad4B633E3cEf91afE583 and balance of 5000 stays for now at decleanupnet.eth community wallet 
- How does Submission contract call it? Is it set in constructor? you think

**Question 6.2**: Recyclables reward amount
- I see `RecyclablesReward.rewardRecyclables(submission.submitter, submissionId)`
- But what's the reward amount? Is it fixed (e.g., 5 cRECY) or variable? fixed 5 per submission (if approved by verifiers along with the main submissiom)
- Is there a cap on total cRECY supply (I see 5000 mentioned)? yes that's our reserve, when finish we stop

**Question 6.3**: Recyclables token display
- Should dashboard show cRECY balance separately from $cDCU? show, why not
- Can users trade/transfer cRECY? Or is it also soulbound? can transfer, not my token. 

### 7. Fee Structure

**Question 7.1**: Submission fee
- 0.01 CELO fee on submission (goes to treasury)
- Is this refunded if cleanup is rejected? (Code says no - fee is kept) not refunded, they will earn back $cDCU fo that
- Should there be a fee refund mechanism for rejected cleanups? yes possible 

**Question 7.2**: Claim fee
- 0.01 CELO fee on Impact Product claim (goes to treasury)
- Is this the only fee? Or are there other transaction fees? hypercert mint too, we are providers, can take fees
- Should fee amounts be configurable by admin? only once, not evolving

### 8. Verifier System

**Question 8.1**: Verifier access control
- Verifiers have `ADMIN_ROLE` in Submission contract 
- How are verifiers added/removed? Is there an admin function? verifiers should be automatically added when token stake is available. as soon as they have 100 they can become verifiers. so until then we don't need to think about it, token isn't live. but do some steps if you wish
- Should there be different roles (e.g., `VERIFIER_ROLE` vs `ADMIN_ROLE`)? yes they are different, admin is admin and verifier can't have admin functions available to them, only exclusevely verify submissions, not even hypercerts info

**Question 8.2**: Verifier rewards
- Verifiers get 1 $cDCU per verification
- Is this automatic on `approveSubmission()`? automatic
- What if verification fails or is reverted? Does verifier still get reward? fails no, rejected yes. 

**Question 8.3**: Verifier dashboard features
- Current dashboard shows pending cleanups
- Should verifiers see their own stats (total verified, rewards earned)?
- Should there be verifier leaderboard?

### 9. Data & IPFS

**Question 9.1**: IPFS pinning
- Photos and impact reports are uploaded to IPFS
- Are these pinned permanently? Or do they expire? we will be saving the ones users agreed to share for content
- What happens if IPFS gateway is down? Are there multiple fallbacks? not

**Question 9.2**: Impact report data validation
- Impact reports are self-reported (weight, area, etc.) 
- Should there be validation rules (e.g., max weight, reasonable area)? not at this moment
- Can verifiers edit/correct impact report data? no

**Question 9.3**: Data retention
- How long is cleanup data stored? until user is done with 10 cleanups, then we start again
- Can users delete their submissions? no
- What about GDPR/compliance for user data? tell me more

### 10. Edge Cases & Error Handling

**Question 10.1**: Transaction failures
- What if Impact Product claim transaction fails after NFT is minted? then keep possibility to retry of course
- What if referral reward fails but NFT claim succeeds? it's ok
- Should there be retry mechanisms? no

**Question 10.2**: Network issues
- What if user submits cleanup but transaction is pending for hours? 
- Should there be a "check transaction status" feature? yes
- How do we handle RPC timeouts? you think

**Question 10.3**: Contract upgrades
- Are contracts upgradeable? Or immutable? up to you, for now no worries, for sure i will be redeploying, but provide best solution for mainnet celo
- What if bugs are found? How are they fixed? i will be fixing, how else
- Should there be pause mechanisms for emergencies? yes make the page with our branding and "under maintenance"

---

## 🔍 Specific Code Questions

### Submission.sol
1. **Line 338**: `userHypercertCount[submission.submitter]++` - This increments on every approval. Should it only increment when count % 10 == 0? Or is the check done elsewhere? didn't get this one. every 10 cleanup, if level minted
2. **Line 392**: `impactProductNFT.verifyPOI(submission.submitter)` - This is called on approval. What if it fails? Does approval still succeed? have to be repeated if tx fails
3. **Line 465**: `rewardManager.rewardImpactProductClaim()` - This is in `claimImpactProduct`, but the 10 $bDCU reward is given here. Is this correct, or should it be given on verification? upon claim

### DCURewardManager.sol
1. **Line 248**: `rewardHypercertMint()` is `onlyOwner` - When is this called? Is it automatic or manual? admin checks hypercert submission and approves, then user can mint
2. **Line 285**: `claimHypercertReward()` - User calls this. But how do they know their hypercertNumber? Should there be a view function to get all eligible hypercert numbers? 10-1, 20-2, 30-3 - depends on how many cleanups done

### Frontend Flow
1. **Hypercert eligibility check**: Where is `getHypercertEligibility()` called? Is it on dashboard load? when loading page at the moment when each 10 levels are minted
2. **Impact Product display**: After claim, how does dashboard know to refresh and show new level? do refresh, what's the problem, check the transaction passed or no
3. **Pending cleanup check**: The check happens every 10 seconds. Is this efficient? Should it be event-driven? up to you

---

## 📋 Recommendations

1. **Add view functions** to easily check:
   - User's eligible hypercert numbers - what you mean numbers, every 10 cleanup he has one to make
   - User's reward breakdown by type - we have it on dashboard
   - User's referral stats - in leaderboard
   - Verifier's stats - on show it in verifier cabinet, how many tokens they earned from it

2. **Event-driven updates**: Instead of polling, listen to contract events for: OK
   - Cleanup verification 
   - Impact Product claims
   - Reward accruals

3. **Admin dashboard**: Consider adding:
   - Verifier management (add/remove) - LATER?
   - Fee configuration - do it
   - Reward distribution monitoring - do it in admin panel - create comprehensive panel for admin where you think all info should be and remind me who is admin so i can test
   - Hypercert review/approval - to admin panel as well

4. **Error recovery**: Add mechanisms for: (PROVIDE ME A PLAN)
   - Failed transaction retries 
   - Partial reward claims
   - Stuck state recovery

---

Please clarify these questions so I can ensure the implementation matches your vision!

