// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IDCUToken.sol";
import "./interfaces/IRewards.sol";
import "./DCURewardManager.sol";

// Interface for RecyclablesReward contract
interface RecyclablesReward {
    function rewardRecyclables(address user, uint256 submissionId) external;
}

// Interface for ImpactProductNFT contract
interface IImpactProductNFT {
    function verifyPOI(address user) external;
    function safeMint() external;
    function upgradeNFT(uint256 tokenId) external;
    function getUserNFTData(address user) external view returns (uint256 tokenId, uint256 impact, uint256 level);
    function _userHasMinted(address user) external view returns (bool);
    function verifiedPOI(address user) external view returns (bool);
}

/**
 * @title Submission
 * @dev Contract for handling form submissions from the DeCleanup dapp
 */
contract Submission is Ownable, ReentrancyGuard, AccessControl {
    // Custom Errors
    error SUBMISSION__InvalidAddress();
    error SUBMISSION__InvalidSubmissionData();
    error SUBMISSION__SubmissionNotFound(uint256 submissionId);
    error SUBMISSION__Unauthorized(address user);
    error SUBMISSION__AlreadyApproved(uint256 submissionId);
    error SUBMISSION__AlreadyRejected(uint256 submissionId);
    error SUBMISSION__NoRewardsAvailable();
    error SUBMISSION__InsufficientSubmissionFee(uint256 sent, uint256 required);
    error SUBMISSION__RefundFailed();
    error SUBMISSION__CannotRefundApprovedSubmission(uint256 submissionId);
    
    // Role definitions for access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Submission status enum
    enum SubmissionStatus { Pending, Approved, Rejected }
    
    // Submission structure
    struct CleanupSubmission {
        uint256 id;
        address submitter;
        string dataURI;        // IPFS URI or other storage reference to submission data
        string beforePhotoHash; // IPFS hash for before photo
        string afterPhotoHash;  // IPFS hash for after photo
        string impactFormDataHash; // IPFS hash for impact form data
        int256 latitude;        // Location latitude (scaled by 1e6)
        int256 longitude;       // Location longitude (scaled by 1e6)
        uint256 timestamp;
        SubmissionStatus status;
        address approver;      // Admin who processed the submission
        uint256 processedTimestamp;
        bool rewarded;         // Whether a reward has been issued for this submission
        uint256 feePaid;       // Amount of fee paid for this submission
        bool feeRefunded;      // Deprecated - fees are kept by treasury
        bool hasImpactForm;    // Whether impact form was submitted
        bool hasRecyclables;   // Whether recyclables proof was submitted
        string recyclablesPhotoHash; // IPFS hash for recyclables photo
        string recyclablesReceiptHash; // IPFS hash for recyclables receipt (optional)
    }
    
    // Reference to the DCU token contract for rewards
    IDCUToken public dcuToken;
    
    // Reference to the RewardLogic contract
    IRewards public rewardLogic;
    
    // Reference to the DCURewardManager contract
    DCURewardManager public rewardManager;
    
    // Reference to the ImpactProductNFT contract
    IImpactProductNFT public impactProductNFT;
    
    // Reference to the RecyclablesReward contract (optional, can be address(0))
    address public recyclablesRewardContract;
    
    // Mapping from submission ID to Submission data
    mapping(uint256 => CleanupSubmission) public submissions;
    
    // Mapping from user address to their submission IDs
    mapping(address => uint256[]) public userSubmissions;
    
    // Mapping from user address to claimable rewards amount
    mapping(address => uint256) public claimableRewards;
    
    // Total number of submissions
    uint256 public submissionCount;
    
    // Default reward amount for approved submissions (in wei, 18 decimals)
    uint256 public defaultRewardAmount;
    
    // Submission fee configuration
    uint256 public submissionFee = 0.01 ether; // ~2 cents USD in CELO (approximately 0.01 CELO)
    bool public feeEnabled = true;
    address payable public treasury = payable(0x520E40E346ea85D72661fcE3Ba3F81CB2c560d84); // Main deployer/admin - receives contract fees
    
    // Total fees collected and refunded (for tracking)
    uint256 public totalFeesCollected;
    uint256 public totalFeesRefunded;
    
    // Referral and impact tracking
    mapping(address => address) public referrers; // invitee => referrer
    mapping(address => uint256) public userImpactFormCount; // Track impact forms per user
    
    // Hypercert tracking
    mapping(address => uint256) public userCleanupCount;
    mapping(address => uint256) public userHypercertCount;
    
    // Events
    event SubmissionCreated(
        uint256 indexed submissionId,
        address indexed submitter,
        string dataURI,
        uint256 timestamp
    );
    
    event SubmissionApproved(
        uint256 indexed submissionId,
        address indexed approver,
        uint256 timestamp
    );
    
    event SubmissionRejected(
        uint256 indexed submissionId,
        address indexed approver,
        uint256 timestamp
    );
    
    event DefaultRewardUpdated(uint256 oldAmount, uint256 newAmount);
    
    event RewardClaimed(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    event RewardAvailable(
        address indexed user,
        uint256 amount,
        uint256 submissionId,
        uint256 timestamp
    );
    
    event SubmissionFeeUpdated(uint256 newFee, bool enabled);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event HypercertEligible(address indexed user, uint256 cleanupCount, uint256 hypercertNumber);
    event ReferralRegistered(address indexed referrer, address indexed invitee);
    event ImpactFormSubmitted(address indexed user, uint256 submissionId, uint256 totalForms);
    event RecyclablesSubmitted(address indexed user, uint256 indexed submissionId, string recyclablesPhotoHash, string recyclablesReceiptHash);
    event RecyclablesRewardContractUpdated(address indexed oldContract, address indexed newContract);
    
    /**
     * @dev Constructor sets up the contract with DCU token, RewardLogic, DCURewardManager, and roles
     * @param _dcuToken Address of the DCU token contract
     * @param _rewardLogic Address of the RewardLogic contract
     * @param _rewardManager Address of the DCURewardManager contract
     * @param _defaultRewardAmount Default reward amount for approved submissions
     */
    constructor(address _dcuToken, address _rewardLogic, address _rewardManager, uint256 _defaultRewardAmount) Ownable(msg.sender) {
        if (_dcuToken == address(0)) revert SUBMISSION__InvalidAddress();
        if (_rewardLogic == address(0)) revert SUBMISSION__InvalidAddress();
        if (_rewardManager == address(0)) revert SUBMISSION__InvalidAddress();
        
        dcuToken = IDCUToken(_dcuToken);
        rewardLogic = IRewards(_rewardLogic);
        rewardManager = DCURewardManager(_rewardManager);
        defaultRewardAmount = _defaultRewardAmount;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new submission with IPFS hashes and optional referrer
     * @param dataURI IPFS URI or other storage reference to submission data
     * @param beforePhotoHash IPFS hash for before photo
     * @param afterPhotoHash IPFS hash for after photo
     * @param impactFormDataHash IPFS hash for impact form (empty string if not submitted)
     * @param lat Latitude (scaled by 1e6, e.g., 37.7749 * 1e6 = 37774900)
     * @param lng Longitude (scaled by 1e6)
     * @param referrer Address of referrer (address(0) if none)
     * @return submissionId The ID of the created submission
     */
    function createSubmission(
        string calldata dataURI,
        string calldata beforePhotoHash,
        string calldata afterPhotoHash,
        string calldata impactFormDataHash,
        int256 lat,
        int256 lng,
        address referrer
    ) external payable nonReentrant returns (uint256) {
        if (bytes(dataURI).length == 0) revert SUBMISSION__InvalidSubmissionData();
        if (bytes(beforePhotoHash).length == 0) revert SUBMISSION__InvalidSubmissionData();
        if (bytes(afterPhotoHash).length == 0) revert SUBMISSION__InvalidSubmissionData();
        
        // Check submission fee
        if (feeEnabled) {
            if (msg.value < submissionFee) 
                revert SUBMISSION__InsufficientSubmissionFee(msg.value, submissionFee);
        }
        
        // Register referrer on first submission
        if (userSubmissions[msg.sender].length == 0 && referrer != address(0) && referrer != msg.sender) {
            if (referrers[msg.sender] == address(0)) {
                referrers[msg.sender] = referrer;
                emit ReferralRegistered(referrer, msg.sender);
            }
        }
        
        uint256 submissionId = submissionCount;
        bool hasImpactForm = bytes(impactFormDataHash).length > 0;
        
        submissions[submissionId] = CleanupSubmission({
            id: submissionId,
            submitter: msg.sender,
            dataURI: dataURI,
            beforePhotoHash: beforePhotoHash,
            afterPhotoHash: afterPhotoHash,
            impactFormDataHash: impactFormDataHash,
            latitude: lat,
            longitude: lng,
            timestamp: block.timestamp,
            status: SubmissionStatus.Pending,
            approver: address(0),
            processedTimestamp: 0,
            rewarded: false,
            feePaid: msg.value,
            feeRefunded: false,
            hasImpactForm: hasImpactForm,
            hasRecyclables: false,
            recyclablesPhotoHash: "",
            recyclablesReceiptHash: ""
        });
        
        userSubmissions[msg.sender].push(submissionId);
        submissionCount++;
        
        // Track impact form submission
        if (hasImpactForm) {
            userImpactFormCount[msg.sender]++;
            emit ImpactFormSubmitted(msg.sender, submissionId, userImpactFormCount[msg.sender]);
        }
        
        // Transfer fee to treasury
        if (msg.value > 0) {
            (bool success, ) = treasury.call{value: msg.value}("");
            if (!success) revert SUBMISSION__RefundFailed();
            totalFeesCollected += msg.value;
        }
        
        emit SubmissionCreated(submissionId, msg.sender, dataURI, block.timestamp);
        
        return submissionId;
    }
    
    /**
     * @dev Attach recyclables data to an existing submission
     * Can only be called by the original submitter
     * Can only be called if submission is still pending (not approved/rejected)
     * @param submissionId The ID of the submission to attach recyclables to
     * @param recyclablesPhotoHash IPFS hash of the recyclables photo
     * @param recyclablesReceiptHash IPFS hash of the recyclables receipt (optional, can be empty string)
     */
    function attachRecyclables(
        uint256 submissionId,
        string calldata recyclablesPhotoHash,
        string calldata recyclablesReceiptHash
    ) external nonReentrant {
        if (submissionId >= submissionCount) revert SUBMISSION__SubmissionNotFound(submissionId);
        
        CleanupSubmission storage submission = submissions[submissionId];
        
        // Only the original submitter can attach recyclables
        if (submission.submitter != msg.sender) 
            revert SUBMISSION__Unauthorized(msg.sender);
        
        // Can only attach recyclables to pending submissions
        if (submission.status != SubmissionStatus.Pending) 
            revert SUBMISSION__SubmissionNotFound(submissionId);
        
        // Require recyclables photo hash
        if (bytes(recyclablesPhotoHash).length == 0) 
            revert SUBMISSION__InvalidSubmissionData();
        
        // Update submission with recyclables data
        submission.hasRecyclables = true;
        submission.recyclablesPhotoHash = recyclablesPhotoHash;
        submission.recyclablesReceiptHash = recyclablesReceiptHash;
        
        emit RecyclablesSubmitted(
            msg.sender,
            submissionId,
            recyclablesPhotoHash,
            recyclablesReceiptHash
        );
    }
    
    /**
     * @dev Approve a submission (only for admins)
     * Automatically rewards verifier and impact reports
     * @param submissionId The ID of the submission to approve
     */
    function approveSubmission(
        uint256 submissionId
    ) external nonReentrant onlyRole(ADMIN_ROLE) {
        if (submissionId >= submissionCount) revert SUBMISSION__SubmissionNotFound(submissionId);
        
        CleanupSubmission storage submission = submissions[submissionId];
        
        if (submission.status == SubmissionStatus.Approved) 
            revert SUBMISSION__AlreadyApproved(submissionId);
        
        submission.status = SubmissionStatus.Approved;
        submission.approver = msg.sender;
        submission.processedTimestamp = block.timestamp;
        
        // Increment cleanup count for Hypercert tracking
        userCleanupCount[submission.submitter]++;
        
        // Check if user is eligible for Hypercert (every 10 cleanups)
        if (userCleanupCount[submission.submitter] % 10 == 0) {
            userHypercertCount[submission.submitter]++;
            emit HypercertEligible(
                submission.submitter,
                userCleanupCount[submission.submitter],
                userHypercertCount[submission.submitter]
            );
        }
        
        emit SubmissionApproved(
            submissionId,
            msg.sender,
            block.timestamp
        );
        
        // Add to claimable rewards (user will claim manually)
        if (!submission.rewarded) {
            submission.rewarded = true;
            claimableRewards[submission.submitter] += defaultRewardAmount;
            
            emit RewardAvailable(
                submission.submitter,
                defaultRewardAmount,
                submissionId,
                block.timestamp
            );
        }
        
        // AUTOMATIC REWARDS
        
        // 1. Reward verifier (1 DCU)
        try rewardManager.rewardVerifier(msg.sender) {
            // Verifier rewarded successfully
        } catch {
            // Continue even if verifier reward fails
        }
        
        // 2. Reward impact reports (5 DCU per form)
        if (submission.hasImpactForm && userImpactFormCount[submission.submitter] > 0) {
            try rewardManager.rewardImpactReports(submission.submitter, 1) {
                // Impact report rewarded successfully
            } catch {
                // Continue even if impact report reward fails
            }
        }
        
        // 3. Reward recyclables (cRECY tokens via RecyclablesReward contract)
        if (submission.hasRecyclables && recyclablesRewardContract != address(0)) {
            try RecyclablesReward(recyclablesRewardContract).rewardRecyclables(submission.submitter, submissionId) {
                // Recyclables rewarded successfully
            } catch {
                // Continue even if recyclables reward fails
            }
        }
    }
    
    /**
     * @dev Claim available rewards
     */
    function claimRewards() external nonReentrant {
        uint256 amount = claimableRewards[msg.sender];
        if (amount == 0) revert SUBMISSION__NoRewardsAvailable();
        
        // Reset claimable rewards before external calls
        claimableRewards[msg.sender] = 0;
        
        // Distribute the rewards through RewardLogic and check the return value
        bool success = rewardLogic.distributeDCU(msg.sender, amount);
        require(success, "Reward distribution failed");
        
        emit RewardClaimed(
            msg.sender,
            amount,
            block.timestamp
        );
    }
    
    /**
     * @dev Get available claimable rewards for a user
     * @param user The user address to check
     * @return amount The amount of claimable rewards
     */
    function getClaimableRewards(address user) external view returns (uint256) {
        return claimableRewards[user];
    }
    
    /**
     * @dev Reject a submission (only for admins)
     * @param submissionId The ID of the submission to reject
     */
    function rejectSubmission(
        uint256 submissionId
    ) external nonReentrant onlyRole(ADMIN_ROLE) {
        if (submissionId >= submissionCount) revert SUBMISSION__SubmissionNotFound(submissionId);
        
        CleanupSubmission storage submission = submissions[submissionId];
        
        if (submission.status == SubmissionStatus.Rejected) 
            revert SUBMISSION__AlreadyRejected(submissionId);
        
        submission.status = SubmissionStatus.Rejected;
        submission.approver = msg.sender;
        submission.processedTimestamp = block.timestamp;
        
        emit SubmissionRejected(
            submissionId,
            msg.sender,
            block.timestamp
        );
        
        // Fee is kept by treasury - no refund for rejected submissions
    }
    
    /**
     * @dev Update the default reward amount (only for admins)
     * @param newRewardAmount The new default reward amount
     */
    function updateDefaultReward(uint256 newRewardAmount) external onlyRole(ADMIN_ROLE) {
        uint256 oldAmount = defaultRewardAmount;
        defaultRewardAmount = newRewardAmount;
        
        emit DefaultRewardUpdated(oldAmount, newRewardAmount);
    }
    
    /**
     * @dev Update submission fee (only for admins)
     * @param newFee The new submission fee amount
     * @param enabled Whether fee is enabled
     */
    function updateSubmissionFee(uint256 newFee, bool enabled) external onlyRole(ADMIN_ROLE) {
        submissionFee = newFee;
        feeEnabled = enabled;
        
        emit SubmissionFeeUpdated(newFee, enabled);
    }
    
    /**
     * @dev Update treasury address (only for owner)
     * @param newTreasury The new treasury address
     */
    function updateTreasury(address payable newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert SUBMISSION__InvalidAddress();
        
        address oldTreasury = treasury;
        treasury = newTreasury;
        
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @dev Update the RewardLogic contract address (only for owner)
     * @param _newRewardLogic The new RewardLogic contract address
     */
    function updateRewardLogic(address _newRewardLogic) external onlyOwner {
        if (_newRewardLogic == address(0)) revert SUBMISSION__InvalidAddress();
        rewardLogic = IRewards(_newRewardLogic);
    }
    
    /**
     * @dev Update the RecyclablesReward contract address (only for owner)
     * Can be set to address(0) to disable recyclables rewards
     * @param _newRecyclablesRewardContract The new RecyclablesReward contract address (or address(0) to disable)
     */
    function updateRecyclablesRewardContract(address _newRecyclablesRewardContract) external onlyOwner {
        address oldContract = recyclablesRewardContract;
        recyclablesRewardContract = _newRecyclablesRewardContract;
        
        emit RecyclablesRewardContractUpdated(oldContract, _newRecyclablesRewardContract);
    }
    
    /**
     * @dev Get all submissions for a user
     * @param user The address of the user
     * @return An array of submission IDs
     */
    function getSubmissionsByUser(address user) external view returns (uint256[] memory) {
        return userSubmissions[user];
    }
    
    /**
     * @dev Get the details of a submission
     * @param submissionId The ID of the submission
     * @return The submission details
     */
    function getSubmissionDetails(uint256 submissionId) external view returns (CleanupSubmission memory) {
        if (submissionId >= submissionCount) revert SUBMISSION__SubmissionNotFound(submissionId);
        return submissions[submissionId];
    }
    
    /**
     * @dev Get Hypercert eligibility for a user
     * @param user The user address to check
     * @return cleanupCount Total number of approved cleanups
     * @return hypercertCount Number of Hypercerts eligible for
     * @return isEligible Whether user is currently eligible to mint
     */
    function getHypercertEligibility(address user) external view returns (
        uint256 cleanupCount,
        uint256 hypercertCount,
        bool isEligible
    ) {
        cleanupCount = userCleanupCount[user];
        hypercertCount = userHypercertCount[user];
        isEligible = cleanupCount % 10 == 0 && cleanupCount > 0;
    }
    
    /**
     * @dev Get a batch of submissions for pagination
     * @param startIndex The starting index
     * @param batchSize The number of submissions to return
     * @return Submission[] An array of submissions
     */
    function getSubmissionBatch(uint256 startIndex, uint256 batchSize) 
        external 
        view 
        returns (CleanupSubmission[] memory) 
    {
        uint256 endIndex = startIndex + batchSize;
        
        // Ensure we don't go past the end of the submissions
        if (endIndex > submissionCount) {
            endIndex = submissionCount;
        }
        
        // Calculate actual batch size
        uint256 resultSize = endIndex - startIndex;
        CleanupSubmission[] memory result = new CleanupSubmission[](resultSize);
        
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = submissions[startIndex + i];
        }
        
        return result;
    }
} 