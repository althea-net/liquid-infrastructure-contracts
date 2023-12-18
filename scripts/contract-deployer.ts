import { TestERC20A, TestERC20B, TestERC20C, LiquidInfrastructureERC20, LiquidInfrastructureNFT } from "../typechain-types";
import fs from "fs";
import commandLineArgs from "command-line-args";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { exit } from "process";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
const hardhat = require("hardhat");
const ethers = hardhat.ethers;

async function deploy() {
  var startTime = new Date();
  const signers = await ethers.getSigners()
  let wallet = signers[0];


  var success = false;
  while (!success) {
    var present = new Date();
    var timeDiff: number = present.getTime() - startTime.getTime();
    timeDiff = timeDiff / 1000
    try {
      const number = await ethers.provider.getBlockNumber();
      success = true;
    } catch (e) {
      console.log("Ethereum RPC error, trying again")
    }

    if (timeDiff > 600) {
      console.log("Could not contact Ethereum RPC after 10 minutes, check the URL!")
      exit(1)
    }
    await sleep(1000);
  }


  // this handles several possible locations for the ERC20 artifacts
  var erc20_a_path: string
  var erc20_b_path: string
  var erc20_c_path: string
  var liquid_nft_path: string
  var liquid_erc20_path: string

  const erc20_a_main = "/liquid/contracts/artifacts/contracts/TestERC20A.sol/TestERC20A.json"
  const erc20_b_main = "/liquid/contracts/artifacts/contracts/TestERC20B.sol/TestERC20B.json"
  const erc20_c_main = "/liquid/contracts/artifacts/contracts/TestERC20C.sol/TestERC20C.json"
  const liquid_nft_main = "/liquid/contracts/artifacts/contracts/LiquidInfrastructureNFT.sol/LiquidInfrastructureNFT.json"
  const liquid_erc20_main = "/liquid/contracts/artifacts/contracts/LiquidInfrastructureERC20.sol/LiquidInfrastructureERC20.json"

  const alt_location_1_a = "./artifacts/contracts/TestERC20A.sol/TestERC20A.json"
  const alt_location_1_b = "./artifacts/contracts/TestERC20B.sol/TestERC20B.json"
  const alt_location_1_c = "./artifacts/contracts/TestERC20C.sol/TestERC20C.json"
  const liquid_nft_alt_1 = "./artifacts/contracts/LiquidInfrastructureNFT.sol/LiquidInfrastructureNFT.json"
  const liquid_erc20_alt_1 = "./artifacts/contracts/LiquidInfrastructureERC20.sol/LiquidInfrastructureERC20.json"

  const alt_location_2_a = "TestERC20A.json"
  const alt_location_2_b = "TestERC20B.json"
  const alt_location_2_c = "TestERC20C.json"
  const liquid_nft_alt_2 = "LiquidInfrastructureNFT.json"
  const liquid_erc20_alt_2 = "LiquidInfrastructureERC20.json"

  if (fs.existsSync(erc20_a_main)) {
    erc20_a_path = erc20_a_main
    erc20_b_path = erc20_b_main
    erc20_c_path = erc20_c_main
    liquid_nft_path = liquid_nft_main
    liquid_erc20_path = liquid_erc20_main
  } else if (fs.existsSync(alt_location_1_a)) {
    erc20_a_path = alt_location_1_a
    erc20_b_path = alt_location_1_b
    erc20_c_path = alt_location_1_c
    liquid_nft_path = liquid_nft_alt_1
    liquid_erc20_path = liquid_erc20_alt_1
  } else if (fs.existsSync(alt_location_2_a)) {
    erc20_a_path = alt_location_2_a
    erc20_b_path = alt_location_2_b
    erc20_c_path = alt_location_2_c
    liquid_nft_path = liquid_nft_alt_2
    liquid_erc20_path = liquid_erc20_alt_2
  } else {
    console.log("Test mode was enabled but the ERC20 contracts can't be found!")
    exit(1)
  }


  const { abi: abiA, bytecode: bytecodeA } = getContractArtifacts(erc20_a_path);
  const erc20FactoryA = new ethers.ContractFactory(abiA, bytecodeA, wallet);
  const testERC20A = (await erc20FactoryA.deploy()) as TestERC20A;
  await testERC20A.waitForDeployment();
  const erc20TestAddressA = await testERC20A.getAddress();
  console.log("ERC20 deployed at Address - ", erc20TestAddressA);

  const { abi: abiB, bytecode: bytecodeB } = getContractArtifacts(erc20_b_path);
  const erc20FactoryB = new ethers.ContractFactory(abiB, bytecodeB, wallet);
  const testERC20B = (await erc20FactoryB.deploy()) as TestERC20B;
  await testERC20B.waitForDeployment();
  const erc20TestAddressB = await testERC20B.getAddress();
  console.log("ERC20 deployed at Address - ", erc20TestAddressB);

  const { abi: abiC, bytecode: bytecodeC } = getContractArtifacts(erc20_c_path);
  const erc20FactoryC = new ethers.ContractFactory(abiC, bytecodeC, wallet);
  const testERC20C = (await erc20FactoryC.deploy()) as TestERC20C;
  await testERC20C.waitForDeployment();
  const erc20TestAddressC = await testERC20C.getAddress();
  console.log("ERC20 deployed at Address - ", erc20TestAddressC);

  const liquidNFT = await ethers.deployContract("LiquidInfrastructureNFT", [wallet.address])
  await liquidNFT.waitForDeployment();
  const liquidNFTAddress = await liquidNFT.getAddress();
  console.log("LiquidInfrastructureNFT deployed at Address - ", liquidNFTAddress);

  const liquidERC20 = await ethers.deployContract("LiquidInfrastructureERC20", ["Infra", "INFRA", [], [], 100, [erc20TestAddressA, erc20TestAddressB, erc20TestAddressC]]);
  await liquidERC20.waitForDeployment();
  const liquidERC20Address = await liquidERC20.getAddress();
  console.log("LiquidInfrastructureERC20 deployed at Address - ", liquidERC20Address);

  exit(0);
}

function getContractArtifacts(path: string): { bytecode: string; abi: string } {
  var { bytecode, abi } = JSON.parse(fs.readFileSync(path, "utf8").toString());
  return { bytecode, abi };
}

async function main() {
  await deploy();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();