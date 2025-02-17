//SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28; // Force solidity compliance

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LiquidInfrastructureNFT.sol";
import "./libraries/FixedPoint.sol";

/**
 * @title Liquid Infrastructure ERC20
 * @author Christian Borst <christian@althea.systems>
 *
 * @dev An ERC20 contract which distributes revenue from managed LiquidInfrastructreNFTs.
 *
 * A LiquidInfrastructureNFT typically represents some form of infrastructure involved in an Althea pay-per-forward network
 * which frequently receives payments from peers on the network for performing an automated service (e.g. providing internet).
 * This LiquidInfrastructureERC20 acts as a convenient aggregation layer to enable dead-simple investment in real-world assets
 * with automatic revenue accrual.
 *
 * Revenue is gathered from managed LiquidInfrastructureNFTs by the protocol and allocated to stakers of this ERC20.
 */
contract LiquidInfrastructureERC20 is
    ERC20,
    ERC20Burnable,
    Ownable,
    ERC721Holder,
    ReentrancyGuard
{
    event Deployed();
    event WithdrawalStarted();
    event Withdrawal(address source);
    event WithdrawalFinished();
    event AddManagedNFT(address nft);
    event ReleaseManagedNFT(address nft, address to);
    event Stake(address holder, uint256 amount);
    event ClaimRevenue(address holder);
    event Unstake(address holder, uint256 amount);
    event Approved(address holder);
    event Disapproved(address holder);
    event DistributableERC20Added(address erc20);
    event NondistributableTransfer(address erc20, uint256 amount, address receiver);
    event SetManagedNFTThresholds(address nft, address[] newErc20s, uint256[] newAmounts);

    /**
     * @notice This is the current version of the contract. Every update to the contract will introduce a new
     * version, regardless of anticipated compatibility.
     */
    uint256 public constant Version = 3;


    ////////////////////////// Allow List //////////////////////////

    /**
     * @notice This collection holds the whitelist for accounts approved to hold the LiquidInfrastructureERC20
     */
    mapping(address => bool) public HolderAllowlist;


    /**
     * @notice Indicates if the account is approved to hold the ERC20 token or not
     * @param account the potential holder of the token
     * @return true if the account is on the HolderAllowlist, false otherwise
     */
    function isApprovedHolder(address account) public view returns (bool) {
        return HolderAllowlist[account];
    }

    /**
     * @notice Adds `holder` to the list of approved token holders. This is necessary before `holder` may receive any of the underlying ERC20.
     * this call will fail if `holder` is already approved. Call isApprovedHolder() first to avoid mistakes.
     * @param holder the account to add to the allowlist
     */
    function approveHolder(address holder) public onlyOwner {
        require(!isApprovedHolder(holder), "holder already approved");
        HolderAllowlist[holder] = true;
        emit Approved(holder);
    }

    /**
     * @notice Marks `holder` as NOT approved to hold the token, preventing them from receiving any more of the underlying ERC20.
     * @param holder the account to add to the allowlist
     */
    function disapproveHolder(address holder) public onlyOwner {
        require(isApprovedHolder(holder), "holder not approved");
        HolderAllowlist[holder] = false;
        uint256 position = getStake(holder);
        if (position > 0) {
            _unstakeFor(holder, position);
        }
        emit Disapproved(holder);
    }

    /**
     * @dev Restricts certain token transfers, in particular all holders must be approved 
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Staking is allowed by only the approved holders
        // Unstaking must be allowed by even disapproved holders, may not unstake to this address or the zero address
        // Mints are allowed to only approved holders, and never to this address or the zero address
        // Burns are allowed by only approved holders, and never from this address or the zero address

        bool mint_ = from == address(0);
        bool burn_ = to == address(0);
        bool stake_ = to == address(this);
        bool unstake_ = from == address(this);
        require(!(mint_ && burn_), "invalid mint/burn"); // Mint and burn are mutually exclusive
        require(!((mint_ || burn_) && (stake_ || unstake_)), "mint/burn with stake/unstake"); // Mint/burn and stake/unstake are mutually exclusive
        require(!(stake_ && unstake_), "invalid stake/unstake"); // Stake and unstake are mutually exclusive
        if (mint_) {
            require(
                isApprovedHolder(to),
                "unapproved mint"
            );
        }
        if (burn_) {
            require(
                isApprovedHolder(from),
                "unapproved burn"
            );
        }
        if (stake_) {
             require(
                isApprovedHolder(from),
                "unapproved stake"
            );
        }
        // Unstaking must be allowed from even disapproved holders

        // Transfer the tokens
        super._update(from, to, amount);
    }

    ////////////////////////// NFT Management and Revenue Withdrawals //////////////////////////

    /// @notice This collection holds the managed LiquidInfrastructureNFTs which periodically generate revenue and deliver
    /// the balances to this contract.
    address[] public ManagedNFTs;

    function getManagedNFTs() public view returns (address[] memory) {
        return ManagedNFTs;
    }

    /**
     * @notice Adds a LiquidInfrastructureNFT contract to the ManagedNFTs collection, transferring the NFT from msg.sender if necessary
     * @dev LiquidInfrastructureNFTs only hold a single token with a specific id (AccountId), this function
     * only transfers the token with that specific id
     * @param nftContract the LiquidInfrastructureNFT contract to add to ManagedNFTs
     */
    function addManagedNFT(address nftContract) public onlyOwner nonReentrant {
        require(nextWithdrawal == 0, "withdrawal in progress");

        LiquidInfrastructureNFT nft = LiquidInfrastructureNFT(nftContract);
        address nftOwner = nft.ownerOf(nft.AccountId());

        // If this contract is not the owner of the NFT, transfer it
        if (nftOwner != address(this)) {
            nft.transferFrom(msg.sender, address(this), nft.AccountId());
            require(nft.ownerOf(nft.AccountId()) == address(this), "nft transfer");
        }
        ManagedNFTs.push(nftContract);
        emit AddManagedNFT(nftContract);
    }

    /**
     * @notice Transfers a LiquidInfrastructureNFT contract out of the control of this contract
     * @dev LiquidInfrastructureNFTs only hold a single token with a specific id (AccountId), this function
     * only transfers the token with that specific id
     *
     * @param nftContract the NFT to release
     * @param to the new owner of the NFT
     */
    function releaseManagedNFT(
        address nftContract,
        address to
    ) public onlyOwner nonReentrant {
        require(nextWithdrawal == 0, "withdrawal in progress");

        LiquidInfrastructureNFT nft = LiquidInfrastructureNFT(nftContract);

        bool found = false;
        // Remove the released NFT from the collection
        for (uint i = 0; i < ManagedNFTs.length; i++) {
            address managed = ManagedNFTs[i];
            if (managed == nftContract) {
                found = true;
                // Delete by copying in the last element and then pop the end
                ManagedNFTs[i] = ManagedNFTs[ManagedNFTs.length - 1];
                ManagedNFTs.pop();
                break;
            }
        }
        // By this point the NFT should have been found and removed from ManagedNFTs
        require(found, "NFT not Managed");
        nft.transferFrom(address(this), to, nft.AccountId());

        emit ReleaseManagedNFT(nftContract, to);
    }

    /// @dev the ERC20s which may be distributed to stakers
    address[] private distributableERC20s;

    /// @notice Allows the owner to add a new ERC20 to be distributed to holders
    /// @param newERC20  The new list value to set
    function addDistributableERC20(
        IERC20 newERC20
    ) public onlyOwner {
        require(nextWithdrawal == 0, "withdrawal in progress");
        distributableERC20s.push(address(newERC20));
        _ssDistributableHoldings.push(0);
        revenueAccumsPerStake.push(FixedPoint.q128x64(0));
        emit DistributableERC20Added(address(newERC20));
    }

    /// @notice Returns the list of ERC20s which are distributed to holders
    function getDistributableERC20s() public view returns (address[] memory) {
        return distributableERC20s;
    }

    /**
     * @notice Allows the owner to transfer ERC20s not on the distributableERC20s list to a recipient
     * This function is particularly useful for removing balances from the contract which were collected
     * through a ManagedNFT with misconfigured thresholds
     * @param token the ERC20 token to transfer
     * @param recipient the recipient of the tokens
     */
    function transferNondistributableERC20(
        address token, 
        address recipient
    ) public onlyOwner {
        for (uint i = 0; i < distributableERC20s.length; i++) {
            require(distributableERC20s[i] != token, "token is distributable");
        }
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(recipient, balance);
        emit NondistributableTransfer(token, balance, recipient);
    }

    /// @notice Withdraws revenue from all of the managed NFTs. This call may cause gas errors, in which case
    /// the caller should repeatedly call withdrawFromManagedNFTs() with a smaller number of withdrawals.
    function withdrawFromAllManagedNFTs() public {
        withdrawFromManagedNFTs(ManagedNFTs.length);
    }

    /// @dev Used to store the starting balances of the distributable ERC20s for updating the revenueAccumsPerStake values
    uint256[] _ssDistributableHoldings;
    uint256 nextWithdrawal;

    /// @notice Performs withdrawals from the ManagedNFTs collection, depositing all token balances into the custody of this contract
    /// @param numWithdrawals the number of withdrawals to perform
    function withdrawFromManagedNFTs(uint256 numWithdrawals) public {
        require(totalStake > 0, "no stakers");
        _snapshotDistributableHoldings();
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
        _updateRevenueAccumulators();
    } 

    /// @dev stores the distributable holdings at the start of a withdrawal
    function _snapshotDistributableHoldings() internal {
        for (uint i = 0; i < distributableERC20s.length; i++) {
            uint256 balance = IERC20(distributableERC20s[i]).balanceOf(address(this));
            _ssDistributableHoldings[i] = balance;
        }
    }

    /// @dev updates the revenueAccumsPerStake values based on the newly withdrawn revenue
    function _updateRevenueAccumulators() internal {
        for (uint i = 0; i < distributableERC20s.length; i++) {
            uint256 balance = IERC20(distributableERC20s[i]).balanceOf(address(this));
            uint256 diff = balance - _ssDistributableHoldings[i];
            
            if (diff > 0) {
                // Warning: overflow risk here - the math is all checked but the tx can revert
                // The accumulators store the total revenue divided by the total stake at the time of collection
                // increase = diff / totalStake
                FixedPoint.q128x64 memory increase = FixedPoint.toQ128x64(FixedPoint.divQ128(FixedPoint.toQ128x64(diff), FixedPoint.toQ128x64(totalStake)));
                // accumulator += increase
                revenueAccumsPerStake[i] = FixedPoint.addQ128(revenueAccumsPerStake[i], increase);
            }
        }
    }

    /**
     * @notice Allows the owner to update the thresholds for a ManagedNFT
     * @param nft the ManagedNFT to update
     * @param newErc20s the address[] parameter to nft.setThresholds()
     * @param newAmounts the uint256[] parameter to nft.setThresholds()
     */
    function setManagedNFTThresholds(
        address nft,
        address[] calldata newErc20s,
        uint256[] calldata newAmounts
    ) public onlyOwner {
        for (uint i = 0; i < ManagedNFTs.length; i++) {
            if (ManagedNFTs[i] == nft) {
                LiquidInfrastructureNFT(nft).setThresholds(newErc20s, newAmounts);
                emit SetManagedNFTThresholds(nft, newErc20s, newAmounts);
                return;
            }
        }
        revert("nft not Managed");
    }
    
    ////////////////////////// Staking //////////////////////////

    /// @dev The amount of fully staked tokens by holder address, with the snapshotted revenue accumulators
    struct StakePosition {
        uint256 amount;
        FixedPoint.q128x64[] snapshotAccumulators;
    }
    mapping(address => StakePosition) stakes;

    /// @dev The total amount of vested stake in the contract
    uint256 public totalStake;

    function getStake(address holder) public view returns (uint256) {
        return stakes[holder].amount;
    }

    /**
     * @notice Allows the caller to stake their tokens in the contract
     * @param amount the amount of tokens to stake
     */
    function stake(uint256 amount) public nonReentrant {
        _stakeFor(msg.sender, amount);
    }

    function _stakeFor(address staker, uint256 amount) internal {
        require(balanceOf(staker) >= amount, "insufficient balance");
        _transfer(staker, address(this), amount);
        StakePosition storage position = stakes[staker];
        if (position.amount > 0) {
            _claimRevenueFor(staker);
        }

        position.amount += amount;
        totalStake += amount;
        position.snapshotAccumulators = revenueAccumsPerStake;
        stakes[staker] = position;

        emit Stake(staker, amount);
    }

    /**
     * @notice Allows the caller to unstake their entire staking position from the contract
     * The caller's revenue will be claimed as part of this operation
     */
    function unstake(uint256 amount) public {
        _unstakeFor(msg.sender, amount);
    }

    function _unstakeFor(address staker, uint256 amount) internal {
        StakePosition storage position = stakes[staker];
        require(position.amount > 0, "no position to unstake");
        require(amount <= position.amount, "amount too large");
        _claimRevenueFor(staker);
        totalStake -= amount;
        _transfer(address(this), staker, amount);

        position.amount -= amount;
        if (position.amount == 0) {
            delete stakes[staker];
        } else {
            stakes[staker] = position;
        }

        emit Unstake(staker, amount);
    }

    /** 
     * @dev revenue accumulator values per stake for each distributable ERC20
     * these "accumulator" values track LiquidInfrastructureNFT withdrawals and are used to calculate the reward
     * for each user based on their share of the total supply
     * 
     * We store the total rewards accumulated per distributable ERC20 divided by the total amount of stake at the point of withdrawal
     * For a holder to earn rewards, they must first stake their token holding, whereby the current accumulator is 
     * snapshotted for the holder. Later when they claim rewards or unstake, their rewards will be [stake * (current accumulator - snapshot accumulator)]
     * The direct values here represents a staker who staked a single wei at contract genesis and has never unstaked, claimed revenue, or restaked other amounts
     * and would be entitled to the truncated value of the accumulator if they were to unstake, claim revenue, or restake right now
     */
    FixedPoint.q128x64[] private revenueAccumsPerStake;

    /**
     * @notice Allows the contract owner to mint tokens for an address
     */
    function mint(
        address account,
        uint256 amount
    ) public onlyOwner nonReentrant {
        _mint(account, amount);
    }

    /**
     * @notice Mints new tokens to `account` and stakes them
     */
    function mintStaked(
        address account,
        uint256 amount
    ) public onlyOwner nonReentrant {
        _mint(account, amount);
        _stakeFor(account, amount);
    }


    ////////////////////////// Revenue Claiming //////////////////////////

    /// @notice The address of the LiquidInfrastructureMulticlaim contract, which is allowed to call claimRevenueFor()
    /// on behalf of stakers.
    address public multiclaim;

    /// @notice Stakers may claim any accrued revenue for their staking position
    /// @dev revenue must be claimed when unstaking or increasing stake amount
    function claimRevenue() public nonReentrant {
        _claimRevenueFor(msg.sender);
    }

    /// @notice Stakers may use the multiclaim contract to claim revenue for multiple LiquidInfrastructureERC20 instances
    function claimRevenueFor(address staker) public nonReentrant {
        require(msg.sender == multiclaim, "invalid caller");
        _claimRevenueFor(staker);
    }

    /// @dev Claims revenue for a staker
    function _claimRevenueFor(address staker) internal {
        StakePosition storage position = stakes[staker];
        require(position.amount > 0, "invalid staking position");
        // It is possible this position was made before a distributable ERC20 was added, so we add 0 for each missing value
        while (position.snapshotAccumulators.length < distributableERC20s.length) {
            position.snapshotAccumulators.push(FixedPoint.q128x64(0));
        }

        // Withdraw all allocated rewards for each distributable ERC20
        for (uint i = 0; i < distributableERC20s.length; i++) {
            // Get the current accumulator value for the relevant ERC20
            FixedPoint.q128x64 memory accum = revenueAccumsPerStake[i];
            // Calculate the entitlement per staked token (current accumulator - snapshot)
            FixedPoint.q128x64 memory entitlement = FixedPoint.subQ128(accum, position.snapshotAccumulators[i]);
            // The actual revenue is (staked amount) * (entitlement per stake)
            uint256 revenue = FixedPoint.toUint(FixedPoint.mulQ128(entitlement, FixedPoint.toQ128x64(position.amount)));
            SafeERC20.safeTransfer(IERC20(distributableERC20s[i]), staker, revenue);
        }
        // Update the accumulator snapshots
        position.snapshotAccumulators = revenueAccumsPerStake;
        stakes[staker] = position;
        
        emit ClaimRevenue(staker);
    }

    /// @notice Allows anyone to estimate the revenue owed to a stakers' position
    function estimateRevenueFor(address staker) public view returns (uint256[] memory) {
        StakePosition storage position = stakes[staker];
        uint256[] memory revenues = new uint256[](distributableERC20s.length);

        // Much like _claimRevenueFor() this position may have been created before a new distributableERC20 was added,
        // in which case we need to pad the snapshotAccumulators with 0s for those new ERC20s. To do so we
        // create a local copy of the snapshotAccumulators which has the expected length
        FixedPoint.q128x64[] memory snapshots = new FixedPoint.q128x64[](distributableERC20s.length);

        // Now we copy existing values, leaving 0's for any new ERC20s
        for (uint i = 0; i < distributableERC20s.length; i++) {
            if (i < position.snapshotAccumulators.length) {
                snapshots[i] = position.snapshotAccumulators[i];
            }
            // Otherwise, the snapshot value remains 0
        }

        // Estimate the revenue by calculating entitlement * amount for each ERC20
        for (uint i = 0; i < distributableERC20s.length; i++) {
            // Get the current accumulator value for the relevant ERC20
            FixedPoint.q128x64 memory accum = revenueAccumsPerStake[i];
            // Calculate the entitlement per staked token (current accumulator - snapshot)
            FixedPoint.q128x64 memory entitlement = FixedPoint.subQ128(accum, snapshots[i]);
            // The actual reward is (staked amount) * (entitlement per stake)
            uint256 revenue = FixedPoint.toUint(FixedPoint.mulQ128(entitlement, FixedPoint.toQ128x64(position.amount)));
            revenues[i] = revenue;
        }

        return revenues;
    }

    /**
     * Constructs the underlying ERC20 and initializes critical variables
     *
     * @param _name The name of the underlying ERC20
     * @param _symbol The symbol of the underlying ERC20
     * @param _approvedHolders The addresses of the initial allowed holders
     * @param _distributableErc20s The addresses of ERC20s which should be distributed from ManagedNFTs to holders
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address initialOwner,
        address[] memory _approvedHolders,
        address[] memory _distributableErc20s,
        address _multiclaim
    ) ERC20(_name, _symbol) Ownable(initialOwner == address(0) ? msg.sender : initialOwner) {
        multiclaim = _multiclaim;

        for (uint i = 0; i < _approvedHolders.length; i++) {
            HolderAllowlist[_approvedHolders[i]] = true;
        }

        distributableERC20s = _distributableErc20s;
        _ssDistributableHoldings = new uint256[](_distributableErc20s.length);
        for (uint i = 0; i < _distributableErc20s.length; i++) {
            revenueAccumsPerStake.push(FixedPoint.q128x64(0));
        }
        nextWithdrawal = 0;

        emit Deployed();
    }
}
