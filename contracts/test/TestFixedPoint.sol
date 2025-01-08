// SPDX-License-Identifier: GPL-3
pragma solidity 0.8.28;
    
import "../libraries/FixedPoint.sol";

import "hardhat/console.sol";

/// @notice A test contract used to test the FixedPoint library, which cannot be used directly as it is a library
contract TestFixedPoint {
    function testAddQ64 (uint128 x, uint128 y) public pure returns (uint192) {
        return FixedPoint.addQ64(FixedPoint.q64x64(x), FixedPoint.q64x64(y)).value;
    }

    function testSubQ64 (uint128 x, uint128 y) public pure returns (uint192) {
        return FixedPoint.subQ64(FixedPoint.q64x64(x), FixedPoint.q64x64(y)).value;
    }

    function testMulQ64 (uint128 x, uint128 y) public pure returns (uint192) {
        return FixedPoint.mulQ64(FixedPoint.q64x64(x), FixedPoint.q64x64(y)).value;
    }

    function testDivQ64 (uint128 x, uint128 y) public pure returns (uint256) {
        return FixedPoint.divQ64(FixedPoint.q64x64(x), FixedPoint.q64x64(y)).value;
    }

    /// @notice this function has a bad name, it's still a Q64 number but it has 128 bits of whole number precision
    function testAddQ128 (uint192 x, uint192 y) public pure returns (uint256) {
        return FixedPoint.addQ128(FixedPoint.q128x64(x), FixedPoint.q128x64(y)).value;
    }

    /// @notice this function has a bad name, it's still a Q64 number but it has 128 bits of whole number precision
    function testSubQ128 (uint192 x, uint192 y) public pure returns (uint256) {
        return FixedPoint.subQ128(FixedPoint.q128x64(x), FixedPoint.q128x64(y)).value;
    }

    /// @notice this function has a bad name, it's still a Q64 number but it has 128 bits of whole number precision
    function testMulQ128 (uint192 x, uint192 y) public pure returns (uint256) {
        return FixedPoint.mulQ128(FixedPoint.q128x64(x), FixedPoint.q128x64(y)).value;
    }

    /// @notice this function has a bad name, it's still a Q64 number but it has 128 bits of whole number precision
    function testDivQ128 (uint192 x, uint192 y) public pure returns (uint256) {
        return FixedPoint.divQ128(FixedPoint.q128x64(x), FixedPoint.q128x64(y)).value;
    }
}
