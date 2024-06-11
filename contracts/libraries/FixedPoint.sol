// This library is derived from the ambient FixedPoint library, with some minor changes for clarity and safety

// SPDX-License-Identifier: GPL-3
pragma solidity 0.8.19;

import "hardhat/console.sol";

/// @title FixedPoint128
/// @notice A library for handling binary fixed point numbers, see https://en.wikipedia.org/wiki/Q_(number_format)
/// @dev the numbers expected as input to these functions are representation of fixed point fractional numbers,
///      denoted by Qy or Qx.y where the least significant y bits represent the fractional part and the most
///      significant x bits (or the remaining bits) represent the whole part 
///      the simplest way to create one from an integer is to left shift by y. To convert back to an integer right shift by y
library FixedPoint {
    /// @notice A Q64.64 fixed point number, encoded as a uint128 where
    /// the most significant 64 bits are the whole part and the least significant 64 bits are the fractional part
    struct q64x64 {
        uint128 value;
    }

    /// @notice Converts a Q64.64 fixed point number to an integer (uint64)
    /// @dev this truncates the fractional part of the number by right shifting
    function toUint(q64x64 memory x) internal pure returns (uint64) {
        return uint64(x.value >> 64);
    }
    /// @notice Converts an integer (uint64) to a Q64.64 fixed point number
    /// @dev the conversion is to left shift by 64, which is the same as multiplying by 2^64
    function toQ64x64(uint64 x) internal pure returns (q64x64 memory) {
        return q64x64(uint128(x) << 64);
    }
    /// @notice Converts a Q64.64 fixed point number to a Q128.64 fixed point number
    /// @dev no shifting happens here, just recast the internal value and pass to the new struct
    function toQ128x64(q64x64 memory x) internal pure returns (q128x64 memory) {
        return q128x64(uint192(x.value));
    }

    /// @notice A Q128.64 fixed point number, encoded as a uint192 where
    /// the most significant 128 bits are the whole part and the least significant 64 bits are the fractional part
    struct q128x64 {
        uint192 value;
    }

    /// @notice Converts a Q128.64 fixed point number to an integer (uint64)
    /// @dev this truncates the fractional part of the number by right shifting
    function toUint(q128x64 memory x) internal pure returns (uint128) {
        return uint128(x.value >> 64);
    }
    /// @notice Converts an integer (uint128) to a Q128.64 fixed point number
    /// @dev the conversion is to left shift by 64, which is the same as multiplying by 2^64
    function toQ128x64(uint128 x) internal pure returns (q128x64 memory) {
        return q128x64(uint192(x) << 64);
    }
    /// @notice Converts an integer (uint256) to a Q128.64 fixed point number, the integer must be within range
    /// @dev the conversion is to left shift by 64, which is the same as multiplying by 2^64
    function toQ128x64(uint256 x) internal pure returns (q128x64 memory) {
        require(x <= type(uint128).max, "FixedPoint: too large");
        return q128x64(uint192(x) << 64);
    }

    /// @notice A Q192.64 fixed point number, encoded as a uint256 where
    /// the most significant 192 bits are the whole part and the least significant 64 bits are the fractional part
    struct q192x64 {
        uint256 value;
    }

    /// @notice Converts a Q128.64 fixed point number to an integer (uint64)
    /// @dev this truncates the fractional part of the number by right shifting
    function toUint(q192x64 memory x) internal pure returns (uint192) {
        return uint192(x.value >> 64);
    }
    /// @notice Converts an integer (uint192) to a Q192.64 fixed point number
    /// @dev the conversion is to left shift by 64, which is the same as multiplying by 2^64
    function toQ192x64(uint192 x) internal pure returns (q192x64 memory) {
        return q192x64(uint256(x) << 64);
    }
    /// @notice Converts a Q192.64 fixed point number to a Q128.64 fixed point number, reverts if x is too large
    function toQ128x64(q192x64 memory x) internal pure returns (q128x64 memory) {
        require(x.value <= type(uint192).max, "FixedPoint: too large");
        return q128x64(uint192(x.value));
    }

    /// @notice Adds two Q64.64 numbers together
    /// @param x A Q64.64 number, where the least significant 64 bits represent the fractional part and the most significant 64 bits represent the whole part
    /// @param y A Q64.64 number, where the least significant 64 bits represent the fractional part and the most significant 64 bits represent the whole part
    /// @return The result of x + y, as a Q64.64 number
    function addQ64 (q64x64 memory x, q64x64 memory y) internal pure returns (q64x64 memory) {
        return q64x64(x.value + y.value);
    }

    /// @notice Subtracts one Q64.64 number from another
    /// @param x A Q64.64 number, where the least significant 64 bits represent the fractional part and the most significant 64 bits represent the whole part
    /// @param y A Q64.64 number, where the least significant 64 bits represent the fractional part and the most significant 64 bits represent the whole part
    /// @return The result of x - y, as a Q64.64 number
    function subQ64 (q64x64 memory x, q64x64 memory y) internal pure returns (q64x64 memory) {
        return q64x64(x.value - y.value);
    }

    /// @notice Multiplies two Q64.64 numbers by each other.
    /// @dev We right shift by 64 to truncate the fractional part of the result to 64 bits, rounding is not done
    /// @param x A Q64.64 number, where the least significant 64 bits represent the fractional part and the most significant 64 bits represent the whole part
    /// @param y A Q64.64 number, where the least significant 64 bits represent the fractional part and the most significant 64 bits represent the whole part
    /// @return The result of multiplying x and y, as a Q128.64 number
    function mulQ64 (q64x64 memory x, q64x64 memory y) internal pure returns (q128x64 memory) {
        // By treating as a uint256 before shifting, overflow is prevented
        // shifting preserves the expected radix point locaiton (64 bits of fractional precision)
        // (before shifting we have 128 bits of fractional precision stored in a uint256)
        return q128x64(uint192(uint256(x.value) * uint256(y.value) >> 64));
    }

    /// @notice Divides one Q64.64 number by another.
    /// @dev We left shift by 64 first to account for the movement of the radix point during division to preserve the fractional part of the result
    /// @param x A Q64.64 number, where the least significant 64 bits represent the fractional part and the most significant 64 bits represent the whole part
    /// @param y A Q64.64 number, where the least significant 64 bits represent the fractional part and the most significant 64 bits represent the whole part
    /// @return The result of dividing x by y, as a Q128.64 number
    function divQ64 (q64x64 memory x, q64x64 memory y) internal pure returns (q128x64 memory) {
        return q128x64((uint192(x.value) << 64) / y.value);
    }

    /// @notice Adds two Q128.64 numbers together
    /// @param x A Q128.64 number, where the least significant 64 bits represent the fractional part and the most significant 128 bits represent the whole part
    /// @param y A Q128.64 number, where the least significant 64 bits represent the fractional part and the most significant 128 bits represent the whole part
    /// @return The result of x + y, as a Q128.64 number
    function addQ128 (q128x64 memory x, q128x64 memory y) internal pure returns (q128x64 memory) {
        return q128x64(x.value + y.value);
    }

    /// @notice Subtracts one Q128.64 number from another
    /// @param x A Q128.64 number, where the least significant 64 bits represent the fractional part and the most significant 128 bits represent the whole part
    /// @param y A Q128.64 number, where the least significant 64 bits represent the fractional part and the most significant 128 bits represent the whole part
    /// @return The result of x - y, as a Q128.64 number
    function subQ128 (q128x64 memory x, q128x64 memory y) internal pure returns (q128x64 memory) {
        return q128x64(x.value - y.value);
    }

    /// @notice Multiplies two Q128.64 numbers by each other.
    /// @dev We right shift by 64 to truncate the fractional part of the result to 64 bits, rounding is not done
    /// @param x A Q128.64 number, where the least significant 64 bits represent the fractional part and the most significant 128 bits represent the whole part
    /// @param y A Q128.64 number, where the least significant 64 bits represent the fractional part and the most significant 128 bits represent the whole part
    /// @return The result of multiplying x and y, as a Q192.64 number
    function mulQ128 (q128x64 memory x, q128x64 memory y) internal pure returns (q192x64 memory) {
        // Here there's the potential for overflow, so we separate out the whole and fractional parts to prevent it
        // With x = xw + xf and y = yw + yf, with xw, yw the whole parts and xf, yf the fractional parts
        // x * y = (xw + xf) * (yw + yf) = xw*yw + xw*yf + yw*xf + xf*yf
        uint256 xw = uint256(x.value >> 64);
        uint256 xf = uint64(uint192(x.value << 128) >> 128);
        uint256 yw = uint256(y.value >> 64);
        uint256 yf = uint64(uint192(y.value << 128) >> 128);
        uint256 work = xw * yw << 64;
        work += xw * yf;
        work += xf * yw;
        work += (xf * yf) >> 64;

        return q192x64(work);
    }

    /// @notice Divides one Q128.64 number by another
    /// @dev We left shift by 64 first to account for the movement of the radix point during division to preserve the fractional part of the result
    /// @param x A Q128.64 number, where the least significant 64 bits represent the fractional part and the most significant 128 bits represent the whole part
    /// @param y A Q128.64 number, where the least significant 64 bits represent the fractional part and the most significant 128 bits represent the whole part
    /// @return The result of dividing x by y, as a Q192.64 number
    function divQ128 (q128x64 memory x, q128x64 memory y) internal pure returns (q192x64 memory) {
        return q192x64((uint256(x.value) << 64) / y.value);
    }
}
