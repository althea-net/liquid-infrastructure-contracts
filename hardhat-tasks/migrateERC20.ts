import {
  LiquidInfrastructureERC20,
  LiquidInfrastructureNFT,
} from "../typechain-types";
import { exit } from "process";

async function migrateERC20(
  hre: any,
  params: {
    oldERC20Address: string;
    newERC20Address?: string;
    newName?: string;
    newSymbol?: string;
    multiclaimAddress?: string;
    approvedHolders: string[];
    migrateStake: boolean;
    migrateBalances: boolean;
    distributableERC20s: string[];
    nftsToTransfer: string[];
  }
) {
  const ethers = hre.ethers;
  console.log("Enter deploy function");
  var startTime = new Date();
  const signers = await ethers.getSigners();
  let owner = signers[0];
  console.log("Owner address: ", owner.address);

  console.log(
    `OldERC20Address: ${params.oldERC20Address}, NewERC20Address: ${params.newERC20Address}, ApprovedHolders: ${params.approvedHolders}, DistributableERC20s: ${params.distributableERC20s}, NFTsToTransfer: ${params.nftsToTransfer}, NewName: ${params.newName}, NewSymbol: ${params.newSymbol}, MulticlaimAddress: ${params.multiclaimAddress}`
  );

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

  let oldERC20: LiquidInfrastructureERC20;
  let newERC20: LiquidInfrastructureERC20;

  let lerc20Factory = await ethers.getContractFactory(
    "LiquidInfrastructureERC20"
  );
  let lnft20Factory = await ethers.getContractFactory(
    "LiquidInfrastructureNFT"
  );

  // Connect old contract -------------------------------------------------------------------

  oldERC20 = lerc20Factory.attach(
    params.oldERC20Address
  ) as unknown as LiquidInfrastructureERC20;

  if ((await oldERC20.getDeployedCode()) == null) {
    console.error(
      "Old LiquidInfrastructureERC20 NOT found at Address - ",
      params.oldERC20Address
    );
    return;
  }

  // Connect or deploy new contract ---------------------------------------------------------
  if (params.newERC20Address) {
    newERC20 = lerc20Factory.attach(
      params.newERC20Address
    ) as unknown as LiquidInfrastructureERC20;

    if ((await newERC20.getDeployedCode()) != null) {
      console.log(
        "New LiquidInfrastructureERC20 found at Address - ",
        params.newERC20Address
      );
    }
  } else {
    console.log(
      "New LiquidInfrastructureERC20 not yet deployed, will deploy now"
    );
    newERC20 = (await lerc20Factory.deploy(
      params.newName,
      params.newSymbol,
      params.approvedHolders,
      params.distributableERC20s,
      params.multiclaimAddress
    )) as unknown as LiquidInfrastructureERC20;
    console.log(
      "New LiquidInfrastructureERC20 deployed at Address - ",
      await newERC20.getAddress()
    );
  }

  // Approve unapproved holders -------------------------------------------------------------
  for (let holder of params.approvedHolders) {
    if (!(await newERC20.isApprovedHolder(holder))) {
      console.log("Approving holder %s", holder);
      await (await newERC20.approveHolder(holder)).wait();
    }
  }

  // Migrate old staking positions-----------------------------------------------------------
  if (params.migrateStake) {
    console.log("Migrating stake");
    for (let holder of params.approvedHolders) {
      let stake = await oldERC20.getStake(holder);
      if (stake > 0) {
        let existingStake = await newERC20.getStake(holder);
        let difference = stake - existingStake;
        if (difference > 0) {
          console.log("Minting %s staked tokens to %s", difference, holder);
          await (await newERC20.mintStaked(holder, difference)).wait();
        }
      }
    }
  }

  // Migrate old unstaked balances ----------------------------------------------------------
  if (params.migrateBalances) {
    console.log("Migrating balances");
    for (let holder of params.approvedHolders) {
      let balance = await oldERC20.balanceOf(holder);
      if (balance > 0) {
        let existingBalance = await newERC20.balanceOf(holder);
        let difference = balance - existingBalance;
        if (difference > 0) {
          console.log("Minting %s tokens to %s", difference, holder);
          await (await newERC20.mint(holder, difference)).wait();
        }
      }
    }
  }

  // Migrate NFTs to new contract -----------------------------------------------------------
  let managedNFTs = await oldERC20.getManagedNFTs();
  for (let nft of params.nftsToTransfer) {
    console.log("Transferring NFT %s to new contract", nft);
    if (managedNFTs.includes(nft)) {
      await (await oldERC20.releaseManagedNFT(nft, owner.address)).wait();
    }

    let liquidNFT = lnft20Factory.attach(
      nft
    ) as unknown as LiquidInfrastructureNFT;
    await (
      await liquidNFT.setApprovalForAll(await newERC20.getAddress(), true)
    ).wait();
    await (await newERC20.addManagedNFT(nft)).wait();
  }

  // Set distributableERC20s ----------------------------------------------------------------
  let currentDistributables = await newERC20.getDistributableERC20s();
  for (let erc20 of params.distributableERC20s) {
    if (!currentDistributables.includes(erc20)) {
      console.log("Adding %s to distributable ERC20s", erc20);
      await (await newERC20.addDistributableERC20(erc20)).wait();
    }
  }

  exit(0);
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default migrateERC20;
