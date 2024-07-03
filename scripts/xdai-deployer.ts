import {
  TestERC20A,
  TestERC20B,
  TestERC20C,
  LiquidInfrastructureERC20,
  LiquidInfrastructureNFT,
  ERC20,
} from "../typechain-types";
import fs from "fs";
import commandLineArgs from "command-line-args";
import { exit } from "process";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { AddressLike, BigNumberish } from "ethers";

import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumber } from "bignumber.js";

const WxDAI_address = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";
const LiquidNFTExpectedAddress = "0x59ae6Db6e90488D645Cf0796a79C3A47b6B56ef5";
const LiquidERC20ExpectedAddress = "0x0000000000000000000000000000000000000000";

const oneEth = BigNumber(1000000000000000000);

async function deploy() {
  console.log("Enter deploy function");
  var startTime = new Date();
  const signers = await ethers.getSigners();
  let wallet = signers[0];
  console.log("Wallet address: ", wallet.address);

  var success = false;
  while (!success) {
    console.log("Looping until connection to network is made");
    var present = new Date();
    var timeDiff: number = present.getTime() - startTime.getTime();
    timeDiff = timeDiff / 1000;
    try {
      const number = await ethers.provider.getBlockNumber();
      success = true;
    } catch (e) {
      console.log("Ethereum RPC error, trying again");
    }

    if (timeDiff > 600) {
      console.log(
        "Could not contact Ethereum RPC after 10 minutes, check the URL!"
      );
      exit(1);
    }
    await sleep(1000);
  }
  console.log("Connected to network");

  let deployed;

  let liquidNFT: LiquidInfrastructureNFT;
  let liquidERC20: LiquidInfrastructureERC20;

  let contractsDeployed = false;

  let nftFactory = await ethers.getContractFactory("LiquidInfrastructureNFT");
  let lerc20Factory = await ethers.getContractFactory(
    "LiquidInfrastructureERC20"
  );
  let liquidNFTAddress;
  deployed = (await nftFactory.attach(
    LiquidNFTExpectedAddress
  )) as unknown as LiquidInfrastructureNFT;

  if ((await deployed.getDeployedCode()) != null) {
    liquidNFT = deployed;
    liquidNFTAddress = await liquidNFT.getAddress();
    console.log(
      "LiquidInfrastructureNFT found at Address - ",
      liquidNFTAddress
    );
  } else {
    contractsDeployed = true;
    liquidNFT = (await nftFactory.deploy(
      wallet.address
    )) as unknown as LiquidInfrastructureNFT;
    await liquidNFT.waitForDeployment();
    liquidNFTAddress = await liquidNFT.getAddress();
    console.log(
      "LiquidInfrastructureNFT deployed at Address - ",
      liquidNFTAddress
    );
    sleep(30000);
  }

  let liquidERC20Address;
  deployed = lerc20Factory.attach(
    LiquidERC20ExpectedAddress
  ) as unknown as LiquidInfrastructureERC20;

  if ((await deployed.getDeployedCode()) != null) {
    liquidERC20 = deployed;
    liquidERC20Address = await liquidERC20.getAddress();
    console.log(
      "LiquidInfrastructureERC20 found at Address - ",
      liquidERC20Address
    );
  } else {
    contractsDeployed = true;
    liquidERC20 = (await lerc20Factory.deploy(
      "Infra",
      "INFRA",
      [], // approved holders
      [WxDAI_address] // distributable erc20s
    )) as unknown as LiquidInfrastructureERC20;
    await liquidERC20.waitForDeployment();
    liquidERC20Address = await liquidERC20.getAddress();
    console.log(
      "LiquidInfrastructureERC20 deployed at Address - ",
      liquidERC20Address
    );
    sleep(30000);
  }

  let WxDAI = (await ethers.getContractAt(
    "TestERC20B",
    WxDAI_address,
    wallet
  )) as unknown as TestERC20B;

  let holderAddress = "0xF6ec240620aD5288028ad1F96D8725db0c838B90";
  let holderAllocation = BigNumber(1000).times(oneEth);

  let receipt;

  if (!(await liquidERC20.isApprovedHolder(holderAddress))) {
    console.log("Approving holder %s", holderAddress);
    receipt = await (await liquidERC20.approveHolder(holderAddress)).wait();
    console.assert(receipt?.blockNumber != null);
  }

  if (
    !(
      (await liquidERC20.balanceOf(holderAddress)) >=
      BigInt(holderAllocation.toFixed())
    )
  ) {
    console.log("Minting %s to holder %s", holderAllocation, holderAddress);
    receipt = await (
      await liquidERC20.mint(holderAddress, holderAllocation.toFixed())
    ).wait();
    console.assert(receipt?.blockNumber != null);
  }

  let nftOwnedByLToken =
    (await liquidNFT.ownerOf(1)) == (await liquidERC20.getAddress());
  if (!nftOwnedByLToken) {
    console.log(
      "NFT not owned by Liquid Infra token, setting up the NFT to be managed by the ERC20"
    );
    receipt = await (await liquidNFT.setThresholds([WxDAI], [0])).wait();
    console.assert(receipt?.blockNumber != null);

    // Transfer the NFT over to the ERC20
    await transferNftToErc20AndManage(liquidERC20, liquidNFT, wallet);
  }

  exit(0);
}

function getContractArtifacts(path: string): { bytecode: string; abi: string } {
  var { bytecode, abi } = JSON.parse(fs.readFileSync(path, "utf8").toString());
  return { bytecode, abi };
}

async function generateActivity(
  owner: HardhatEthersSigner,
  deployed: boolean,
  erc20s: TestERC20B[],
  nft: LiquidInfrastructureNFT,
  l_token: LiquidInfrastructureERC20
) {
  console.log("Generating activity...");
  // Connect erc20s to owner to prevent silly errors
  for (let i = 0; i < erc20s.length; i++) {
    erc20s[i] = erc20s[i].connect(owner);
  }
  let signers: HardhatEthersSigner[] = await ethers.getSigners();
  let holders = signers.slice(1, 6);

  let nftOwnedByLToken = (await nft.ownerOf(1)) == (await l_token.getAddress());
  if (!nftOwnedByLToken) {
    console.log(
      "NFT not owned by Liquid Infra token, setting up the NFT to be managed by the ERC20"
    );
    let receipt = await (
      await nft.setThresholds(
        erc20s,
        erc20s.map(() => 0)
      )
    ).wait();
    console.assert(receipt?.blockNumber != null);

    await sleep(30000);
    // Transfer the NFT over to the ERC20
    await transferNftToErc20AndManage(l_token, nft, owner);
    await sleep(30000);
  }

  // Approve any unapproved holders
  for (let holder of holders) {
    if (!(await l_token.isApprovedHolder(holder.address))) {
      console.log("Approving holder: ", holder.address);
      let receipt = await (await l_token.approveHolder(holder.address)).wait();
      console.assert(receipt?.blockNumber != null);
    }
  }

  // Give the NFT a balance of each ERC20
  for (let e of erc20s) {
    console.log("Granting NFT some of the test erc20 tokens");
    let amount = Math.floor(Math.random() * 1000000) + 1000;
    let nft_address = await nft.getAddress();
    let receipt = await (await e.transfer(nft_address, amount)).wait();
    console.assert(receipt?.blockNumber != null);
  }

  let holderAddresses = holders.map((h) => h.address);
  let holderAmounts = holders.map((_, i) => i * 100 + 100);
  let i = -1;
  for (let holder of holderAddresses) {
    i += 1;
    let bal = await l_token.balanceOf(holder);
    if (bal < holderAmounts[i]) {
      console.log("Minting tokens for holder: ", holder);
      let receipt = await (await l_token.mint(holder, holderAmounts[i])).wait();
      console.assert(receipt?.blockNumber != null);
    }
  }

  console.log("Staking from holders");
  for (let i = 0; i < holders.length; i++) {
    let holder = holders[i];
    let t = l_token.connect(holder);
    let balance = await l_token.balanceOf(holder.address);
    let pre_allowance = await t.allowance(holder.address, await t.getAddress());
    if (pre_allowance < balance) {
      let receipt = await (
        await t.approve(await l_token.getAddress(), balance)
      ).wait();
      console.assert(receipt?.blockNumber != null);
    }
    let allowance = await t.allowance(
      holder.address,
      await l_token.getAddress()
    );
    console.log(
      "Existing Allowance: %s, Balance: %s, Final Allowance",
      pre_allowance,
      balance,
      allowance
    );
    if (allowance >= balance) {
      console.log(
        "Staking %s tokens from ",
        balance.toString(),
        holder.address
      );
      let receipt = await (await t.stake(balance.toString())).wait();
      console.assert(receipt?.blockNumber != null);
    }
  }

  console.log("Withdrawing...");
  let receipt = await (await l_token.withdrawFromAllManagedNFTs()).wait();
  console.assert(receipt?.blockNumber != null);

  console.log(
    "Withdrawal on or before block: ",
    await owner.provider.getBlockNumber()
  );
  console.log();

  console.log("Randomly claiming revenue from holders");
  for (let holder of holders) {
    if (Math.random() > 0.5) {
      console.log("Claiming revenue from holder: ", holder.address);
      let receipt = await (await l_token.connect(holder).claimRevenue()).wait();
      console.assert(receipt?.blockNumber != null);
    }
  }
}

async function transferNftToErc20AndManage(
  erc20: LiquidInfrastructureERC20,
  nft: LiquidInfrastructureNFT,
  owner: HardhatEthersSigner
) {
  const infraAddress = await erc20.getAddress();
  const accountId = await nft.AccountId();
  let receipt;
  if (!((await nft.ownerOf(accountId)) == infraAddress)) {
    receipt = await (
      await nft.transferFrom(owner, infraAddress, accountId)
    ).wait();
    console.assert(receipt?.blockNumber != null);
  }
  const nftAddress = await nft.getAddress();
  receipt = await (await erc20.addManagedNFT(nftAddress)).wait();
  console.assert(receipt?.blockNumber != null);
}

async function transferERC20sToReceiver(
  erc20s: ERC20[],
  receiver: AddressLike,
  amount: BigNumberish
) {
  for (let erc20 of erc20s) {
    await erc20.transfer(await receiver, amount);
  }
}

async function transferERC20ToHolders(
  erc20: LiquidInfrastructureERC20,
  holders: AddressLike[],
  amounts: BigNumberish[]
) {
  if (holders.length != amounts.length) {
    throw new Error("Invalid holders and amounts lengths, they must match");
  }
  for (let i = 0; i < holders.length; i++) {
    let holder = holders[i];
    let amount = amounts[i];
    await erc20.mint(holder, amount);
  }
}

async function main() {
  await deploy();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
