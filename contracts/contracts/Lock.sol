// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Lock {
    // Custom errors
    error LOCK__UnlockTimeNotInFuture(uint256 requestedTime, uint256 currentTime);
    error LOCK__WithdrawalTooEarly(uint256 unlockTime, uint256 currentTime);
    error LOCK__NotOwner(address caller, address owner);

    uint public unlockTime;
    address payable public owner;

    event Withdrawal(uint amount, uint when);

    constructor(uint _unlockTime) payable {
        if (block.timestamp >= _unlockTime) {
            revert LOCK__UnlockTimeNotInFuture(_unlockTime, block.timestamp);
        }

        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        // Uncomment this line, and the import of "hardhat/console.sol", to print a log in your terminal
        // console.log("Unlock time is %o and block timestamp is %o", unlockTime, block.timestamp);

        if (block.timestamp < unlockTime) {
            revert LOCK__WithdrawalTooEarly(unlockTime, block.timestamp);
        }
        
        if (msg.sender != owner) {
            revert LOCK__NotOwner(msg.sender, owner);
        }

        emit Withdrawal(address(this).balance, block.timestamp);

        owner.transfer(address(this).balance);
    }
}
