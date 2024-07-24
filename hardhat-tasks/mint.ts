import { LiquidInfrastructureERC20 } from "../typechain-types";
import { exit } from "process";

async function mint(receiver: string, amount: string, erc20: string, hre: any) {
  const ethers = hre.ethers;
  console.log("Enter mint function");
  var startTime = new Date();
  const signers = await ethers.getSigners();
  let owner = signers[0];
  console.log("Owner address: ", owner.address);
  console.log(
    `Receiver address: ${receiver} Amount: ${amount} ERC20 address: ${erc20}`
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

  liquidERC20 = lerc20Factory.attach(
    erc20
  ) as unknown as LiquidInfrastructureERC20;

  if ((await liquidERC20.getDeployedCode()) == null) {
    console.error("LiquidInfrastructureERC20 NOT found at Address - ", erc20);
    return;
  }

  let receipt;

  if (!(await liquidERC20.isApprovedHolder(receiver))) {
    console.log("Approving holder %s", receiver);
    receipt = await (await liquidERC20.approveHolder(receiver)).wait();
    console.assert(receipt?.blockNumber != null);
  }

  console.log("Minting to receiver %s", receiver);
  receipt = await (await liquidERC20.mint(receiver, amount)).wait();
  console.assert(receipt?.blockNumber != null);

  console.log("Minted %s to %s", amount, receiver);

  exit(0);
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default mint;
