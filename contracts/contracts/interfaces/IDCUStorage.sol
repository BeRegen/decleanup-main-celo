// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IDCUStorage
 * @dev Interface for the DCUStorage contract
 */
interface IDCUStorage {
    // Events
    event ClaimableBalanceAdded(address indexed user, uint256 amount, uint256 newBalance);
    event TokensClaimed(address indexed user, uint256 amount, uint256 remainingClaimable);
    event TGEStatusChanged(bool completed);
    event AddressWhitelisted(address indexed account);
    event AddressRemovedFromWhitelist(address indexed account);
    event TokensStaked(address indexed user, uint256 amount, uint256 newStakedBalance);
    event TokensUnstaked(address indexed user, uint256 amount, uint256 newStakedBalance);
    event TokensLocked(address indexed user, uint256 amount, uint256 releaseTime);
    event TokensUnlocked(address indexed user, uint256 amount);
    event GovernanceUpdated(address indexed oldGovernance, address indexed newGovernance);
    
    // TGE functions
    function setTGEStatus(bool _tgeCompleted) external;
    function addToWhitelist(address account) external;
    function removeFromWhitelist(address account) external;
    function isWhitelisted(address account) external view returns (bool);
    
    // Claimable balance functions
    function addClaimableBalance(address user, uint256 amount) external;
    function claimTokens(uint256 amount) external;
    function claimTokensFor(address user, uint256 amount) external;
    function getClaimableBalance(address user) external view returns (uint256);
    function totalClaimable() external view returns (uint256);
    
    // Token functions
    function mint(address to, uint256 amount) external returns (bool);
    function burnFrom(address from, uint256 amount) external;
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    
    // Staking functions
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function getStakedBalance(address user) external view returns (uint256);
    
    // Locking functions
    function lockTokens(uint256 amount, uint256 lockDuration) external;
    function unlockTokens() external;
    function getLockedBalance(address user) external view returns (uint256 amount, uint256 releaseTime);
    
    // Governance functions
    function updateGovernance(address newGovernance) external;
    function setStakingContract(address stakingContract) external;
    function setRewardManager(address rewardManager) external;
} 