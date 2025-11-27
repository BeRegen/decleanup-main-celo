// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface INFTCollection {
    function mint(address to) external returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function hasMinted(address user) external view returns (bool);
    function rewardsContract() external view returns (address);
} 