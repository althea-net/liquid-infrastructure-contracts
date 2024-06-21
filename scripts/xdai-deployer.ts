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

const WxDAI_address = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";
const LiquidNFTExpectedAddress = "0x053591ab6156B09ba722Fbc9520Fb7B1C31dA273";
const LiquidERC20ExpectedAddress = "0x0C885Ae5868E311A080789b620512Bd81e072F17";

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

  var liquid_nft_path: string;
  var liquid_erc20_path: string;

  const liquid_nft_main =
    "/liquid/contracts/artifacts/contracts/LiquidInfrastructureNFT.sol/LiquidInfrastructureNFT.json";
  const liquid_erc20_main =
    "/liquid/contracts/artifacts/contracts/LiquidInfrastructureERC20.sol/LiquidInfrastructureERC20.json";

  const liquid_nft_alt_1 =
    "./artifacts/contracts/LiquidInfrastructureNFT.sol/LiquidInfrastructureNFT.json";
  const liquid_erc20_alt_1 =
    "./artifacts/contracts/LiquidInfrastructureERC20.sol/LiquidInfrastructureERC20.json";

  const liquid_nft_alt_2 = "LiquidInfrastructureNFT.json";
  const liquid_erc20_alt_2 = "LiquidInfrastructureERC20.json";

  if (fs.existsSync(liquid_nft_main)) {
    liquid_nft_path = liquid_nft_main;
    liquid_erc20_path = liquid_erc20_main;
  } else if (fs.existsSync(liquid_nft_alt_1)) {
    liquid_nft_path = liquid_nft_alt_1;
    liquid_erc20_path = liquid_erc20_alt_1;
  } else if (fs.existsSync(liquid_nft_alt_2)) {
    liquid_nft_path = liquid_nft_alt_2;
    liquid_erc20_path = liquid_erc20_alt_2;
  } else {
    console.log(
      "Test mode was enabled but the ERC20 contracts can't be found!"
    );
    exit(1);
  }

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
  }

  let erc20Factory = await ethers.getContractFactory("ERC20");
  let WxDAI = erc20Factory.attach(WxDAI_address) as unknown as TestERC20B;

  // Generates multi-token activity
  // await generateActivity(
  //   wallet,
  //   contractsDeployed,
  //   [testERC20A, testERC20B, testERC20C],
  //   liquidNFT,
  //   liquidERC20
  // );

  // Generates single-token activity (testERC20A)
  await generateActivity(
    wallet,
    contractsDeployed,
    [WxDAI],
    liquidNFT,
    liquidERC20
  );

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
  erc20: LiquidInfrastructureERC20
) {
  console.log("Generating activity...");
  // Connect erc20s to owner to prevent silly errors
  for (let i = 0; i < erc20s.length; i++) {
    erc20s[i] = erc20s[i].connect(owner);
  }
  let signers: HardhatEthersSigner[] = await ethers.getSigners();
  let holders = signers.slice(1, 6);

  if (deployed) {
    console.log(
      "Contracts deployed, setting up the NFT to be managed by the ERC20"
    );
    await nft.setThresholds(
      erc20s,
      erc20s.map(() => 0)
    );
    // Transfer the NFT over to the ERC20
    await transferNftToErc20AndManage(erc20, nft, owner);
  }

  for (let holder of holders) {
    if (!(await erc20.isApprovedHolder(holder.address))) {
      console.log("Approving holder: ", holder.address);
      await erc20.approveHolder(holder.address);
    }
  }

  // Give the NFT a balance of each ERC20
  for (let e of erc20s) {
    console.log("Granting NFT some of the test erc20 tokens");
    let amount = Math.floor(Math.random() * 1000000) + 1000;
    let nft_address = await nft.getAddress();
    await e.transfer(nft_address as AddressLike, amount as BigNumberish);
  }

  if (deployed) {
    console.log("Contracts deployed, approving holders for the erc20");
    // Approve all the holders to hold the erc20
    for (let holder of holders) {
      await erc20.approveHolder(holder.address);
    }

    let holderAddresses = holders.map((h) => h.address);
    let holderAmounts = holders.map((_, i) => i * 100);
    await transferERC20ToHolders(erc20, holderAddresses, holderAmounts);
  }

  for (let i = 0; i < holders.length; i++) {
    let holder = holders[i];
    let t = erc20.connect(holder);
    let balance = await t.balanceOf(holder.address);
    await t.approve(await erc20.getAddress(), balance);
    // let allowance = await t.allowance(holder.address, await erc20.getAddress());
    await t.stake(balance);
  }

  console.log("Deploying a new NFT to manage with the ERC20");
  // Deploy a new NFT, set its thresholds, and manage it under the ERC20
  let newNFT = (await ethers.deployContract("LiquidInfrastructureNFT", [
    owner.address,
  ])) as unknown as LiquidInfrastructureNFT;
  await newNFT.waitForDeployment();
  console.log("New NFT deployed at Address - ", await newNFT.getAddress());
  console.log("Waiting for chain settlement");
  await sleep(10000);
  console.log("Setting new NFT's thresholds");
  await newNFT.setThresholds(
    erc20s,
    erc20s.map(() => 0)
  );
  console.log("Waiting for chain settlement");
  await sleep(10000);
  console.log("Transferring new NFT ownership to ERC20");
  await transferNftToErc20AndManage(erc20, newNFT, owner);
  console.log("Waiting for chain settlement");
  await sleep(10000); // wait 10 seconds
  // Grant newNFT it some tokens so they can be withdrawn by the ERC20
  for (let erc20 of erc20s) {
    console.log("Granting the new NFT some of the test erc20 tokens");
    const amount = Math.floor(Math.random() * 400000) + 10000;

    await erc20.transfer(await newNFT.getAddress(), amount);
  }

  console.log("Withdrawing...");
  await erc20.withdrawFromAllManagedNFTs();
  console.log(
    "Withdrawal on or before block: ",
    await owner.provider.getBlockNumber()
  );
  console.log();
  await sleep(10000); // wait 10 seconds

  console.log("Randomly claiming revenue from holders");
  for (let holder of holders) {
    if (Math.random() > 0.5) {
      console.log("Claiming revenue from holder: ", holder.address);
      await erc20.connect(holder).claimRevenue();
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
  await nft.transferFrom(owner, infraAddress, accountId);
  await sleep(10000);
  const nftAddress = await nft.getAddress();
  await erc20.addManagedNFT(nftAddress);
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
