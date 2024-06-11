import { expect } from "chai";
import { ethers } from 'hardhat';
import { TestFixedPoint } from "../typechain-types";
// import { BigNumber } from 'typescript-bignumber';
import {assert, BigNumberish} from "ethers";
import * as BN from "bignumber.js";

const PRECISION = 100000000
const PRECISION_BN = BN.BigNumber(PRECISION)
export const Q_64 = BN.BigNumber(2).pow(64);
export const Q_128 = BN.BigNumber(2).pow(128);
export const ZERO_ADDR = "0x0000000000000000000000000000000000000000"

export function toQ64 (val: number | BN.BigNumber): bigint {
    var multFixed: BN.BigNumber;
    if (typeof val === 'number') {
        multFixed = BN.BigNumber(val);
    } else {
        multFixed = val;
    }
    let res = (multFixed.times(Q_64).integerValue())
    return BigInt(res.toFixed())
}

export function fromQ64 (val: bigint): BN.BigNumber {
    return BN.BigNumber(val.toString()).div(Q_64);
}

describe('TestFixedMath', () => {
   let fixed: TestFixedPoint;
   const Q64_MIN = BN.BigNumber(2).pow(63).minus(1).negated();
   const TT64  = BN.BigNumber(2).pow(64);
   const TT128 = BN.BigNumber(2).pow(128);
   const TT192 = BN.BigNumber(2).pow(192);

   beforeEach("deploy", async () => {
      const libFactory = await ethers.getContractFactory("TestFixedPoint");
      fixed = (await libFactory.deploy()) as unknown as TestFixedPoint;
   })

   it("addQ64", async () => {
      let small = BigInt(1);
      let result = await(fixed.testAddQ64(small, small));
      expect(result).eq(BigInt(2));
   });

   it("mulQ64", async () => {
      let result = await fixed.testMulQ64(toQ64(3.5).toString(), toQ64(5.25).toString());
      let bn_fixed = fromQ64(result);
      let bn_expected = BN.BigNumber("18.375");
      expect(bn_fixed.eq(bn_expected)).to.be.true;

      bn_expected = BN.BigNumber("340282366920938463463374607431768211456"); // 2^63 * 2 before fromQ64()
      let bn_result = BN.BigNumber((await fixed.testMulQ64(toQ64((BN.BigNumber(2).pow(63))), toQ64(2))).toString());
      expect(bn_result.eq(bn_expected)).to.be.true;
      
      let BI_TT128M1 = BigInt(TT128.minus(1).toFixed());
      let BN_TT128M1 = TT128.minus(1);
      result = await fixed.testMulQ64(BI_TT128M1, BI_TT128M1);
      bn_expected = BN_TT128M1.times(BN_TT128M1).div(TT64).integerValue();
      expect(BN.BigNumber(result.toString()).eq(bn_expected)).to.be.true;

      result = await fixed.testMulQ64(toQ64(1), toQ64(2.0));
      expect(fromQ64(result).eq(2.0)).to.be.true;
   });

   it("mulQ64 Precision", async () => {
      let result = await fixed.testMulQ64(BigInt(2)**BigInt(126), BigInt(2)**BigInt(127));
      expect(result).to.equal(BigInt(2)**BigInt(189));
   });

   it("divQ64", async () => {
      let result = await fixed.testDivQ64(toQ64(3.5), toQ64(0.125));
      expect(fromQ64(result).eq(28.0)).to.be.true;
   });

   it("divQ64 Precision", async () => {
      let result = await fixed.testDivQ64(BigInt(2)**BigInt(126), BigInt(2)**BigInt(3));
      expect(fromQ64(result).eq(BN.BigNumber(2).pow(123))).to.be.true;
   });

   // This test still uses Q64 numbers, but JS doesn't share the same concept of fixed point numbers
   // that the solidity expects. So we pass Q64 numbers to the "Q128" functions
   it("mulQ128.64", async () => {
      let a = toQ64(2)
      let b = toQ64(2)
      let result = await fixed.testMulQ128(a, b);
      expect(fromQ64(result).eq(4)).to.be.true;

      let bn_expected = TT128;
      let x = (BN.BigNumber(2).pow(127));
      let bn_result = await fixed.testMulQ128(toQ64(x), toQ64(2.0));
      expect(fromQ64(bn_result).eq(bn_expected)).to.be.true;
      
      let target = BN.BigNumber(2).pow(191).minus(1);
      x = (BN.BigNumber(2).pow(124));
      let y = (target.div(x)); // Want x * y = 2^192 - 1
      let expected = x.times(y).integerValue();
      result = await fixed.testMulQ128(toQ64(x), toQ64(y));
      expect(fromQ64(result).eq(expected)).to.be.true;

      result = await fixed.testMulQ128(toQ64(1), toQ64(2.0));
      expect(fromQ64(result).eq(2.0)).to.be.true;

      x = BN.BigNumber(2).pow(128).minus(1)
      y = BN.BigNumber(1.0)
      expected = x.times(y).integerValue();
      result = await fixed.testMulQ128(toQ64(x), toQ64(y));
      expect(fromQ64(result).eq(expected)).to.be.true;
   });

   it("divQ128", async () => {
      let x = BN.BigNumber(18000000);
      let y = BN.BigNumber(80855071);
      let expected = BN.BigNumber("4106624225545135308");
      let result = await fixed.testDivQ128(toQ64(x), toQ64(y));
      expect(BN.BigNumber(result.toString()).eq(expected)).to.be.true;

      x = BN.BigNumber(10).pow(18);
      y = BN.BigNumber(1).div(4);
      result = await fixed.testDivQ128(toQ64(x), toQ64(y));
      expect(fromQ64(result).eq(4 * 10**18)).to.be.true;

      x = (BN.BigNumber(2).pow(126));
      y = BN.BigNumber(0.5);
      result = await fixed.testDivQ128(toQ64(x), toQ64(y));
      expect(fromQ64(result).eq(BN.BigNumber(2).pow(127))).to.be.true;

      x = (BN.BigNumber(2).pow(127));
      result = await fixed.testDivQ128(toQ64(x), toQ64(y));
      expect(fromQ64(result).eq(BN.BigNumber(2).pow(128))).to.be.true;

      x = BN.BigNumber(1);
      y = BN.BigNumber(10000000000000000000000000);
      result = await fixed.testDivQ128(toQ64(x), toQ64(y));
      expect(fromQ64(result).eq(BN.BigNumber(1).div(10000000000000000000000000))).to.be.true;

      y = BN.BigNumber(100000000000000000000000000000000000000);
      result = await fixed.testDivQ128(toQ64(x), toQ64(y));
      expect(fromQ64(result).eq(BN.BigNumber(1).div(100000000000000000000000000000000000000))).to.be.true;
   });

})
