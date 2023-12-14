import { TestERC20A, TestERC20B, TestERC20C, LiquidInfrastructureERC20, LiquidInfrastructureNFT } from "./typechain-types";
import { ethers } from "hardhat";
import fs from "fs";
import commandLineArgs from "command-line-args";
import { exit } from "process";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const args = commandLineArgs([
  // the ethernum node used to deploy the contract
  { name: "eth-node", type: String },
  // the Ethereum private key that will contain the gas required to pay for the contact deployment
  { name: "eth-privkey", type: String },
]);

async function deploy() {
  const provider = await new ethers.JsonRpcProvider(args["eth-node"]);
  let wallet = new ethers.Wallet(args["eth-privkey"], provider);

  var erc20_a_path = "/liquid/contracts/artifacts/contracts/TestERC20A.sol/TestERC20A.json"
  var erc20_b_path = "/liquid/contracts/artifacts/contracts/TestERC20B.sol/TestERC20B.json"
  var erc20_c_path = "/liquid/contracts/artifacts/contracts/TestERC20C.sol/TestERC20C.json"
  var liquid_nft_path = "/liquid/contracts/artifacts/contracts/LiquidInfrastructureNFT.sol/LiquidInfrastructureNFT.json"
  var liquid_erc20_path = "/liquid/contracts/artifacts/contracts/LiquidInfrastructureERC20.sol/LiquidInfrastructureERC20.json"

  const { abi: abiA, bytecode: bytecodeA } = getContractArtifacts(erc20_a_path);
  const erc20AFactory = new ethers.ContractFactory(abiA, bytecodeA, wallet);
  const testERC20A = (await erc20AFactory.deploy()) as TestERC20A;
  const erc20AAddress = await testERC20A.getAddress();
  console.log("ERC20 deployed at Address - ", erc20AAddress);

  const { abi: abiB, bytecode: bytecodeB } = getContractArtifacts(erc20_b_path);
  const erc20BFactory = new ethers.ContractFactory(abiB, bytecodeB, wallet);
  const testERC20B = (await erc20BFactory.deploy()) as TestERC20B;
  const erc20BAddress = await testERC20B.getAddress();
  console.log("ERC20 deployed at Address - ", erc20BAddress);

  const { abi: abiC, bytecode: bytecodeC } = getContractArtifacts(erc20_c_path);
  const erc20CFactory = new ethers.ContractFactory(abiC, bytecodeC, wallet);
  const testERC20C = (await erc20CFactory.deploy()) as TestERC20C;
  const erc20CAddress = await testERC20C.getAddress();
  console.log("ERC20 deployed at Address - ", erc20CAddress);

  const { abi: abiN, bytecode: bytecodeN } = getContractArtifacts(liquid_nft_path);
  const lNFTFactory = new ethers.ContractFactory(abiN, bytecodeN, wallet);
  const liquidNFT = (await lNFTFactory.deploy()) as LiquidInfrastructureNFT;
  const liquidNFTAddress = await liquidNFT.getAddress();
  console.log("LiquidInfrastructureNFT deployed at Address - ", liquidNFTAddress);

  const { abi: abiE, bytecode: bytecodeE } = getContractArtifacts(liquid_erc20_path);
  const lERC20Factory = new ethers.ContractFactory(abiE, bytecodeE, wallet);
  const liquidERC20 = (await lERC20Factory.deploy()) as LiquidInfrastructureERC20;
  const liquidERC20Address = await liquidERC20.getAddress();
  console.log("LiquidInfrastructureERC20 deployed at Address - ", liquidERC20Address);

}

function getContractArtifacts(path: string): { bytecode: string; abi: string } {
  var { bytecode, abi } = JSON.parse(fs.readFileSync(path, "utf8").toString());
  return { bytecode, abi };
}

async function main() {
  await deploy();
}

main();
