// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RecyclablesReward
 * @dev Manages cRECY token rewards for recyclables submissions
 * Separate contract for easy replacement when reserve is depleted
 */
contract RecyclablesReward is Ownable, ReentrancyGuard {
    // Custom Errors
    error RECYCLABLES__InvalidAddress();
    error RECYCLABLES__InvalidSubmissionContract();
    error RECYCLABLES__AlreadyClaimed(uint256 submissionId);
    error RECYCLABLES__ReserveEmpty();
    error RECYCLABLES__InsufficientReserve(uint256 available, uint256 required);
    error RECYCLABLES__TransferFailed();
    error RECYCLABLES__NotSubmissionContract(address caller);
    error RECYCLABLES__InvalidRewardAmount();
    error RECYCLABLES__MaxRewardsReached(uint256 totalRewarded, uint256 maxRewards);

    // cRECY token contract
    IERC20 public immutable cRecyToken;
    
    // Submission contract that can trigger rewards
    address public submissionContract;
    
    // Reward configuration
    uint256 public rewardAmount = 5 ether; // 5 cRECY per submission
    
    // Reserve tracking
    uint256 public totalReserve;
    uint256 public totalRewarded;
    
    // Maximum total rewards (5000 cRECY)
    uint256 public constant MAX_TOTAL_REWARDS = 5000 ether;
    
    // Track which submissions have been rewarded
    mapping(uint256 => bool) public submissionRewarded;
    
    // Events
    event RecyclablesRewarded(
        address indexed user,
        uint256 indexed submissionId,
        uint256 amount,
        uint256 remainingReserve
    );
    
    event ReserveUpdated(
        uint256 oldReserve,
        uint256 newReserve,
        address indexed updatedBy
    );
    
    event RewardAmountUpdated(
        uint256 oldAmount,
        uint256 newAmount,
        address indexed updatedBy
    );
    
    event SubmissionContractUpdated(
        address indexed oldContract,
        address indexed newContract
    );
    
    event ReserveWithdrawn(
        address indexed to,
        uint256 amount
    );

    /**
     * @dev Modifier to restrict access to submission contract only
     */
    modifier onlySubmissionContract() {
        if (msg.sender != submissionContract) 
            revert RECYCLABLES__NotSubmissionContract(msg.sender);
        _;
    }

    /**
     * @dev Constructor
     * @param _cRecyToken Address of the cRECY ERC20 token
     * @param _submissionContract Address of the Submission contract
     */
    constructor(
        address _cRecyToken,
        address _submissionContract
    ) Ownable(msg.sender) {
        if (_cRecyToken == address(0)) revert RECYCLABLES__InvalidAddress();
        if (_submissionContract == address(0)) revert RECYCLABLES__InvalidSubmissionContract();
        
        cRecyToken = IERC20(_cRecyToken);
        submissionContract = _submissionContract;
    }

    /**
     * @dev Update the submission contract address
     * @param _newSubmissionContract New submission contract address
     */
    function updateSubmissionContract(address _newSubmissionContract) external onlyOwner {
        if (_newSubmissionContract == address(0)) revert RECYCLABLES__InvalidSubmissionContract();
        
        address oldContract = submissionContract;
        submissionContract = _newSubmissionContract;
        
        emit SubmissionContractUpdated(oldContract, _newSubmissionContract);
    }

    /**
     * @dev Update the reward amount per submission
     * @param _newAmount New reward amount in wei (18 decimals)
     */
    function updateRewardAmount(uint256 _newAmount) external onlyOwner {
        if (_newAmount == 0) revert RECYCLABLES__InvalidRewardAmount();
        
        uint256 oldAmount = rewardAmount;
        rewardAmount = _newAmount;
        
        emit RewardAmountUpdated(oldAmount, _newAmount, msg.sender);
    }

    /**
     * @dev Sync reserve balance with actual token balance
     * Call this after transferring cRECY to this contract
     */
    function syncReserve() external onlyOwner {
        uint256 oldReserve = totalReserve;
        totalReserve = cRecyToken.balanceOf(address(this));
        
        emit ReserveUpdated(oldReserve, totalReserve, msg.sender);
    }

    /**
     * @dev Reward a user for recyclables submission
     * Can only be called by the Submission contract
     * @param user Address of the user to reward
     * @param submissionId ID of the submission
     */
    function rewardRecyclables(
        address user,
        uint256 submissionId
    ) external onlySubmissionContract nonReentrant {
        if (user == address(0)) revert RECYCLABLES__InvalidAddress();
        if (submissionRewarded[submissionId]) revert RECYCLABLES__AlreadyClaimed(submissionId);
        
        // Check if maximum total rewards limit has been reached (5000 cRECY)
        if (totalRewarded >= MAX_TOTAL_REWARDS) 
            revert RECYCLABLES__MaxRewardsReached(totalRewarded, MAX_TOTAL_REWARDS);
        
        // Check if reserve has enough tokens
        uint256 currentBalance = cRecyToken.balanceOf(address(this));
        if (currentBalance == 0) revert RECYCLABLES__ReserveEmpty();
        if (currentBalance < rewardAmount) 
            revert RECYCLABLES__InsufficientReserve(currentBalance, rewardAmount);
        
        // Calculate actual reward (don't exceed MAX_TOTAL_REWARDS)
        uint256 actualReward = rewardAmount;
        if (totalRewarded + rewardAmount > MAX_TOTAL_REWARDS) {
            actualReward = MAX_TOTAL_REWARDS - totalRewarded;
        }
        
        // Mark as rewarded
        submissionRewarded[submissionId] = true;
        
        // Update tracking
        totalRewarded += actualReward;
        totalReserve = currentBalance - actualReward;
        
        // Transfer cRECY tokens to user
        bool success = cRecyToken.transfer(user, actualReward);
        if (!success) revert RECYCLABLES__TransferFailed();
        
        emit RecyclablesRewarded(user, submissionId, actualReward, totalReserve);
    }

    /**
     * @dev Withdraw remaining cRECY tokens (emergency/end of program)
     * @param to Address to send tokens to
     * @param amount Amount to withdraw
     */
    function withdrawReserve(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert RECYCLABLES__InvalidAddress();
        
        uint256 currentBalance = cRecyToken.balanceOf(address(this));
        if (currentBalance < amount) 
            revert RECYCLABLES__InsufficientReserve(currentBalance, amount);
        
        totalReserve = currentBalance - amount;
        
        bool success = cRecyToken.transfer(to, amount);
        if (!success) revert RECYCLABLES__TransferFailed();
        
        emit ReserveWithdrawn(to, amount);
    }

    /**
     * @dev Get current reserve status
     * @return available Current token balance available for rewards
     * @return rewarded Total amount already rewarded
     * @return perSubmission Reward amount per submission
     */
    function getReserveStatus() external view returns (
        uint256 available,
        uint256 rewarded,
        uint256 perSubmission
    ) {
        return (
            cRecyToken.balanceOf(address(this)),
            totalRewarded,
            rewardAmount
        );
    }

    /**
     * @dev Check if a submission has been rewarded
     * @param submissionId ID of the submission
     * @return Whether the submission has been rewarded
     */
    function isRewarded(uint256 submissionId) external view returns (bool) {
        return submissionRewarded[submissionId];
    }

    /**
     * @dev Check if reserve has enough for a reward
     * @return Whether there's enough reserve for one more reward
     */
    function hasReserve() external view returns (bool) {
        return cRecyToken.balanceOf(address(this)) >= rewardAmount;
    }
}
