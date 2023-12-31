//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.12; // Force solidity compliance

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./LiquidInfrastructureNFT.sol";
import "hardhat/console.sol";

/**
 * @title Liquid Infrastructure ERC20
 * @author Christian Borst <christian@althea.systems>
 *
 * @dev An ERC20 contract used to earn rewards from managed LiquidInfrastructreNFTs.
 *
 * A LiquidInfrastructureNFT typically represents some form of infrastructure involved in an Althea pay-per-forward network
 * which frequently receives payments from peers on the network for performing an automated service (e.g. providing internet).
 * This LiquidInfrastructureERC20 acts as a convenient aggregation layer to enable dead-simple investment in real-world assets
 * with automatic revenue accrual. Simply by holding this ERC20 owners are entitled to revenue from the network represented by the token.
 *
 * Revenue is gathered from managed LiquidInfrastructureNFTs by the protocol and distributed to token holders on a semi-regular basis,
 * where there is a minimum number of blocks required to elapse before a new payout to token holders.
 */
contract LiquidInfrastructureERC20 is
    ERC20,
    ERC20Burnable,
    Ownable,
    ERC721Holder,
    ReentrancyGuard
{
    event DistributionStarted();
    event Distribution(address recipient);
    event DistributionFinished();
    event WithdrawalStarted();
    event Withdrawal(address source);
    event WithdrawalFinished();
    event AddManagedNFT(address nft);
    event ReleaseManagedNFT(address nft, address to);

    IERC20[] private distributableERC20s;
    uint256[] private erc20EntitlementPerUnit;
    address[] private holders;

    /**
     * @notice This is the current version of the contract. Every update to the contract will introduce a new
     * version, regardless of anticipated compatibility.
     */
    uint256 public constant Version = 1;

    /**
     * @notice This collection holds the managed LiquidInfrastructureNFTs which periodically generate revenue and deliver
     * the balances to this contract.
     */
    address[] public ManagedNFTs;

    /**
     * @notice This collection holds the whitelist for accounts approved to hold the LiquidInfrastructureERC20
     */
    mapping(address => bool) public HolderAllowlist;

    /**
     * @notice Holds the block of the last distribution, used for limiting distribution lock ups
     */
    uint256 public LastDistribution;

    /**
     * @notice Holds the minimum number of blocks required to elapse before a new distribution can begin
     */
    uint256 public MinDistributionPeriod;

    /**
     * @notice When true, locks all transfers, mints, and burns until the current distribution has completed
     */
    bool public LockedForDistribution;

    /**
     * @dev Holds the index into `holders` of the next account owed the current distribution
     */
    uint256 internal nextDistributionRecipient;

    /**
     * @dev Holds the index into `ManagedNFTs` of the next contract to withdraw funds from
     */
    uint256 private nextWithdrawal;

    /**
     * Indicates if the account is approved to hold the ERC20 token or not
     * @param account the potential holder of the token
     */
    function isApprovedHolder(address account) public view returns (bool) {
        console.log("Enter isApprovedHolder");
        return HolderAllowlist[account];
    }

    /**
     * TODO: Role based holder approvals, or leave this as onlyOwner?
     *
     * Adds `holder` to the list of approved token holders. This is necessary before `holder` may receive any of the underlying ERC20.
     * @notice this call will fail if `holder` is already approved. Call isApprovedHolder() first to avoid mistakes.
     *
     * @param holder the account to add to the allowlist
     */
    function approveHolder(address holder) public onlyOwner {
        console.log("Enter approveHolder(%s)", holder);
        require(!isApprovedHolder(holder), "holder already approved");
        HolderAllowlist[holder] = true;
    }

    /**
     * TODO: Role based holder disapprovals, or leave this as onlyOwner?
     *
     * Marks `holder` as NOT approved to hold the token, preventing them from receiving any more of the underlying ERC20.
     *
     * @param holder the account to add to the allowlist
     */
    function disapproveHolder(address holder) public onlyOwner {
        console.log("Enter disapproveHolder(%s)", holder);
        require(isApprovedHolder(holder), "holder not approved");
        HolderAllowlist[holder] = false;
    }

    /**
     * Implements the lock during distributions, adds `to` to the list of holders when needed
     * @param from token sender
     * @param to  token receiver
     * @param amount  amount sent
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        console.log("Enter _beforeTokenTransfer(%s,%s,%s)", from, to, amount);
        require(!LockedForDistribution, "distribution in progress");
        if (!(to == address(0))) {
            require(
                isApprovedHolder(to),
                "receiver not approved to hold the token"
            );
        }
        if (from == address(0) || to == address(0)) {
            _beforeMintOrBurn();
        }
        bool exists = (this.balanceOf(to) != 0);
        if (!exists) {
            console.log("Adding to holders");
            holders.push(to);
        }
    }

    /**
     * Implements an additional lock on minting and burning, ensuring that supply changes happen after any potential distributions
     */
    function _beforeMintOrBurn() internal view {
        console.log("Enter _beforeMintOrBurn()");
        require(
            !_isPastMinDistributionPeriod(),
            "must distribute before minting or burning"
        );
    }

    /**
     * Removes `from` from the list of holders when they no longer hold any balance
     * @param from token sender
     * @param to  token receiver
     * @param amount  amount sent
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        console.log("Enter _afterTokenTransfer(%s,%s,%s)", from, to, amount);
        bool stillHolding = (this.balanceOf(from) != 0);
        if (!stillHolding) {
            for (uint i = 0; i < holders.length; i++) {
                if (holders[i] == from) {
                    console.log("Removing from holders");
                    // Remove the element at i by copying the last one into its place and removing the last element
                    holders[i] = holders[holders.length - 1];
                    holders.pop();
                }
            }
        }
    }

    function distributeToAllHolders() public {
        console.log("Enter distributeToAllHolders()");
        uint256 num = holders.length;
        if (num > 0) {
            distribute(holders.length);
        }
    }

    /**
     * Begins or continues a distribution, preventing transfers, mints, and burns of the token until all rewards have been paid out
     *
     * @notice distributions may only begin once every MinDistributionPeriod.
     *
     * @param numDistributions the number of distributions to process in this execution
     */
    function distribute(uint256 numDistributions) public nonReentrant {
        console.log("Enter distribute(%s)", numDistributions);
        require(numDistributions > 0, "must process at least 1 distribution");
        if (!LockedForDistribution) {
            require(
                _isPastMinDistributionPeriod(),
                "MinDistributionPeriod not met"
            );
            _beginDistribution();
        }

        uint256 limit = Math.min(
            nextDistributionRecipient + numDistributions,
            holders.length
        );

        uint i;
        for (i = nextDistributionRecipient; i < limit; i++) {
            console.log(
                "Distribution: i=%s nextDistributionRecipient=%s",
                i,
                nextDistributionRecipient
            );
            address recipient = holders[i];
            if (isApprovedHolder(recipient)) {
                for (uint j = 0; j < distributableERC20s.length; j++) {
                    IERC20 toDistribute = IERC20(distributableERC20s[j]);
                    uint256 entitlement = erc20EntitlementPerUnit[j] *
                        this.balanceOf(recipient);
                    // console.log(
                    //     "Distributing %s %s -> %s",
                    //     entitlement,
                    //     address(toDistribute),
                    //     recipient
                    // );
                    bool success = toDistribute.transfer(
                        recipient,
                        entitlement
                    );

                    // TODO: Should we ignore this failure instead? The unsent funds would be rolled into the next distribution
                    require(success, "failed to distribute to recipient");
                }
                emit Distribution(recipient);
            }
        }
        nextDistributionRecipient = i;

        if (nextDistributionRecipient == holders.length) {
            _endDistribution();
        }
    }

    function _isPastMinDistributionPeriod() internal view returns (bool) {
        console.log("Enter _isPastMinDistributionPeriod()");
        // Do not force a distribution with no holders or supply
        if (totalSupply() == 0 || holders.length == 0) {
            return false;
        }

        return (block.number - LastDistribution) >= MinDistributionPeriod;
    }

    /**
     * Prepares this contract for distribution:
     * - Locks the contract
     * - Calculates the entitlement to protocol-held ERC20s per unit of the LiquidInfrastructureERC20 held
     */
    function _beginDistribution() internal {
        require(
            !LockedForDistribution,
            "cannot begin distribution when already locked"
        );
        console.log("Enter _beginDistribution()");
        LockedForDistribution = true;

        // clear the previous entitlements, if any
        if (erc20EntitlementPerUnit.length > 0) {
            delete erc20EntitlementPerUnit;
        }

        // Calculate the entitlement per token held
        uint256 supply = this.totalSupply();
        for (uint i = 0; i < distributableERC20s.length; i++) {
            uint256 balance = IERC20(distributableERC20s[i]).balanceOf(
                address(this)
            );
            uint256 entitlement = balance / supply;
            console.log(
                "Calculated entitlement per unit: %s = %s / %s",
                entitlement,
                balance,
                supply
            );
            erc20EntitlementPerUnit.push(entitlement);
        }

        nextDistributionRecipient = 0;
        emit DistributionStarted();
    }

    /**
     * Unlocks this contract at the end of a distribution
     */
    function _endDistribution() internal {
        require(
            LockedForDistribution,
            "cannot end distribution when not locked"
        );
        console.log("Enter _endDistribution()");
        delete erc20EntitlementPerUnit;
        LockedForDistribution = false;
        LastDistribution = block.number;
        emit DistributionFinished();
    }

    /**
     * Convenience function that allows the contract owner to distribute when necessary and then mint right after
     *
     * @notice attempts to distribute to every holder in this block, which may exceed the block gas limit
     * if this fails then first call distribute
     */
    function mintAndDistribute(
        address account,
        uint256 amount
    ) public onlyOwner {
        console.log("Enter mintAndDistribute(%s,%s)", account, amount);
        if (_isPastMinDistributionPeriod()) {
            distributeToAllHolders();
        }
        mint(account, amount);
    }

    /**
     * Allows the contract owner to mint tokens for an address
     *
     * @notice minting may only occur when a distribution has happened within MinDistributionPeriod blocks
     */
    function mint(
        address account,
        uint256 amount
    ) public onlyOwner nonReentrant {
        console.log("Enter mint(%s,%s)", account, amount);
        _mint(account, amount);
    }

    // TODO: Remove this redundant definition
    function burn(uint256 amount) public override {
        console.log("Enter burn(%s)", amount);
        _burn(msg.sender, amount);
    }

    /**
     * Convenience function that allows a token holder to distribute when necessary and then burn their tokens right after
     *
     * @notice attempts to distribute to every holder in this block, which may exceed the block gas limit
     * if this fails then first call distribute() enough times to finish a distribution and then call burn()
     */
    function burnAndDistribute(uint256 amount) public {
        console.log("Enter burnAndDistribute(%s)", amount);
        if (_isPastMinDistributionPeriod()) {
            distributeToAllHolders();
        }
        burn(amount);
    }

    /**
     * Convenience function that allows an approved sender to distribute when necessary and then burn the approved tokens right after
     *
     * @notice attempts to distribute to every holder in this block, which may exceed the block gas limit
     * if this fails then first call distribute() enough times to finish a distribution and then call burnFrom()
     */
    function burnFromAndDistribute(address account, uint256 amount) public {
        console.log("Enter burnFromAndDistribute(%s,%s)", account, amount);
        if (_isPastMinDistributionPeriod()) {
            distribute(holders.length);
        }
        burnFrom(account, amount);
    }

    function withdrawFromAllManagedNFTs() public {
        console.log("Enter withdrawFromAllManagedNFTs()");
        withdrawFromManagedNFTs(ManagedNFTs.length);
    }

    /**
     * Performs withdrawals from the ManagedNFTs collection, depositing all token balances into the custody of this contract
     * @param numWithdrawals the number of withdrawals to perform
     */
    function withdrawFromManagedNFTs(uint256 numWithdrawals) public {
        console.log("Enter withdrawFromManagedNFTs(%s)", numWithdrawals);
        require(!LockedForDistribution, "cannot withdraw during distribution");

        if (nextWithdrawal == 0) {
            emit WithdrawalStarted();
        }

        uint256 limit = Math.min(
            numWithdrawals + nextWithdrawal,
            ManagedNFTs.length
        );
        uint256 i;
        for (i = nextWithdrawal; i < limit; i++) {
            LiquidInfrastructureNFT withdrawFrom = LiquidInfrastructureNFT(
                ManagedNFTs[i]
            );

            (address[] memory withdrawERC20s, ) = withdrawFrom.getThresholds();
            withdrawFrom.withdrawBalancesTo(withdrawERC20s, address(this));
            emit Withdrawal(address(withdrawFrom));
        }
        nextWithdrawal = i;

        if (nextWithdrawal == ManagedNFTs.length) {
            nextWithdrawal = 0;
            emit WithdrawalFinished();
        }
    }

    /**
     * Adds a LiquidInfrastructureNFT contract to the ManagedNFTs collection
     * @notice this contract must already be the owner of the `nftContract` before this function is called
     *
     * @param nftContract the LiquidInfrastructureNFT contract to add to ManagedNFTs
     */
    function addManagedNFT(address nftContract) public onlyOwner {
        console.log("Enter addManagedNFT(%s)", nftContract);
        LiquidInfrastructureNFT nft = LiquidInfrastructureNFT(nftContract);
        address nftOwner = nft.ownerOf(nft.AccountId());
        require(
            nftOwner == address(this),
            "this contract does not own the new ManagedNFT"
        );
        ManagedNFTs.push(nftContract);
        emit AddManagedNFT(nftContract);
    }

    /**
     * Transfers a LiquidInfrastructureNFT contract out of the control of this contract
     * @notice LiquidInfrastructureNFTs only hold a single token with a specific id (AccountId), this function
     * only transfers the token with that specific id
     *
     * @param nftContract the NFT to release
     * @param to the new owner of the NFT
     */
    function releaseManagedNFT(
        address nftContract,
        address to
    ) public onlyOwner nonReentrant {
        console.log("Enter releaseManagedNFT(%s,%s)", nftContract, to);
        LiquidInfrastructureNFT nft = LiquidInfrastructureNFT(nftContract);
        nft.transferFrom(address(this), to, nft.AccountId());

        // Remove the released NFT from the collection
        for (uint i = 0; i < ManagedNFTs.length; i++) {
            address managed = ManagedNFTs[i];
            if (managed == nftContract) {
                // Delete by copying in the last element and then pop the end
                ManagedNFTs[i] = ManagedNFTs[ManagedNFTs.length - 1];
                ManagedNFTs.pop();
                break;
            }
        }
        // By this point the NFT should have been found and removed from ManagedNFTs
        require(true, "unable to find released NFT in ManagedNFTs");

        emit ReleaseManagedNFT(nftContract, to);
    }

    /**
     * Allows the owner to overwrite the list of ERC20s which may be distributed from ManagedNFTs to the holders
     *
     * @param _distributableERC20s  The new list value to set
     */
    function setDistributableERC20s(
        IERC20[] memory _distributableERC20s
    ) public onlyOwner {
        distributableERC20s = _distributableERC20s;
    }

    /**
     * Constructs the underlying ERC20 and initializes critical variables
     *
     * @param _name The name of the underlying ERC20
     * @param _symbol The symbol of the underlying ERC20
     * @param _managedNFTs The addresses of the controlled LiquidInfrastructureNFT contracts
     * @param _approvedHolders The addresses of the initial allowed holders
     * @param _distributableErc20s The addresses of ERC20s which should be distributed from ManagedNFTs to holders
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address[] memory _managedNFTs,
        address[] memory _approvedHolders,
        uint256 _minDistributionPeriod,
        IERC20[] memory _distributableErc20s
    ) ERC20(_name, _symbol) Ownable() {
        ManagedNFTs = _managedNFTs;
        LastDistribution = block.number;

        for (uint i = 0; i < _approvedHolders.length; i++) {
            HolderAllowlist[_approvedHolders[i]] = true;
        }

        MinDistributionPeriod = _minDistributionPeriod;

        distributableERC20s = _distributableErc20s;
    }
}
