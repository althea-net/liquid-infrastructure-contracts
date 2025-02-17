import { HardhatUserConfig, task, vars } from "hardhat/config";
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
import "@nomicfoundation/hardhat-ethers";
import mint from "./hardhat-tasks/mint";
import deployERC20 from "./hardhat-tasks/deployERC20";
import migrateERC20 from "./hardhat-tasks/migrateERC20";
import { json } from "hardhat/internal/core/params/argumentTypes";
import "@nomicfoundation/hardhat-verify";

// The following are set using `npx hardhat vars set <KEY>` and then the value is a prompt for a secret.
// I provide a default value so that the call does not fail for regular hardhat network usage
const GNOSISSCAN_API_KEY = vars.get("GNOSISSCAN_API_KEY", "");
const DAI_PRIVATE_KEY = vars.get(
  "DAI_PRIVATE_KEY",
  "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122" // hardhat signer 0 to avoid failure
);
const DAI_TEST1 = vars.get(
  "DAI_TEST1",
  "0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb" // hardhat signer 1 to avoid failure
);
const DAI_TEST2 = vars.get(
  "DAI_TEST2",
  "0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569" // hardhat signer 2 to avoid failure
);
const DAI_TEST3 = vars.get(
  "DAI_TEST3",
  "0xee9d129c1997549ee09c0757af5939b2483d80ad649a0eda68e8b0357ad11131" // hardhat signer 3 to avoid failure
);
const DAI_TEST4 = vars.get(
  "DAI_TEST4",
  "0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc" // hardhat signer 4 to avoid failure
);
const DAI_TEST5 = vars.get(
  "DAI_TEST5",
  "0x275cc4a2bfd4f612625204a20a2280ab53a6da2d14860c47a9f5affe58ad86d4" // hardhat signer 5 to avoid failure
);

task("mint", "Mint tokens")
  .addParam("receiver", "Receiver address")
  .addParam("amount", "Amount to mint")
  .addParam("erc20", "ERC20 address")
  .setAction(async (args, hre) => {
    await mint(args.receiver, args.amount, args.erc20, hre);
  });

task("deployERC20", "Deploy a LiquidInfrastructureERC20 token")
  .addParam("name", "Token Name")
  .addParam("symbol", "Token Symbol")
  .addParam("approvedHolders", "Initial Approved Holders")
  .addParam("distributableErc20s", "Initial Distrubutable ERC20s")
  .addParam(
    "multiclaimAddress",
    "The address of the Liquid Infrastructure Multiclaim contract"
  )
  .setAction(async (args, hre) => {
    await deployERC20(
      hre,
      args.name,
      args.symbol,
      args.approvedHolders,
      args.distributableErc20s,
      args.multiclaimAddress
    );
  });

task(
  "migrateERC20",
  "Migrate a LiquidInfrastructureERC20 token to a new contract"
)
  .addParam(
    "oldErc20Address",
    "The address of the LiquidInfrastructureERC20 to migrate"
  )
  .addParam(
    "newErc20Address",
    "(optional) The new LiquidInfrastructureERC20 target",
    undefined,
    undefined,
    true
  )
  .addParam(
    "newName",
    "(optional) Argument for the new LiquidInfrastructureERC20 constructor",
    undefined,
    undefined,
    true
  )
  .addParam(
    "newSymbol",
    "(optional) Argument for the new LiquidInfrastructureERC20 constructor",
    undefined,
    undefined,
    true
  )
  .addParam(
    "multiclaimAddress",
    "(optional) Argument for the new LiquidInfrastructureERC20 constructor",
    undefined,
    undefined,
    true
  )
  .addParam(
    "approvedHolders",
    "The approved holders to migrate over",
    undefined,
    json
  )
  .addParam(
    "migrateStake",
    "Whether the old contract's stake positions should be migrated"
  )
  .addParam(
    "migrateBalances",
    "Whether the old contract's unstaked token balances should be migrated"
  )
  .addParam(
    "distributableErc20s",
    "The set of distributableERC20s which must be on the new contract",
    undefined,
    json
  )
  .addParam(
    "nftsToTransfer",
    "The set of nfts to migrate to the new contract",
    undefined,
    json
  )
  .setAction(async (args, hre) => {
    await migrateERC20(hre, {
      oldERC20Address: args.oldErc20Address,
      newERC20Address: args.newErc20Address,
      approvedHolders: args.approvedHolders,
      distributableERC20s: args.distributableErc20s,
      migrateBalances: args.migrateBalances,
      migrateStake: args.migrateStake,
      nftsToTransfer: args.nftsToTransfer,
      newName: args.newName,
      newSymbol: args.newSymbol,
      multiclaimAddress: args.multiclaimAddress,
    });
  });
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
          outputSelection: {
            "*": {
              "*": ["storageLayout"],
            },
          },
        },
      },
    ],
    overrides: {},
  },
  networks: {
    dai: {
      url: "https://dai.althea.net",
      accounts: [
        DAI_PRIVATE_KEY,
        DAI_TEST1,
        DAI_TEST2,
        DAI_TEST3,
        DAI_TEST4,
        DAI_TEST5,
      ],
      timeout: 40000,
    },
    hardhat: {
      mining: {
        // WARNING: setting auto to false can prevent expect(...).to.be.reverted from working correctly
        auto: true,
        interval: [3000, 6000],
      },
      accounts: [
        {
          privateKey:
            "0xc5e8f61d1ab959b397eecc0a37a6517b8e67a0e7cf1f4bce5591f3ed80199122",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0xd49743deccbccc5dc7baa8e69e5be03298da8688a15dd202e20f15d5e0e9a9fb",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x23c601ae397441f3ef6f1075dcb0031ff17fb079837beadaf3c84d96c6f3e569",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0xee9d129c1997549ee09c0757af5939b2483d80ad649a0eda68e8b0357ad11131",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x87630b2d1de0fbd5044eb6891b3d9d98c34c8d310c852f98550ba774480e47cc",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x275cc4a2bfd4f612625204a20a2280ab53a6da2d14860c47a9f5affe58ad86d4",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x7f307c41137d1ed409f0a7b028f6c7596f12734b1d289b58099b99d60a96efff",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2a8aede924268f84156a00761de73998dac7bf703408754b776ff3f873bcec60",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x8b24fd94f1ce869d81a34b95351e7f97b2cd88a891d5c00abc33d0ec9501902e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29085",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29086",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29087",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29088",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b29089",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x28d1bfbbafe9d1d4f5a11c3c16ab6bf9084de48d99fbac4058bdfa3c80b2908f",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf00",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf01",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf02",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf03",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf04",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf05",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf06",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf07",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf08",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf09",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf0f",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf10",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf11",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf12",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf13",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf14",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf15",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf16",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf17",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf18",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf19",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf1f",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf20",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf21",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf22",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf23",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf24",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf25",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf26",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf27",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf28",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf29",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf2f",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf30",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf31",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf32",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf33",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf34",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf35",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf36",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf37",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf38",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf39",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf3f",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf40",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf41",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf42",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf43",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf44",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf45",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf46",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf47",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf48",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf49",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf4f",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf50",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf51",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf52",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf53",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf54",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf55",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf56",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf57",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf58",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf59",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf5a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf5b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf5c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x2c7dd57db9fda0ea1a1428dcaa4bec1ff7c3bd7d1a88504754e0134b77badf5d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb100",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb101",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb102",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb103",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb104",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb105",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb106",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb107",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb108",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb109",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb10f",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb110",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb111",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb112",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb113",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb114",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb115",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb116",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb117",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb118",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb119",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11a",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11b",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11c",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11d",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11e",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb11f",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb120",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb121",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb122",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb123",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb124",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb125",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb126",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb127",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb128",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0x47aa5fbb74b21f263888dfc24a7a7b184634142935d4e2152b1c901516eeb129",
          balance: "4951760157141521099596496895",
        },
        {
          privateKey:
            "0xb1bab011e03a9862664706fc3bbaa1b16651528e5f0e7fbfcbfdd8be302a13e7",
          balance: "4951760157141521099596496895",
        },
      ],
    },
  },
  etherscan: {
    apiKey: {
      dai: GNOSISSCAN_API_KEY,
    },
    customChains: [
      {
        network: "dai",
        chainId: 100,
        urls: {
          apiURL: "https://api.gnosisscan.io/api",
          browserURL: "https://gnosisscan.io/",
        },
      },
    ],
  },
};

export default config;
