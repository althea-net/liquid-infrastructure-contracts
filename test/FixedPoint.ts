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
        multFixed = BN.BigNumber(Math.round(val * PRECISION));
    } else {
        multFixed = val.times(PRECISION);
    }
    let res = (multFixed.times(Q_64).div(BN.BigNumber(PRECISION)))
    return BigInt(res.toFixed())
}

export function fromQ64 (val: bigint): BN.BigNumber {
    return BN.BigNumber(val.toString()).times(PRECISION_BN).div(Q_64).div(PRECISION_BN);
}

describe('TestFixedMath', () => {
   let fixed: TestFixedPoint
   const Q64_MIN = BN.BigNumber(2).pow(63).minus(1).negated();
   const TT64  = BN.BigNumber(2).pow(64);
   const TT128 = BN.BigNumber(2).pow(128);
   const TT192 = BN.BigNumber(2).pow(192);

   beforeEach("deploy", async () => {
      const libFactory = await ethers.getContractFactory("TestFixedPoint");
      fixed = (await libFactory.deploy()) as unknown as TestFixedPoint;
   })

   it("mulQ64", async () => {
      let result = await fixed.testMulQ64(toQ64(3.5).toString(), toQ64(5.25).toString())
      let bn_fixed = fromQ64(result)
      let expected = 18.375
      let bn_expected = BN.BigNumber(expected)
      expect(bn_fixed.eq(bn_expected));

      bn_expected = TT64.minus(1)
      let bn_result = await fixed.testMulQ64(toQ64(2**63-1), toQ64(2.0))
      expect(fromQ64(bn_result).eq(bn_expected))
      
      let BI_TT128M1 = BigInt(TT128.minus(1).toFixed())

      result = await fixed.testMulQ64(BI_TT128M1, BI_TT128M1)
      console.log("Got [" + result + "] expected [" + TT128.minus(1).pow(2).toFixed() + "]");
      expect(fromQ64(result).eq(TT128.minus(1).pow(2)))

      result = await fixed.testMulQ64(toQ64(1), toQ64(2.0))
      expect(fromQ64(result).eq(2.0))
   })

   it("mulQ64 Precision", async () => {
      let result = await fixed.testMulQ64(BigInt(2)**BigInt(126), BigInt(2)**BigInt(127));
      expect(result).to.equal(BigInt(2)**BigInt(189));
   })

   it("divQ64", async () => {
      let result = await fixed.testDivQ64(toQ64(3.5), toQ64(0.125))
      expect(fromQ64(result).eq(28.0));
   })

   it("divQ64 Precision", async () => {
      let result = await fixed.testDivQ64(BigInt(2)**BigInt(126), BigInt(2)**BigInt(3));
      expect(fromQ64(result).eq(BN.BigNumber(2).pow(129)));
   })

   // This test still uses Q64 numbers, but JS doesn't share the same concept of fixed point numbers
   // that the solidity expects. So we pass Q64 numbers to the "Q128" functions
   it("mulQ128.64", async () => {
      console.log("3.5 * 5.25")
      let result = await fixed.testMulQ128(toQ64(3.5).toString(), toQ64(5.25).toString())
      let bn_fixed = fromQ64(result)
      let expected = 18.375
      let bn_expected = BN.BigNumber(expected)
      expect(bn_fixed.eq(bn_expected));

      console.log("((2^127)-1) * 2.0")
      bn_expected = TT128.minus(1)
      console.log("Calc expected")
      let x = (BN.BigNumber(2).pow(127)).minus(1);
      console.log("Calc x")
      let bn_result = await fixed.testMulQ128(toQ64(x), toQ64(2.0))
      console.log("bn result")
      expect(fromQ64(bn_result).eq(bn_expected))
      
      console.log("((2^128)-2) * ((2^128)-2)")
      let BI_TT192M1 = BigInt(TT192.minus(TT64).toFixed())
      console.log("Calculating ", BI_TT192M1, " ^ 2")
      result = await fixed.testMulQ128(BI_TT192M1, BI_TT192M1)
      console.log("Got [" + result + "] expected [" + TT128.minus(1).pow(2).toFixed() + "]");
      expect(fromQ64(result).eq(TT192.minus(1).pow(2)))

      result = await fixed.testMulQ128(toQ64(1), toQ64(2.0))
      expect(fromQ64(result).eq(2.0))
   })

   it("divQ128", async () => {
      console.log("10^18 / 0.25")
      let result = await fixed.testDivQ128(toQ64(10**18), toQ64(0.25))
      expect(fromQ64(result).eq(4 * 10**18));
      console.log("2^126 / 0.5")
      let x = (BN.BigNumber(2).pow(126));
      let y = 0.5;
      result = await fixed.testDivQ128(toQ64(x), toQ64(y))
      expect(fromQ64(result).eq(BN.BigNumber(2).pow(127)));
      x = (BN.BigNumber(2).pow(127).minus(1));
      console.log("2^127-1 / 0.5")
      result = await fixed.testDivQ128(toQ64(x), toQ64(y))
      expect(fromQ64(result).eq(BN.BigNumber(2).pow(128)));

      x = BN.BigNumber(1)
      y = 10000000000000000000000000
      result = await fixed.testDivQ128(toQ64(x), toQ64(y))
      expect(fromQ64(result).eq(BN.BigNumber(1).div(10000000000000000000000000)));

      y = 100000000000000000000000000000000000000
      result = await fixed.testDivQ128(toQ64(x), toQ64(y))
      expect(fromQ64(result).eq(BN.BigNumber(1).div(100000000000000000000000000000000000000)));
   })

})
