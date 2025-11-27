// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IRewards
 * @dev Interface for reward distribution contract
 */
interface IRewards {
    /**
     * @dev Distributes DCU tokens to a user
     * @param user Address of the user to distribute tokens to
     * @param amount Amount of DCU tokens to distribute
     * @return success Whether the distribution was successful
     */
    function distributeDCU(address user, uint256 amount) external returns (bool);
} 