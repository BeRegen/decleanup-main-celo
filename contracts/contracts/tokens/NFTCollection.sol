// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTCollection is ERC721, Ownable {
    uint256 private _tokenIdCounter;
    
    // Mapping to store mock balances for testing
    mapping(address => uint256) private mockBalances;
    
    constructor() ERC721("DCU NFT Collection", "DCUNFT") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    function mint(address to) external onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _tokenIdCounter++;
        return tokenId;
    }
    
    // Override balanceOf for testing purposes
    function balanceOf(address owner) public view override returns (uint256) {
        if (mockBalances[owner] > 0) {
            return mockBalances[owner];
        }
        return super.balanceOf(owner);
    }
    
    // Mock function for testing
    function mockBalanceOf(address owner, uint256 balance) external onlyOwner {
        mockBalances[owner] = balance;
    }
} 