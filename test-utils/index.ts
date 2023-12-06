import { TestERC20A } from "../typechain-types";
import { TestERC20B } from "../typechain-types";
import { TestERC20C } from "../typechain-types";
import { LiquidInfrastructureNFT } from "../typechain-types";
import { Signer } from "ethers";
import { LiquidInfrastructureERC20 } from "../typechain-types";

type DeployContractsOptions = {
  corruptSig?: boolean;
};

export async function deployContracts(signer?: Signer | undefined) {

  const testERC20A = await ethers.deployContract("TestERC20A", signer);
  // const testERC20A = await TestERC20A.deploy() as TestERC20A;

  const testERC20B = await ethers.deployContract("TestERC20B", signer);

  const testERC20C = await ethers.deployContract("TestERC20C", signer);

  return { testERC20A, testERC20B, testERC20C };
}

export async function deployLiquidNFT(account: string) {
  const LiquidNFT = await ethers.getContractFactory("LiquidInfrastructureNFT");
  return (await LiquidNFT.deploy(account)) as LiquidInfrastructureNFT;
}

export async function deployLiquidERC20(
  owner: Signer,
  erc20Name: string,
  erc20Symbol: string,
  managedNFTs: string[],
  approvedHolders: string[],
  minDistributionPeriod: number,
  distributableErc20s: string[],
) {
  const LiquidERC20 = await ethers.getContractFactory("LiquidInfrastructureERC20", owner);
  // Constructor args:
  // string memory _name,
  // string memory _symbol,
  // address[] memory _managedNFTs,
  // address[] memory _approvedHolders
  return (await LiquidERC20.deploy(erc20Name, erc20Symbol, managedNFTs, approvedHolders, minDistributionPeriod, distributableErc20s)) as LiquidInfrastructureERC20;
}
