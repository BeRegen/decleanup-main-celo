// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IDCUToken
 * @dev Interface for DeCleanup Utility Token with dynamic supply model and governance features
 */
interface IDCUToken {
    // Basic ERC20 functions
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    // Permit extension functions
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    
    // Minting and burning functions
    function mint(address to, uint256 amount) external returns (bool);
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    
    // Admin functions
    function updateRewardLogicContract(address _newRewardLogicContract) external;
    function setSupplyCap(uint256 _supplyCap) external;
    function removeSupplyCap() external;
    
    // View functions
    function rewardLogicContract() external view returns (address);
    function totalMinted() external view returns (uint256);
    function supplyCap() external view returns (uint256);
    function supplyCapActive() external view returns (bool);
    function getTotalMinted() external view returns (uint256);
    function getCirculationStatus() external view returns (uint256 current, uint256 minted, bool capActive, uint256 cap);
    
    // Additional functions (for backward compatibility if needed)
    function burn(address from, uint256 amount) external;
    
    // Events
    event DCUMinted(address indexed to, uint256 amount, uint256 newBalance, uint256 timestamp);
    event DCUBurned(address indexed from, uint256 amount, uint256 newBalance, uint256 timestamp);
    event RewardLogicContractUpdated(address indexed oldRewardLogic, address indexed newRewardLogic, uint256 timestamp);
    event SupplyCapAdded(uint256 capAmount, uint256 timestamp, address indexed by);
    event SupplyCapRemoved(uint256 timestamp, address indexed by);
    
    // Events from ERC20
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
} 