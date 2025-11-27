// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IDCUToken.sol";
import "./interfaces/INFTCollection.sol";
import "./interfaces/IRewards.sol";
import "./DCURewardManager.sol";

/**
 * @title RewardLogic
 * @dev Contract for handling DCU token rewards based on NFT claims and upgrades
 */
contract RewardLogic is Ownable, IRewards {
    IDCUToken public dcuToken;
    INFTCollection public nftCollection;
    
    // Authorization for external contracts
    mapping(address => bool) public authorizedContracts;
    
    // Constants
    uint256 public constant NFT_CLAIM_REWARD = 10 ether; // 10 DCU for new NFT claims
    uint256 public constant LEVEL_UPGRADE_REWARD = 10 ether; // 10 DCU for level upgrades
    
    // Events for tracking reward distributions
    event RewardDistributed(
        address indexed user,
        uint256 amount,
        uint256 nftBalance,
        uint256 timestamp
    );
    
    // New events for NFT-specific rewards
    event NFTClaimReward(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 timestamp
    );
    
    event NFTUpgradeReward(
        address indexed user,
        uint256 indexed tokenId,
        uint256 newLevel,
        uint256 amount,
        uint256 timestamp
    );
    
    event DCUDistributed(
        address indexed user,
        uint256 amount,
        uint256 timestamp,
        string reason
    );

    event NFTCollectionUpdated(
        address indexed oldCollection,
        address indexed newCollection
    );

    event ContractAuthorizationChanged(
        address indexed contractAddress,
        bool authorized
    );
    
    event ContractAuthorized(address indexed contractAddress, uint256 timestamp);
    event ContractAuthorizationRevoked(address indexed contractAddress, uint256 timestamp);
    
    /**
     * @dev Constructor sets the DCU token and NFT collection addresses
     * @param _dcuToken Address of the DCU token contract
     * @param _nftCollection Address of the NFT collection contract
     */
    constructor(address _dcuToken, address _nftCollection) Ownable(msg.sender) {
        dcuToken = IDCUToken(_dcuToken);
        nftCollection = INFTCollection(_nftCollection);
        
        // Authorize the NFT collection by default
        if (_nftCollection != address(0)) {
            authorizedContracts[_nftCollection] = true;
            emit ContractAuthorized(_nftCollection, block.timestamp);
        }
    }
    
    /**
     * @dev Authorize a contract to call distributeDCU (only owner)
     * @param contractAddress Address of the contract to authorize
     */
    function authorizeContract(address contractAddress) external onlyOwner {
        require(contractAddress != address(0), "Cannot authorize zero address");
        authorizedContracts[contractAddress] = true;
        emit ContractAuthorized(contractAddress, block.timestamp);
    }
    
    /**
     * @dev Revoke authorization for a contract (only owner)
     * @param contractAddress Address of the contract to revoke
     */
    function revokeContractAuthorization(address contractAddress) external onlyOwner {
        authorizedContracts[contractAddress] = false;
        emit ContractAuthorizationRevoked(contractAddress, block.timestamp);
    }

    /**
     * @dev Set the NFT collection address
     * @param _nftCollection Address of the new NFT collection contract
     */
    function setNFTCollection(address _nftCollection) external onlyOwner {
        require(_nftCollection != address(0), "Invalid NFT collection address");
        address oldCollection = address(nftCollection);
        nftCollection = INFTCollection(_nftCollection);
        emit NFTCollectionUpdated(oldCollection, _nftCollection);
    }

    /**
     * @dev Authorize or revoke a contract to call distributeDCU
     * @param contractAddress The contract address to authorize
     * @param authorized Whether to authorize or revoke
     */
    function authorizeContract(address contractAddress, bool authorized) external onlyOwner {
        require(contractAddress != address(0), "Invalid contract address");
        authorizedContracts[contractAddress] = authorized;
        emit ContractAuthorizationChanged(contractAddress, authorized);
    }

    /**
     * @dev Calculate reward based on NFT holdings (base implementation)
     * @param user Address of the user to calculate reward for
     * @return Calculated reward amount
     */
    function calculateReward(address user) public view returns (uint256) {
        // Implement reward calculation logic based on NFT holdings
        uint256 nftBalance = nftCollection.balanceOf(user);
        return nftBalance * 100 ether; // Example: 100 DCU per NFT
    }

    /**
     * @dev Distribute reward to a user based on their NFT holdings
     * @param user Address of the user to reward
     */
    function distributeReward(address user) external {
        uint256 reward = calculateReward(user);
        require(dcuToken.mint(user, reward), "Reward distribution failed");
        
        // Emit event for tracking reward distribution
        emit RewardDistributed(
            user,
            reward,
            nftCollection.balanceOf(user),
            block.timestamp
        );
    }
    
    /**
     * @dev Reward user for claiming a new NFT (Level 1)
     * @param user Address of the user to reward
     * @param tokenId ID of the claimed NFT
     */
    function rewardNFTClaim(address user, uint256 tokenId) external onlyOwner {
        require(dcuToken.mint(user, NFT_CLAIM_REWARD), "NFT claim reward failed");
        
        emit NFTClaimReward(
            user,
            tokenId,
            NFT_CLAIM_REWARD,
            block.timestamp
        );
    }
    
    /**
     * @dev Reward user for upgrading their NFT level
     * @param user Address of the user to reward
     * @param tokenId ID of the upgraded NFT
     * @param newLevel New level of the NFT
     */
    function rewardNFTUpgrade(address user, uint256 tokenId, uint256 newLevel) external onlyOwner {
        require(dcuToken.mint(user, LEVEL_UPGRADE_REWARD), "Level upgrade reward failed");
        
        emit NFTUpgradeReward(
            user,
            tokenId,
            newLevel,
            LEVEL_UPGRADE_REWARD,
            block.timestamp
        );
    }
    
    /**
     * @dev Distribute DCU tokens to a user (implementation of IRewards interface)
     * @param user Address of the user to distribute to
     * @param amount Amount of DCU to distribute
     * @return success Whether the distribution was successful
     */
    function distributeDCU(address user, uint256 amount) external override returns (bool) {
        // Only authorized contracts can call this function
        require(authorizedContracts[msg.sender] || msg.sender == address(nftCollection), 
                "Only authorized contracts can call");
        
        // Initialize reward manager
        DCURewardManager rewardManager = DCURewardManager(address(0));
        
        // Only try to get the reward manager if we have an NFT collection
        if (address(nftCollection) != address(0)) {
            try INFTCollection(nftCollection).rewardsContract() returns (address rewardsContractAddr) {
                rewardManager = DCURewardManager(rewardsContractAddr);
            } catch {
                // Continue even if we can't get the reward manager
            }
        }
        
        // If we have a reward manager and the caller is the NFT contract, check eligibility
        if (address(rewardManager) != address(0) && msg.sender == address(nftCollection)) {
            try rewardManager.getVerificationStatus(user) returns (
                bool poiVerified,
                bool nftMinted,
                bool rewardEligible
            ) {
                require(rewardEligible, "User not eligible for rewards");
            } catch {
                // If we can't check eligibility, continue
            }
        }
        
        // Mint tokens to the user
        bool success = dcuToken.mint(user, amount);
        require(success, "DCU distribution failed");
        
        emit DCUDistributed(
            user,
            amount,
            block.timestamp,
            "Reward from authorized contract"
        );

        return success;
    }
} 