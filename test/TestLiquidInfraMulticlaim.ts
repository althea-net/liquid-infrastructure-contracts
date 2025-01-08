
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
  LiquidInfrastructureMulticlaim,
} from "../typechain-types/contracts";
import { ERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

const DEPLOYED_MULTICLAIM = "0x0000000000000000000000000000000000000000";
const DEPLOYED_ERC20s: string[] = [];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE_ETH = 1000000000000000000;

// This test makes assertions about the LiquidInfrastructureMulticall contract by running it on hardhat
//
// Important test details:
// Contract interactions happen via hardhat-ethers: https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-ethers
// Chai is used to make assertions https://www.chaijs.com/api/bdd/
// Ethereum-waffle is used to extend chai and add ethereum matchers: https://ethereum-waffle.readthedocs.io/en/latest/matchers.html

import { AddressLike, assert, BigNumberish } from "ethers";
import { BigNumber } from "bignumber.js";
import {zeroAddress} from "viem";
import {token} from "../typechain-types/factories/@openzeppelin/contracts";

const PRECISION = 100000000;
const PRECISION_BN = BigNumber(PRECISION);
export const Q_64 = BigNumber(2).pow(64);
export const Q_128 = BigNumber(2).pow(128);

export function toQ64(val: number | BigNumber): bigint {
  var multFixed: BigNumber;
  if (typeof val === "number") {
    multFixed = BigNumber(Math.round(val * PRECISION));
  } else {
    multFixed = val.times(PRECISION);
  }
  let res = multFixed.times(Q_64).div(BigNumber(PRECISION));
  return BigInt(res.toFixed());
}

export function fromQ64(val: bigint): BigNumber {
  return BigNumber(val.toString())
    .times(PRECISION_BN)
    .div(Q_64)
    .div(PRECISION_BN);
}

describe("TestLiquidInfraMulticlaim", () => {
  let multiclaim: LiquidInfrastructureMulticlaim;
  let multiclaimAddress: string;
  let tokens: LiquidInfrastructureERC20[] = [];
  let tokenAddressess: AddressLike[] = [];
  let signers: HardhatEthersSigner[];
  let holders: HardhatEthersSigner[] = [];
  let holderAddresses: AddressLike[];
  let erc20s: ERC20[];
  let acceptableError = 0.001; // 0.1% error
  const oneEth = BigNumber(10).pow(18);

  beforeEach("deploy", async () => {
    signers = await ethers.getSigners();
    let testERC20s = await deployContracts(signers[0]);
    erc20s = [
      testERC20s.testERC20A,
      testERC20s.testERC20B,
      testERC20s.testERC20C,
    ];

    const multiclaimFactory = await ethers.getContractFactory(
      "LiquidInfrastructureMulticlaim"
    );
    multiclaim = multiclaimFactory.attach(
      DEPLOYED_MULTICLAIM
    ) as unknown as LiquidInfrastructureMulticlaim;
    if ((await multiclaim.getDeployedCode()) == null) {
      multiclaim =
        (await multiclaimFactory.deploy()) as unknown as LiquidInfrastructureMulticlaim;
      multiclaimAddress = await multiclaim.getAddress();
      console.log("Deployed Multiclaim at ", multiclaimAddress);
    }

    holders = signers.slice(0, 10);
    holderAddresses = holders.map((v) => v.address);
    let distributable = await Promise.all(
      erc20s.map(async (v) => await v.getAddress())
    );

    const erc20Factory = await ethers.getContractFactory(
      "LiquidInfrastructureERC20"
    );
    if (DEPLOYED_ERC20s.length == 0) {
      let deployedErc20 = (await erc20Factory.deploy(
          "INFRA",
          "INFRA",
          zeroAddress,
          holderAddresses,
          distributable,
          multiclaimAddress
        )) as unknown as LiquidInfrastructureERC20;
        const erc20Address = await deployedErc20.getAddress();
        console.log("Deployed ERC20 at ", erc20Address);
        tokens.push(deployedErc20);
        tokenAddressess.push(erc20Address);
    } else {
      for (let token of DEPLOYED_ERC20s) {
        let deployedErc20 = erc20Factory.attach(
          token
        ) as unknown as LiquidInfrastructureERC20;
        if ((await deployedErc20.getDeployedCode()) == null) {
          deployedErc20 = (await erc20Factory.deploy(
            "INFRA",
            "INFRA",
            zeroAddress,
            holderAddresses,
            distributable,
            multiclaimAddress
          )) as unknown as LiquidInfrastructureERC20;
          const erc20Address = await deployedErc20.getAddress();
          console.log("Deployed ERC20 at ", erc20Address);
        }
        tokens.push(deployedErc20);
        tokenAddressess.push(await deployedErc20.getAddress());
      }
    }
    let deployer = signers[0];
    for (let token of tokens) {
      for (let holder of holderAddresses) {
        if (!(await token.isApprovedHolder(holder))) {
          await token.approveHolder(holder);
        }
      }
      let numNFTs = 1;
      let nfts = await deployLiquidNFTs(
        deployer,
        numNFTs,
        erc20s,
        erc20s.map((_) => 0)
      );

      await manageNFTs(deployer, token, nfts, true);

      await fundNFTs(
        deployer,
        nfts,
        erc20s as TestERC20A[],
        erc20s.map((v) => BigNumber(100).times(oneEth))
      );

      await mintToHolders(
        deployer,
        token,
        holderAddresses,
        holderAddresses.map((_) => BigNumber(randi(1000) + 1).times(oneEth))
      );

      await stakeFromHolders(signers, token);

      await token.withdrawFromAllManagedNFTs();
    }
  });

  it("Multi claim", async () => {
    // Perform a claim revenue for each signer on all the tokens
    for (let holder of holders) {
      let balances = await Promise.all(erc20s.map((v) => v.balanceOf(holder)));
      let totalBalances = balances.reduce(
        (a, b) => a.plus(b.toString()),
        BigNumber(0)
      );
      let estimations = await Promise.all(
        tokens.map((v) => v.estimateRevenueFor(holder))
      );
      let totalEstimation = estimations.reduce(
        (a, b) =>
          a.plus(BigNumber(b.reduce((c, d) => c + d, BigInt(0)).toString())),
        BigNumber(0)
      );
      let addresses = await Promise.all(tokens.map((v) => v.getAddress()));
      let claim = multiclaim.connect(holder);
      let firstToken = tokens[0];
      let firstTokenAddr = await firstToken.getAddress();

      expect(await claim.claimRevenueMulti(addresses)).to.emit(firstTokenAddr, "ClaimRevenue").withArgs(holder.address);

      for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        let remaining = await token.estimateRevenueFor(holder);
        let totalRemaining = remaining.reduce(
          (a, b) => a.plus(b.toString()),
          BigNumber(0)
        );
        expect(totalRemaining.eq(0)).to.be.true;
      }
      let postBalances = await Promise.all(
        erc20s.map((v) => v.balanceOf(holder))
      );
      let totalPostBalances = postBalances.reduce(
        (a, b) => a.plus(b.toString()),
        BigNumber(0)
      );

      expect(totalPostBalances.gt(totalBalances)).to.be.true;
      expect(totalPostBalances.minus(totalBalances).eq(totalEstimation)).to.be
        .true;
    }
  }).timeout(120000);
});

export async function deployLiquidNFTs(
  deployer: HardhatEthersSigner,
  num: number,
  thresholdERC20s: ERC20[],
  thresholdAmounts: number[]
): Promise<LiquidInfrastructureNFT[]> {
  console.log("Deploying %d Liquid NFTs", num);
  let nfts: LiquidInfrastructureNFT[] = [];
  for (let i = 0; i < num; i++) {
    let nft = await deployLiquidNFT(deployer);
    await nft.setThresholds(thresholdERC20s, thresholdAmounts);
    nfts.push(nft);
  }
  return nfts;
}

export async function manageNFTs(
  owner: HardhatEthersSigner,
  token: LiquidInfrastructureERC20,
  nfts: LiquidInfrastructureNFT[],
  add: boolean
) {
  for (let i = 0; i < nfts.length; i++) {
    if (add) {
      await nfts[i].setApprovalForAll(await token.getAddress(), true);
      await token.addManagedNFT(await nfts[i].getAddress());
    } else {
      await token.releaseManagedNFT(await nfts[i].getAddress(), owner.address);
    }
  }
}

export async function fundNFTs(
  funder: HardhatEthersSigner,
  nfts: AddressLike[],
  erc20s: TestERC20A[],
  amounts: number[] | BigNumber[]
) {
  for (let i = 0; i < nfts.length; i++) {
    for (let j = 0; j < erc20s.length; j++) {
      let erc20 = erc20s[j].connect(funder);
      let amount = amounts[j];
      if (amount instanceof BigNumber) {
        await erc20.mint(nfts[i], BigInt(amount.integerValue().toFixed()));
      } else {
        await erc20.mint(nfts[i], amount);
      }
    }
  }
}

export async function mintToHolders(
  owner: HardhatEthersSigner,
  token: LiquidInfrastructureERC20,
  holders: AddressLike[],
  amounts: number[] | BigNumber[]
) {
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

export async function stakeFromHolders(
  holders: HardhatEthersSigner[],
  token: LiquidInfrastructureERC20
) {
  for (let i = 0; i < holders.length; i++) {
    let holder = holders[i];
    let t = token.connect(holders[i]);
    let balance = await t.balanceOf(holder.address);
    if (balance > 0) {
      await t.stake(balance);
    }
  }
}

export async function unstakeFromHolders(
  unstakers: HardhatEthersSigner[],
  token: LiquidInfrastructureERC20
) {
  for (let i = 0; i < unstakers.length; i++) {
    let unstaker = unstakers[i];
    let t = token.connect(unstakers[i]);
    let stake = await t.getStake(unstaker.address);
    expect(stake > 0).to.be.true;
    await t.unstake(stake);
  }
}
export async function claimRevenue(
  stakers: HardhatEthersSigner[],
  token: LiquidInfrastructureERC20
) {
  for (let staker of stakers) {
    let t = token.connect(staker);
    await t.claimRevenue();
  }
}

export async function getSignerBalances(
  signers: HardhatEthersSigner[],
  erc20s: ERC20[]
): Promise<BigNumber[][]> {
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

export async function generateSigners(
  num: number,
  funder: HardhatEthersSigner
): Promise<HardhatEthersSigner[]> {
  let signers: HardhatEthersSigner[] = [];
  for (let i = 0; i < num; i++) {
    let wallet = ethers.Wallet.createRandom();
    wallet.connect(ethers.provider);
    let signer = await ethers.getImpersonatedSigner(wallet.address);
    signers.push(signer);
    funder.sendTransaction({
      from: funder.address,
      to: signer.address,
      value: BigNumber(ONE_ETH).times(5).toFixed(),
    });
  }
  return signers;
}
