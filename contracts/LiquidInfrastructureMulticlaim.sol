//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.19; // Force solidity compliance

import "./LiquidInfrastructureERC20.sol";

contract LiquidInfrastructureMulticlaim {
    /// @notice Claim revenue on each of the targets, enabling many claims in a single transaction
    /// @dev This contract must be passed to the ERC20's constructor for the claimRevenueFor() call to work
    function claimRevenueMulti(address[] calldata targets) public {
        for (uint i = 0; i < targets.length; i++) {
            // claimRevenueFor must have this Multiclaim contract whitelisted to work
            LiquidInfrastructureERC20(targets[i]).claimRevenueFor(msg.sender);
        }
    }
}