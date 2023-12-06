import chai from "chai";

import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { deployContracts, deployLiquidERC20, deployLiquidNFT } from "../test-utils";
import { TestERC20B, TestERC20C, LiquidInfrastructureNFT, LiquidInfrastructureERC20 } from "../typechain-types/contracts";
import { ERC20 } from "../typechain-types";
import { LiquidInfrastructureNFT } from "../typechain";

const { expect } = chai;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// This test makes assertions about the LiquidInfrastructureERC20 contract by running it on hardhat
//
// Important test details:
// Contract interactions happen via hardhat-ethers: https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-ethers
// Chai is used to make assertions https://www.chaijs.com/api/bdd/
// Ethereum-waffle is used to extend chai and add ethereum matchers: https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
async function runTest(opts: {}) {
  const signers = await ethers.getSigners();
  const nftAccount1 = signers[0];
  const nftAccount2 = signers[1];
  const nftAccount3 = signers[2];
  const erc20Owner = signers[3];
  const holder1 = signers[4];
  const holder2 = signers[5];
  const holder3 = signers[6];
  const holder4 = signers[7];
  const badSigner = signers[8];

  // Deploy several ERC20 tokens to use as revenue currencies
  //////////////////
  const { testERC20A, testERC20B, testERC20C } = await deployContracts(erc20Owner);
  const erc20Addresses = [await testERC20A.getAddress(), await testERC20B.getAddress(), await testERC20C.getAddress()];

  // Deploy the LiquidInfra ERC20 token with no initial holders nor managed NFTs
  //////////////////
  const infraERC20 = await deployLiquidERC20(erc20Owner, "Infra", "INFRA", [], [], 500, erc20Addresses);

  expect(await infraERC20.totalSupply()).to.equal(0);
  expect(await infraERC20.name()).to.equal("Infra");
  expect(await infraERC20.symbol()).to.equal("INFRA");
  await expect(infraERC20.ManagedNFTs(0)).to.be.reverted;
  expect(await infraERC20.isApprovedHolder(holder1.address)).to.equal(false);
  await expect(infraERC20.mint(holder1.address, 1000)).to.be.reverted;
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(0);

  await basicNftManagementTests(infraERC20, nftAccount1, nftAccount2, badSigner);

  await basicErc20HolderTests(infraERC20, holder1, holder2, badSigner);

  const holders = [holder1, holder2, holder3, holder4];
  const nftOwners = [nftAccount1, nftAccount2, nftAccount3];
  const nfts = [await deployLiquidNFT(nftAccount1), await deployLiquidNFT(nftAccount2), await deployLiquidNFT(nftAccount3)];
  const erc20s: ERC20[] = [testERC20A, testERC20B, testERC20C];
  for (const nft of nfts) {
    nft.setThresholds(erc20s, erc20s.map(() => 0));
  }
  await basicDistributionTests(infraERC20, erc20Owner, holders, nftOwners, nfts, erc20s);
}

// Checks that the owner of the ERC20 is the only one allowed to add ManagedNFTs to the ERC20
async function basicNftManagementTests(
  infraERC20: LiquidInfrastructureERC20,
  nftAccount1: ethers.Signer,
  nftAccount2: ethers.Signer,
  badSigner: ethers.Signer,
) {
  // Deploy several LiquidInfrastructureNFTs to test the NFT management features
  //////////////////
  const infraERC20NotOwner = infraERC20.connect(badSigner);
  const NFT1 = await deployLiquidNFT(nftAccount1.address);
  const NFT1NotOwner = NFT1.connect(badSigner);
  const NFT2 = await deployLiquidNFT(nftAccount2.address);

  console.log("Manage");
  await transferNftToErc20AndManage(infraERC20, NFT1, nftAccount1);
  // Transfer the NFT back to the original holder
  expect(await infraERC20.releaseManagedNFT(await NFT1.getAddress(), nftAccount1.address))
    .to.emit(infraERC20, "ReleaseManagedNFT").withArgs(await NFT1.getAddress(), nftAccount1.address);

  expect(await NFT1.ownerOf(await NFT1.AccountId())).to.equal(nftAccount1.address);
  console.log("Bad Signer");
  await failToManageNFTBadSigner(infraERC20NotOwner, NFT2, nftAccount2);
  console.log("Not NFT Owner");
  await failToManageNFTNotOwner(infraERC20, NFT1NotOwner);

}

async function transferNftToErc20AndManage(
  infraERC20: LiquidInfrastructureERC20,
  nftToManage: LiquidInfrastructureNFT,
  nftOwner: string,
) {
  const infraAddress = await infraERC20.getAddress();
  const accountId = await nftToManage.AccountId();
  expect(await nftToManage.transferFrom(nftOwner, infraAddress, accountId)).to.be.ok;
  expect(await nftToManage.ownerOf(accountId)).to.equal(infraAddress, "unexpected nft owner");

  expect(await infraERC20.addManagedNFT(await nftToManage.getAddress()))
    .to.emit(infraERC20, "AddManagedNFT").withArgs(await nftToManage.getAddress());
}

async function failToManageNFTBadSigner(
  infraERC20BadSigner: LiquidInfrastructureERC20,
  nftToManage: LiquidInfrastructureNFT,
  nftOwner: string,
) {
  const infraAddress = await infraERC20BadSigner.getAddress();
  const nftAddress = await nftToManage.getAddress();
  const accountId = await nftToManage.AccountId();
  await expect(nftToManage.transferFrom(nftOwner, infraAddress, accountId)).to.be.ok;

  // It is not clear why this call needs await OUTSIDE of expect
  await expect(infraERC20BadSigner.addManagedNFT(nftAddress)).to.be.revertedWith("Ownable: caller is not the owner");


}

async function failToManageNFTNotOwner(infraERC20: LiquidInfrastructureERC20, nftToManage: LiquidInfrastructureNFT) {
  // Don't transfer the NFT to the ERC20
  const nftAddress = await nftToManage.getAddress();

  // It is not clear why this call needs await INSIDE of expect
  await expect(infraERC20.addManagedNFT(nftAddress)).to.be.revertedWith("this contract does not own the new ManagedNFT");
}

// Checks that only owner-approved holders are allowed to hold the ERC20,
// and that even the owner cannot give them tokens without approving them
async function basicErc20HolderTests(
  infraERC20: LiquidInfrastructureERC20,
  holder1: ethers.Signer,
  holder2: ethers.Signer,
  badSigner: ethers.Signer,
) {
  const infraERC20NotOwner = infraERC20.connect(badSigner);
  const initialSupply = await infraERC20.totalSupply();
  expect(await infraERC20.isApprovedHolder(holder1.address)).to.be.false;
  expect(await infraERC20.isApprovedHolder(holder2.address)).to.be.false;
  expect(await infraERC20.isApprovedHolder(badSigner.address)).to.be.false;

  // Attempt to mint to unapproved holders
  await expect(infraERC20.mint(holder1.address, 1000)).to.be.revertedWith("receiver not approved to hold the token");
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(0);
  await expect(infraERC20.mintAndDistribute(holder2.address, 1000)).to.be.revertedWith("receiver not approved to hold the token");
  expect(await infraERC20.totalSupply()).to.equal(initialSupply);
  expect(await infraERC20.balanceOf(holder2.address)).to.equal(0);

  // Attempt to approve using the wrong account
  await expect(infraERC20NotOwner.approveHolder(holder1.address)).to.be.revertedWith("Ownable: caller is not the owner");
  expect(await infraERC20NotOwner.isApprovedHolder(holder1.address)).to.be.false;
  await expect(infraERC20NotOwner.disapproveHolder(holder2.address)).to.be.revertedWith("Ownable: caller is not the owner");
  expect(await infraERC20NotOwner.isApprovedHolder(holder2.address)).to.be.false;

  // Now successfully approve holder1
  await expect(infraERC20.approveHolder(holder1.address)).to.not.be.reverted;
  expect(await infraERC20.isApprovedHolder(holder1.address)).to.be.true;
  await expect(infraERC20.approveHolder(holder1.address)).to.be.revertedWith("holder already approved");

  // Grant holder1 some ERC20 and fail to transfer them to holder 2
  await expect(infraERC20.mint(holder1.address, 500)).to.not.be.reverted;
  await expect(infraERC20.mintAndDistribute(holder1.address, 500)).to.not.be.reverted;
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(1000);
  const infraERC20Holder1 = infraERC20.connect(holder1);
  await expect(infraERC20Holder1.transfer(holder2.address, 500)).to.be.revertedWith("receiver not approved to hold the token");
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(1000);
  expect(await infraERC20.balanceOf(holder2.address)).to.equal(0);

  // And successfully approve holder2
  await expect(infraERC20.approveHolder(holder2.address)).to.not.be.reverted;
  expect(await infraERC20.isApprovedHolder(holder2.address)).to.be.true;

  await expect(infraERC20Holder1.transfer(holder2.address, 500)).to.not.be.reverted;
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(500);
  expect(await infraERC20.balanceOf(holder2.address)).to.equal(500);

  // Now disapprove holder2 and ensure they cannot receive more tokens
  await expect(infraERC20.disapproveHolder(holder2.address)).to.not.be.reverted;
  expect(await infraERC20.isApprovedHolder(holder2.address)).to.be.false;
  expect(await infraERC20.balanceOf(holder2.address)).to.equal(500);
  await expect(infraERC20.mint(holder2.address, 500)).to.be.revertedWith("receiver not approved to hold the token");
  await expect(infraERC20.mintAndDistribute(holder2.address, 500)).to.be.revertedWith("receiver not approved to hold the token");
  await expect(infraERC20Holder1.transfer(holder2.address, 500)).to.be.revertedWith("receiver not approved to hold the token");
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(500);
  expect(await infraERC20.balanceOf(holder2.address)).to.equal(500);

  // But that they are able to reduce their held balance
  const infraERC20Holder2 = infraERC20.connect(holder2);
  await expect(infraERC20Holder2.transfer(holder1.address, 50)).to.not.be.reverted;
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(550);
  expect(await infraERC20.balanceOf(holder2.address)).to.equal(450);

  // And ensure the burn works correctly too 
  await expect(infraERC20Holder2.burnAndDistribute(150)).to.not.be.reverted;
  await expect(infraERC20Holder2.burn(300)).to.not.be.reverted;
  expect(await infraERC20.balanceOf(holder2.address)).to.equal(0);
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(550);
  expect(await infraERC20.totalSupply()).to.equal(550);

  // Finally, remove holder1's balance so that the other tests do not need to account for it
  await expect(infraERC20Holder1.approve(holder1.address, 550)).to.not.be.reverted;
  await expect(infraERC20Holder1.burnFrom(holder1.address, 550)).to.not.be.reverted;
  expect(await infraERC20.balanceOf(holder1.address)).to.equal(0);
  expect(await infraERC20.totalSupply()).to.equal(0);
}

async function basicDistributionTests(
  infraERC20: LiquidInfrastructureERC20,
  infraERC20Owner: ethers.Signer,
  holders: ethers.Signer[],
  nftOwners: ethers.Signer[],
  nfts: LiquidInfrastructureNFT[],
  rewardErc20s: ERC20[],
) {
  const [holder1, holder2, holder3, holder4] = holders.slice(0, 4);
  const [nftOwner1, nftOwner2, nftOwner3] = nftOwners.slice(0, 3);
  let [nft1, nft2, nft3] = nfts.slice(0, 3);
  const [erc20a, erc20b, erc20c] = rewardErc20s.slice(0, 3);
  const erc20Addresses = [await erc20a.getAddress(), await erc20b.getAddress(), await erc20c.getAddress()];

  console.log("Before transfer NFT to ERC20, nft owner: ", await nft1.ownerOf(await nft1.AccountId()));
  // Register one NFT as a source of reward erc20s
  await transferNftToErc20AndManage(infraERC20, nft1, nftOwner1);
  await mine(1);
  nft1 = nft1.connect(infraERC20Owner);
  console.log("Updated NFT to be owned by ERC20, nft owner: ", await nft1.ownerOf(await nft1.AccountId()));

  // Allocate some rewards to the NFT
  const rewardAmount1 = 1000000;
  await erc20a.transfer(await nft1.getAddress(), rewardAmount1);
  console.log("NFT Balance: ", await erc20a.balanceOf(await nft1.getAddress()));
  expect(await erc20a.balanceOf(await nft1.getAddress())).to.equal(rewardAmount1);

  console.log("nft withdraw balances, erc20 is ", await infraERC20.getAddress(), "and erc20 owner is ", infraERC20Owner.address);
  // And then send the rewards to the ERC20
  await expect(infraERC20.withdrawFromAllManagedNFTs())
    .to.emit(infraERC20, "WithdrawalStarted")
    .and.emit(nft1, "SuccessfulWithdrawal")
    .and.emit(erc20a, "Transfer").withArgs(await nft1.getAddress(), await infraERC20.getAddress(), rewardAmount1)
    .and.emit(infraERC20, "Withdrawal").withArgs(await nft1.getAddress())
    .and.emit(infraERC20, "WithdrawalFinished");

  console.log("distribute to all holders")
  // Attempt to distribute with no holders
  await expect(infraERC20.distributeToAllHolders()).to.be.reverted;

  // Grant a single holder some of the Infra ERC20 tokens and then distribute all held rewards to them
  await expect(infraERC20.mint(holder1.address, 100)).to.emit(infraERC20, "Transfer").withArgs(ZERO_ADDRESS, holder1.address, 100);
  await mine(500);
  await expect(infraERC20.distributeToAllHolders())
    .to.emit(infraERC20, "DistributionStarted")
    .and.emit(infraERC20, "DistributionFinished")
    .and.emit(infraERC20, "Distribution").withArgs(holder1.address)
    .and.emit(erc20a, "Transfer").withArgs(await infraERC20.getAddress(), holder1.address, rewardAmount1);
}

describe("LiquidInfrastructureERC20 tests", function () {
  it("works right", async function () {
    await runTest({})
  });
});
