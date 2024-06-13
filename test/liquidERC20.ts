import chai from "chai";

import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import {
  deployContracts,
  deployERC20A,
  deployLiquidERC20,
  deployLiquidNFT,
  randi,
} from "../test-utils";
import {
  TestERC20A,
  TestERC20B,
  TestERC20C,
  LiquidInfrastructureNFT,
  LiquidInfrastructureERC20,
} from "../typechain-types/contracts";
import { ERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = chai;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE_ETH = 1000000000000000000;

// This test makes assertions about the LiquidInfrastructureERC20 contract by running it on hardhat
//
// Important test details:
// Contract interactions happen via hardhat-ethers: https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-ethers
// Chai is used to make assertions https://www.chaijs.com/api/bdd/
// Ethereum-waffle is used to extend chai and add ethereum matchers: https://ethereum-waffle.readthedocs.io/en/latest/matchers.html

import {AddressLike, assert, BigNumberish} from "ethers";
import {BigNumber} from "bignumber.js";

const PRECISION = 100000000
const PRECISION_BN = BigNumber(PRECISION)
export const Q_64 = BigNumber(2).pow(64);
export const Q_128 = BigNumber(2).pow(128);
export const ZERO_ADDR = "0x0000000000000000000000000000000000000000"

export function toQ64 (val: number | BigNumber): bigint {
    var multFixed: BigNumber;
    if (typeof val === 'number') {
        multFixed = BigNumber(Math.round(val * PRECISION));
    } else {
        multFixed = val.times(PRECISION);
    }
    let res = (multFixed.times(Q_64).div(BigNumber(PRECISION)))
    return BigInt(res.toFixed())
}

export function fromQ64 (val: bigint): BigNumber {
    return BigNumber(val.toString()).times(PRECISION_BN).div(Q_64).div(PRECISION_BN);
}

describe('TestLiquidERC20', () => {
   let token: LiquidInfrastructureERC20
   let signers: HardhatEthersSigner[]
   let holderAddresses: AddressLike[]
   let erc20s: ERC20[]
   let acceptableError = 0.001 // 0.1% error
   const Q64_MIN = BigNumber(2).pow(63).minus(1).negated();
   const oneEth  = BigNumber(10).pow(18);
   const TT64  = BigNumber(2).pow(64);
   const TT128 = BigNumber(2).pow(128);
   const TT192 = BigNumber(2).pow(192);

   beforeEach("deploy", async () => {
      signers = await ethers.getSigners();
      let tokens = await deployContracts(signers[0]);
      erc20s = [tokens.testERC20A, tokens.testERC20B, tokens.testERC20C];

      const libFactory = await ethers.getContractFactory("LiquidInfrastructureERC20");
      holderAddresses = signers.map((v) => v.address);
      let distributable = await erc20s.map(async (v) => await v.getAddress())
      token = (await libFactory.deploy("Infra", "INFRA", holderAddresses, distributable)) as unknown as LiquidInfrastructureERC20;
   })

   it("Simple Revenue Claim", async () => {
      let deployer = signers[0];
      let numNFTs = randi(25) + 1;
      let nfts = await deployLiquidNFTs(deployer, numNFTs, erc20s, erc20s.map((v) => 0));
      await manageNFTs(deployer, token, nfts, true);

      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], erc20s.map((v) => 1000000));

      await mintToHolders(deployer, token, holderAddresses, holderAddresses.map((v) => randi(1000000) + 1));

      await stakeFromHolders(signers, token);

      await token.withdrawFromAllManagedNFTs();

      await claimRevenue(signers, token);
   });

   it("Revenue Claim with Accounting", async () => {
      let deployer = signers[0];
      let numNFTs = randi(25) + 1;
      let nfts = await deployLiquidNFTs(deployer, numNFTs, erc20s, erc20s.map((v) => 0));
      await manageNFTs(deployer, token, nfts, true);

      let nftRevenueByERC20 = erc20s.map((v) => 1000000);
      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], nftRevenueByERC20);
      let totalRevenueByERC20 = nftRevenueByERC20.map((v) => v * numNFTs);

      let stakeByHolder = holderAddresses.map((v) => randi(1000000) + 1);
      let totalStake = stakeByHolder.reduce((a, b) => a + b, 0);
      await mintToHolders(deployer, token, holderAddresses, stakeByHolder);
      
      let revenueByHolder = stakeByHolder.map((v) => totalRevenueByERC20.map((w) => Math.floor(v * w / totalStake)));

      await stakeFromHolders(signers, token);

      await token.withdrawFromAllManagedNFTs();


      let balanceBySignerBefore = await getSignerBalances(signers, erc20s);
      await claimRevenue(signers, token);
      let balanceBySignerAfter = await getSignerBalances(signers, erc20s);

      for (let i = 0; i < signers.length; i++) {
        for (let j = 0; j < erc20s.length; j++) {
          let before = balanceBySignerBefore[i][j];
          let after = balanceBySignerAfter[i][j];
          let rev = revenueByHolder[i][j];
          expect(before.plus(rev).eq(after)).to.be.true;
        }
      }
   });

   it("Add Distributable ERC20", async () => {
      let deployer = signers[0];
      let newDistributable = await deployERC20A(deployer);


      let numNFTs = randi(25) + 1;
      let nfts = await deployLiquidNFTs(deployer, numNFTs, erc20s, erc20s.map((v) => 0));
      await manageNFTs(deployer, token, nfts, true);
      let nftRevenueByERC20 = erc20s.map((v) => 1000000);

      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], nftRevenueByERC20);
      await fundNFTs(deployer, nfts, [newDistributable], [1000000]);
      let totalRevenueByERC20 = nftRevenueByERC20.map((v) => v * numNFTs);
      totalRevenueByERC20.push(1000000 * numNFTs)

      let stakeByHolder = holderAddresses.map((v) => randi(1000000) + 1);
      let totalStake = stakeByHolder.reduce((a, b) => a + b, 0);
      await mintToHolders(deployer, token, holderAddresses, stakeByHolder);
      
      let revenueByHolder = stakeByHolder.map((v) => totalRevenueByERC20.map((w) => BigNumber(Math.floor(v * w / totalStake))));
      await stakeFromHolders(signers, token);

      // Withdraw all the initial distributable ERC20s
      await token.withdrawFromAllManagedNFTs();

      // Fund the NFTs with the initial distributable ERC20s
      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], nftRevenueByERC20);

      // Update all NFT thresholds to include the new token
      for (let i = 0; i < nfts.length; i++) {
        let nft = nfts[i];
        let [thresholdTokens, thresholdAmounts] = await nft.getThresholds();
        let newToken = await newDistributable.getAddress();
        let thresholds = [...thresholdTokens, newToken];
        let amounts = [...thresholdAmounts, BigInt(0)];
        await token.setManagedNFTThresholds(await nft.getAddress(), thresholds, amounts);
      }
      // Add the new distributable token
      await token.addDistributableERC20(await newDistributable.getAddress());
      await token.withdrawFromAllManagedNFTs();

      let balanceBySignerBefore = await getSignerBalances(signers, erc20s);
      let newBalanceBefore = await getSignerBalances(signers, [newDistributable]);
      await claimRevenue(signers, token);
      let balanceBySignerAfter = await getSignerBalances(signers, erc20s);
      let newBalanceAfter = await getSignerBalances(signers, [newDistributable]);

      for (let i = 0; i < signers.length; i++) {
        // Tally the initial ERC20s
        let j = 0;
        for (j = 0; j < erc20s.length; j++) {
          let before = balanceBySignerBefore[i][j];
          let after = balanceBySignerAfter[i][j];
          let rev = revenueByHolder[i][j];
          let max_expected = before.plus(rev.times(2).times(1.01));
          let min_expected = before.plus(rev.times(2).times(0.99));
          // Revenue was distributed twice
          expect(after.gt(min_expected) && after.lt(max_expected)).to.be.true;
        }
        // Tally the new ERC20
        let before = newBalanceBefore[i][0];
        let after = newBalanceAfter[i][0];
        let rev = revenueByHolder[i][j];
        let max_expected = before.plus(rev.times(1.01));
        let min_expected = before.plus(rev.times(0.99));

        expect(after.gt(min_expected) && after.lt(max_expected)).to.be.true;
      }
   });


   it("BigNumber Simple Revenue Claim", async () => {
      let deployer = signers[0];
      let numNFTs = randi(25) + 1;
      let nfts = await deployLiquidNFTs(deployer, numNFTs, erc20s, erc20s.map((v) => 0));
      await manageNFTs(deployer, token, nfts, true);

      let revenuePerNFTByERC20 = erc20s.map((v) => BigNumber(1000000).times(oneEth));
      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], revenuePerNFTByERC20);

      let stakeByHolder = holderAddresses.map((v) => BigNumber(randi(1000000) + 1).times(oneEth));
      await mintToHolders(deployer, token, holderAddresses, stakeByHolder);

      await stakeFromHolders(signers, token);

      await token.withdrawFromAllManagedNFTs();

      await claimRevenue(signers, token);
   });

   it("BigNumberRevenue Claim z with Accounting", async () => {
      let deployer = signers[0];
      let numNFTs = randi(25) + 1;
      let nfts = await deployLiquidNFTs(deployer, numNFTs, erc20s, erc20s.map((v) => 0));
      await manageNFTs(deployer, token, nfts, true);

      let revenuePerNFTByERC20 = erc20s.map((v) => BigNumber(1000000).times(oneEth));
      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], revenuePerNFTByERC20);

      let stakeByHolder = holderAddresses.map((v) => BigNumber(randi(1000000) + 1).times(oneEth));
      await mintToHolders(deployer, token, holderAddresses, stakeByHolder);
      let totalStake = stakeByHolder.reduce((a, b) => a.plus(b), BigNumber(0));

      let totalRevenueByERC20 = revenuePerNFTByERC20.map((v) => v.times(numNFTs));
      let revenueByHolder = stakeByHolder.map((v) => totalRevenueByERC20.map((w) => v.times(w).div(totalStake).integerValue()));
      await stakeFromHolders(signers, token);

      await token.withdrawFromAllManagedNFTs();

      let balanceBySignerBefore = await getSignerBalances(signers, erc20s);
      await claimRevenue(signers, token);
      let balanceBySignerAfter = await getSignerBalances(signers, erc20s);

      for (let i = 0; i < signers.length; i++) {
        for (let j = 0; j < erc20s.length; j++) {
          let actualIncrease = BigNumber(balanceBySignerAfter[i][j]).minus(balanceBySignerBefore[i][j]);
          let acceptableIncrease = revenueByHolder[i][j].times(BigNumber(1).minus(acceptableError));
          expect(actualIncrease.gte(acceptableIncrease)).to.be.true;
        }
      }
   }).timeout(80000); // Increase the timeout to 80 seconds

   it("Many Stakers BigNumber Revenue Claim", async () => {
      let deployer = signers[0];
      let holders = await generateSigners(200, deployer);
      let holderAddresses = holders.map((v) => v.address);
      for (let holder of holderAddresses) {
        if (! await token.isApprovedHolder(holder)) {
          await token.approveHolder(holder);
        }
      }
      let numNFTs = randi(50) + 1;
      let nfts = await deployLiquidNFTs(deployer, numNFTs, erc20s, erc20s.map((v) => 0));
      await manageNFTs(deployer, token, nfts, true);

      let revenuePerNFTByERC20 = erc20s.map((v) => BigNumber(1000000).times(oneEth));
      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], revenuePerNFTByERC20);

      let stakeByHolder = holders.map((v) => BigNumber(randi(100000000) + 1).times(oneEth));
      await mintToHolders(deployer, token, holderAddresses, stakeByHolder);

      await stakeFromHolders(holders, token);

      await token.withdrawFromAllManagedNFTs();

      await claimRevenue(holders, token);
   }).timeout(120000); // Increase the timeout to 80 seconds

   it("BigNumber Three Phase Staking", async () => {
      let deployer = signers[0];
      let holders = await generateSigners(150, deployer);
      let holderAddresses = holders.map((v) => v.address);
      let firstWaveStakers = holders.slice(0, 50);
      let secondWaveStakers = holders.slice(50, 100);
      let thirdWaveStakers = holders.slice(100, 150);
      for (let holder of holderAddresses) {
        if (! await token.isApprovedHolder(holder)) {
          await token.approveHolder(holder);
        }
      }
      let numNFTs = randi(50) + 1;
      let nfts = await deployLiquidNFTs(deployer, numNFTs, erc20s, erc20s.map((v) => 0));
      await manageNFTs(deployer, token, nfts, true);
      let revenuePerNFTByERC20 = erc20s.map((v) => BigNumber(1000000).times(oneEth));
      let stakeByHolder = holders.map((v) => BigNumber(randi(100000000) + 1).times(oneEth));
      let firstWaveTotalStake = stakeByHolder.reduce((a, b, i) => a.plus(i < 50 ? b : 0), BigNumber(0));
      let secondWaveTotalStake = stakeByHolder.reduce((a, b, i) => a.plus(i < 100 && i > 49 ? b : 0), BigNumber(0));
      let thirdWaveTotalStake = stakeByHolder.reduce((a, b, i) => a.plus(i > 99  ? b : 0), BigNumber(0));
      // Minting to the holders can happen all at once since staking determines the revenue sharing
      await mintToHolders(deployer, token, holderAddresses, stakeByHolder);

      // First wave of revenue + staking
      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], revenuePerNFTByERC20);
      await stakeFromHolders(firstWaveStakers, token);
      await token.withdrawFromAllManagedNFTs();

      // Second wave
      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], revenuePerNFTByERC20);
      await stakeFromHolders(secondWaveStakers, token);
      await token.withdrawFromAllManagedNFTs();

      // Third wave
      await fundNFTs(deployer, nfts, erc20s as TestERC20A[], revenuePerNFTByERC20);
      await stakeFromHolders(thirdWaveStakers, token);
      await token.withdrawFromAllManagedNFTs();

      let balanceBySignerBefore = await getSignerBalances(holders, erc20s);
      await claimRevenue(holders, token);
      let balanceBySignerAfter = await getSignerBalances(holders, erc20s);

      // Check Third wave entitlement first (it's the simplest + smallest)
      for (let i = 100; i < 150; i++) {
        let totalRelevantStake = firstWaveTotalStake.plus(secondWaveTotalStake).plus(thirdWaveTotalStake);
        let expectedRevenueThird = revenuePerNFTByERC20.map((v) => stakeByHolder[i].times(v).div(totalRelevantStake));
        let acceptableRevenueThird = expectedRevenueThird.map((v) => v.times(1 - acceptableError));
        let actualRevenueThird = balanceBySignerAfter[i].map((v, j) => BigNumber(v).minus(balanceBySignerBefore[i][j]));
        actualRevenueThird.map((v, j) => expect(v.gte(acceptableRevenueThird[j])).to.be.true);
      }
      // Check second wave entitlement, which got payouts from the second and third waves
      for (let i = 50; i < 100; i++) {
        // Third wave payout
        let totalRelevantStake = firstWaveTotalStake.plus(secondWaveTotalStake).plus(thirdWaveTotalStake);
        let expectedRevenueThird = revenuePerNFTByERC20.map((v) => stakeByHolder[i].times(v).div(totalRelevantStake));
        // Second wave payout
        totalRelevantStake = firstWaveTotalStake.plus(secondWaveTotalStake);
        let expectedRevenueSecond = revenuePerNFTByERC20.map((v) => stakeByHolder[i].times(v).div(totalRelevantStake));

        let expectedRevenue = expectedRevenueSecond.map((v, j) => v.plus(expectedRevenueThird[j]));

        let acceptableRevenue = expectedRevenue.map((v) => v.times(1 - acceptableError));
        let actualRevenue = balanceBySignerAfter[i].map((v, j) => BigNumber(v).minus(balanceBySignerBefore[i][j]));
        actualRevenue.map((v, j) => expect(v.gte(acceptableRevenue[j])).to.be.true);

      }
      // Check first wave entitlement, which got payouts from all waves
      for (let i = 0; i < 50; i++) {
        // Third wave payout
        let totalRelevantStake = firstWaveTotalStake.plus(secondWaveTotalStake).plus(thirdWaveTotalStake);
        let expectedRevenueThird = revenuePerNFTByERC20.map((v) => stakeByHolder[i].times(v).div(totalRelevantStake));
        // Second wave payout
        totalRelevantStake = firstWaveTotalStake.plus(secondWaveTotalStake);
        let expectedRevenueSecond = revenuePerNFTByERC20.map((v) => stakeByHolder[i].times(v).div(totalRelevantStake));
        // Second wave payout
        totalRelevantStake = firstWaveTotalStake;
        let expectedRevenueFirst = revenuePerNFTByERC20.map((v) => stakeByHolder[i].times(v).div(totalRelevantStake));


        let expectedRevenue = expectedRevenueFirst.map((v, j) => v.plus(expectedRevenueSecond[j]).plus(expectedRevenueThird[j]));


        let acceptableRevenue = expectedRevenue.map((v) => v.times(1 - acceptableError));
        let actualRevenue = balanceBySignerAfter[i].map((v, j) => BigNumber(v).minus(balanceBySignerBefore[i][j]));
        actualRevenue.map((v, j) => expect(v.gte(acceptableRevenue[j])).to.be.true);
      }
   }).timeout(120000); // Increase the timeout to 80 seconds

   it("BigNumber Agent Staking", async () => {
      const start = Date.now();
      const three_minutes = 3 * 60 * 1000;
      const stakerActionsPerWithdrawal = 5;
      const ownerActionsPerWithdrawal = 2;
      let deployer = signers[0];
      let holders = await generateSigners(150, deployer);
      let holderAddresses = holders.map((v) => v.address);
      for (let holder of holderAddresses) {
        if (! await token.isApprovedHolder(holder)) {
          await token.approveHolder(holder);
        }
      }
      await fundNFTs(deployer, holderAddresses, erc20s as TestERC20A[], erc20s.map((v) => 1000000));
      let numNFTs = randi(50) + 1;
      let nfts = await deployLiquidNFTs(deployer, numNFTs, erc20s, erc20s.map((v) => 0));
      let initialManagedNFTs = randi(numNFTs) + 1;
      let initialStakers = randi(holders.length) + 1;

      type StakerData = {
        signer: HardhatEthersSigner;
        stake: BigNumber;
      };
      type NFTData = {
        nft: LiquidInfrastructureNFT;
        balances: BigNumber[];
        thresholds: BigNumber[];
      };
      type WithdrawalData = {
        totalStake: BigNumber;
        stakers: StakerData[];
        nfts: NFTData[];
        nftRemovals: NFTData[];
      };

      // Initialize the collection of withdrawal data
      let withdrawalData: WithdrawalData[] = [];
      withdrawalData.push({totalStake: BigNumber(0), stakers: new Array<StakerData>(initialStakers), nfts: new Array<NFTData>(initialManagedNFTs), nftRemovals: new Array<NFTData>()});
      await Promise.all(nfts.slice(0, initialManagedNFTs).map(async (n, i) => {
        await n.setApprovalForAll(await token.getAddress(), true);
        await token.addManagedNFT(await n.getAddress());
        withdrawalData[0].nfts[i] = {nft: n,  balances: erc20s.map((v) => BigNumber(0)), thresholds: erc20s.map((v) => BigNumber(0))};
      }));
      let startingStakers = holders.slice(0, initialStakers);
      let stakeAllocation = startingStakers.map((h) => BigNumber(randi(1000000)).times(oneEth));
      await mintToHolders(deployer, token, startingStakers, stakeAllocation);
      await stakeFromHolders(startingStakers, token);
      for (let i = 0; i < startingStakers.length; i++) {
        let staker = startingStakers[i];
        let stake = stakeAllocation[i];
        withdrawalData[0].stakers[i] = {signer: staker, stake: stake};
        withdrawalData[0].totalStake = withdrawalData[0].totalStake.plus(stake);
      }
      let unmanagedNFTs = nfts.slice(initialManagedNFTs, nfts.length);
      let unstakedHolders = holders.slice(initialStakers, holders.length);

      let holderBalancesBefore: BigNumber[][] = new Array<BigNumber[]>(holders.length);
      for (let h = 0; h < holders.length; h++) {
        let balances: BigNumber[] = new Array<BigNumber>(erc20s.length);
        for (let e = 0; e < erc20s.length; e++) {
          balances[e] = BigNumber((await erc20s[e].balanceOf(holders[h].address)).toString());
        }
        holderBalancesBefore[h] = balances;
      }

      let w = -1;
      while (Date.now() - start < three_minutes) {
        w += 1;
        console.log("Withdrawal " + w)
        for (let s = 0; s < stakerActionsPerWithdrawal; s++) {
          let action = randi(100);
          if (action < 10) {
            // 10% chance of skipping an action
            continue;
          } else if (action < 40 && unstakedHolders.length > 0) {
            // 30% chance of adding a new staker
            let newStaker = unstakedHolders.pop() as HardhatEthersSigner;
            let stake = BigNumber(randi(1000000)).times(oneEth);
            await mintToHolders(deployer, token, [newStaker.address], [stake]);
            await stakeFromHolders([newStaker], token);
            withdrawalData[w].stakers.push({signer: newStaker, stake: stake});
            withdrawalData[w].totalStake = withdrawalData[w].totalStake.plus(stake);
            console.log("Added staker " + newStaker.address + " with stake " + stake.toString());
          } else if (action < 70 && withdrawalData[w].stakers.length > 0) {
            // 30% chance of unstaking
            let unstaker = withdrawalData[w].stakers[withdrawalData[w].stakers.length - 1];
            let amount = unstaker.stake;
            if (amount.eq(BigNumber(0))) {
              // Cannot unstake from a staker with no stake
              continue;
            }
            await unstakeFromHolders([unstaker.signer], token);
            unstaker.stake = BigNumber(0);
            withdrawalData[w].totalStake = withdrawalData[w].totalStake.minus(amount);
          } else {
            // 30% chance of claiming revenue
            let claimer = withdrawalData[w].stakers[randi(withdrawalData[w].stakers.length)];
            if (claimer.stake.eq(BigNumber(0))) {
              // Cannot claim with no stake!
              continue;
            }
            // Claiming should not meaningfully affect their revenue over time, no need to store this specifically
            await token.connect(claimer.signer).claimRevenue();
          }
        }
        for (let o = 0; o < ownerActionsPerWithdrawal; o++) {
          let action = randi(100);
          if (action < 20 && unmanagedNFTs.length > 0) {
            // 20% chance of adding a new NFT
            let newNFT = unmanagedNFTs.pop() as LiquidInfrastructureNFT;
            await newNFT.setApprovalForAll(await token.getAddress(), true);
            await token.addManagedNFT(await newNFT.getAddress());
            withdrawalData[w].nfts.push({nft: newNFT, thresholds: erc20s.map((v) => BigNumber(0)), balances: erc20s.map((v) => BigNumber(0))});
          } else if (action < 40 && withdrawalData[w].nfts.length > 0) {
            // 20% chance of removing a NFT
            let nft = withdrawalData[w].nfts.pop() as NFTData;
            await token.releaseManagedNFT(await nft.nft.getAddress(), deployer.address);
            withdrawalData[w].nftRemovals.push(nft);
          } else if (action < 60 && withdrawalData[w].nfts.length > 0) {
            // 20% chance of changing thresholds
            let idx = randi(withdrawalData[w].nfts.length)
            let nft = withdrawalData[w].nfts[idx];
            let [es, thresholds] = await nft.nft.getThresholds();

            // JavaScript strangeness: if I just pass es and thresholds to the function, it will fail with 
            // the error "TypeError: Cannot assign to read only property '0' of object '[object Array]'"
            // so I pass [...<array>] to make a copy by first "spread"ing the array with ... and repacking the elements as a new array with []
            await token.setManagedNFTThresholds(await nft.nft.getAddress(), [...es], [...thresholds]);
          } else {
            // 40% chance of no special action
            continue;
          }
        }

        // Fund NFTs before withdrawal
        let funding = withdrawalData[w].nfts.map(v => BigNumber(randi(1000000) + 1).times(oneEth));
        let nftAddresses = await Promise.all(withdrawalData[w].nfts.map(async (v) => await v.nft.getAddress()));
        fundNFTs(deployer, nftAddresses, erc20s as TestERC20A[], funding);

        for (let i = 0; i < withdrawalData[w].nfts.length; i++) {
          withdrawalData[w].nfts[i].balances = await Promise.all(erc20s.map(async (v) => BigNumber(await v.balanceOf(await nftAddresses[i]).toString())));
          let [_, thresholds] = await withdrawalData[w].nfts[i].nft.getThresholds();
          withdrawalData[w].nfts[i].thresholds = thresholds.map((v) => BigNumber(v.toString()));
        }
        // Owner always withdraws at the end
        await token.withdrawFromAllManagedNFTs();

        // Initialize the next withdrawal data
        withdrawalData.push({totalStake: withdrawalData[w].totalStake, stakers: withdrawalData[w].stakers, nfts: withdrawalData[w].nfts, nftRemovals: []});
      }

      let holderBalancesAfter: BigNumber[][] = new Array<BigNumber[]>(holders.length);
      for (let h = 0; h < holders.length; h++) {
        let balances: BigNumber[] = new Array<BigNumber>(erc20s.length);
        for (let e = 0; e < erc20s.length; e++) {
          balances[e] = BigNumber((await erc20s[e].balanceOf(holders[h].address)).toString());
        }
        holderBalancesAfter[h] = balances;
      }

      // Tally the expected holder revenue
      let expectedHolderRevenue: {[key: string]: BigNumber[]} = {};
      holderAddresses.map((h) => expectedHolderRevenue[h] = erc20s.map((e) => BigNumber(0)));
      for (let w = 0; w < withdrawalData.length; w++) {
        // Check the balances of the stakers based on their behavior
        let expectedTotalRevenue: BigNumber[] = erc20s.map((v) => BigNumber(0));
        for (let nft of withdrawalData[w].nfts) {
          let revenue = nft.balances.map((v, i) => v.minus(nft.thresholds[i]));
          for (let i = 0; i < revenue.length; i++) {
            expectedTotalRevenue[i] = expectedTotalRevenue[i].plus(revenue[i]);
          }
        }

        let revenuePerStake = expectedTotalRevenue.map((v) => v.div(withdrawalData[w].totalStake));

        for (let staker of withdrawalData[w].stakers) {
          let expectedRevenue = revenuePerStake.map((v) => v.times(staker.stake));
          for (let i = 0; i < expectedRevenue.length; i++) {
            expectedHolderRevenue[staker.signer.address][i] = expectedHolderRevenue[staker.signer.address][i].plus(expectedRevenue[i]);
          }
        }
      }

      console.log("Asserting revenue delivery")

      for (let h = 0; h < holders.length; h++) {
        for (let e = 0; e < erc20s.length; e++) {
          let holderStartBal = holderBalancesBefore[h][e];
          let holderEndBal = holderBalancesAfter[h][e];
          let expectedRevenue = expectedHolderRevenue[holders[h].address][e];
          let actualIncrease = holderEndBal.minus(holderStartBal);

          let acceptableIncrease = expectedRevenue.times(1 - acceptableError);
          if (! actualIncrease.gte(acceptableIncrease)) {
            console.log("Holder: " + holders[h].address + " ERC20: " + await erc20s[e].getAddress() + " Expected: " + expectedRevenue.toFixed() + " Actual: " + actualIncrease.toFixed());
          }
          expect(actualIncrease.gte(acceptableIncrease)).to.be.true;
        }
      }
    }
  ).timeout(1000 * 60 * 8); // Increase the timeout to 8 minutes
  }
);

export async function deployLiquidNFTs(deployer: HardhatEthersSigner, num: number, thresholdERC20s: ERC20[], thresholdAmounts: number[]): Promise<LiquidInfrastructureNFT[]> {
  let nfts: LiquidInfrastructureNFT[] = [];
  for (let i = 0; i < num; i++) {
    let nft = await deployLiquidNFT(deployer);
    await nft.setThresholds(thresholdERC20s, thresholdAmounts);
    nfts.push(nft);
  }
  return nfts;
}

export async function manageNFTs(owner: HardhatEthersSigner, token: LiquidInfrastructureERC20, nfts: LiquidInfrastructureNFT[], add: boolean) {
  for (let i = 0; i < nfts.length; i++) {
    if (add) {
      await nfts[i].setApprovalForAll(await token.getAddress(), true);
      await token.addManagedNFT(await nfts[i].getAddress());
    } else {
      await token.releaseManagedNFT(await nfts[i].getAddress(), owner.address);
    }
  }
}

export async function fundNFTs(funder: HardhatEthersSigner, nfts: AddressLike[], erc20s: TestERC20A[], amounts: number[] | BigNumber[] ) {
  for (let i = 0; i < nfts.length; i++) {
    for (let j = 0; j < erc20s.length; j++) {
      let erc20 = erc20s[j].connect(funder);
      let amount = amounts[j]
      if (amount instanceof BigNumber) {
        await erc20.mint(nfts[i], BigInt(amount.integerValue().toFixed()));
      } else {
        await erc20.mint(nfts[i], amount);
      }
    }
  }
}

export async function mintToHolders(owner: HardhatEthersSigner, token: LiquidInfrastructureERC20, holders: AddressLike[], amounts: number[] | BigNumber[]) {
  expect(holders.length == amounts.length).to.be.true;
  for (let i = 0; i < holders.length; i++) {
    let amount = amounts[i];
    if (amount instanceof BigNumber) {
      await token.mint(holders[i], BigInt(amount.integerValue().toFixed()));
    } else {
      await token.mint(holders[i], amount);
    }
  }
}

export async function stakeFromHolders(holders: HardhatEthersSigner[], token: LiquidInfrastructureERC20) {
  for (let i = 0; i < holders.length; i++) {
    let holder = holders[i];
    let t = token.connect(holders[i]);
    let balance = await t.balanceOf(holder.address);
    expect(balance > 0).to.be.true;
    await t.approve(await token.getAddress(), balance);
    let allowance = await t.allowance(holder.address, await token.getAddress());
    expect(allowance == balance).to.be.true;
    await t.stake(balance);
  }
}

export async function unstakeFromHolders(unstakers: HardhatEthersSigner[], token: LiquidInfrastructureERC20) {
  for (let i = 0; i < unstakers.length; i++) {
    let unstaker = unstakers[i];
    let t = token.connect(unstakers[i]);
    let stake = await t.getStake(unstaker.address);
    expect(stake > 0).to.be.true;
    await t.unstake();
  }
}
export async function claimRevenue(stakers: HardhatEthersSigner[], token: LiquidInfrastructureERC20) {
  for (let staker of stakers) {
    let t = token.connect(staker);
    await t.claimRevenue();
  }
}

export async function getSignerBalances(signers: HardhatEthersSigner[], erc20s: ERC20[]): Promise<BigNumber[][]> {
  let balances: BigNumber[][] = [];
  for (let signer of signers) {
    let signerBalances: BigNumber[] = [];
    for (let erc20 of erc20s) {
      let balance = await erc20.balanceOf(signer.address);
      signerBalances.push(BigNumber(balance.toString()));
    }
    balances.push(signerBalances);
  }
  return balances;
}

export async function generateSigners(num: number, funder: HardhatEthersSigner): Promise<HardhatEthersSigner[]> {
  let signers: HardhatEthersSigner[] = [];
  for (let i = 0; i < num; i++) {
    let wallet = ethers.Wallet.createRandom();
    wallet.connect(ethers.provider);
    let signer = await ethers.getImpersonatedSigner(wallet.address);
    signers.push(signer);
    funder.sendTransaction({from: funder.address, to: signer.address, value: BigNumber(ONE_ETH).times(5).toFixed()});
  }
  return signers;
}
