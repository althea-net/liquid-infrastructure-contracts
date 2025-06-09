import { LiquidInfrastructureERC20 } from "../typechain-types";
import { exit } from "process";

// const WxDAI_address = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";
// const LiquidNFTExpectedAddress = "0x59ae6Db6e90488D645Cf0796a79C3A47b6B56ef5";
// const LiquidERC20ExpectedAddress = "0x8c4460023f9a1c7f97c2bB96b4143a37af5EDA0f";

export async function whitelistHolder(
  hre: any,
  contract: string,
  toApprove: string
) {
  const ethers = hre.ethers;
  var startTime = new Date();
  const signers = await ethers.getSigners();
  let wallet = signers[0];
  console.log("Owner Wallet address: ", wallet.address);

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

  let liquidERC20Address;
  let lerc20Factory = await ethers.getContractFactory(
    "LiquidInfrastructureERC20"
  );

  let lerc20 = lerc20Factory.attach(
    contract
  ) as unknown as LiquidInfrastructureERC20;

  liquidERC20 = lerc20;
  liquidERC20Address = await liquidERC20.getAddress();
  console.log(
    "LiquidInfrastructureERC20 found at Address - ",
    liquidERC20Address
  );

  if (!(await liquidERC20.isApprovedHolder(toApprove))) {
    console.log("Approving holder %s", toApprove);
    let receipt = await (await liquidERC20.approveHolder(toApprove)).wait();
    console.assert(receipt?.blockNumber != null);
  }
  let totalSupply = await liquidERC20.totalSupply();
  console.log("Total Supply: ", totalSupply.toString());

  exit(0);
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
