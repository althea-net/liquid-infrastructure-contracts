import { LiquidInfrastructureERC20 } from "../typechain-types";
import { exit } from "process";

async function deployERC20(
  hre: any,
  name: string,
  symbol: string,
  approvedHolders: string[],
  distributableERC20s: string[],
  multiclaimAddress: string
) {
  const ethers = hre.ethers;
  console.log("Enter deploy function");
  var startTime = new Date();
  const signers = await ethers.getSigners();
  let owner = signers[0];
  console.log("Owner address: ", owner.address);
  console.log(
    `Name: ${name}, Symbol: ${symbol}, ApprovedHolders: ${approvedHolders}, DistributableERC20s: ${distributableERC20s}, MulticlaimAddress: ${multiclaimAddress}`
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

  let liquidERC20: LiquidInfrastructureERC20;

  let lerc20Factory = await ethers.getContractFactory(
    "LiquidInfrastructureERC20"
  );

  liquidERC20 = (await lerc20Factory.deploy(
    name,
    symbol,
    approvedHolders,
    distributableERC20s,
    multiclaimAddress
  )) as unknown as LiquidInfrastructureERC20;

  console.log("Deployed LiquidERC20 at ", await liquidERC20.getAddress());

  exit(0);
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default deployERC20;
