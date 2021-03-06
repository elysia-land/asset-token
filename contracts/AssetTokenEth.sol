// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "./EController.sol";
import "./IAssetToken.sol";
import "./AssetTokenBase.sol";

contract AssetTokenEth is IAssetTokenEth, AssetTokenBase {
    using AssetTokenLibrary for AssetTokenLibrary.SpentLocalVars;
    using AssetTokenLibrary for AssetTokenLibrary.AmountLocalVars;

    function initialize(
        IEController eController_,
        uint256 amount_,
        uint256 price_,
        uint256 rewardPerBlock_,
        address payment_,
        uint256[] memory coordinate_,
        uint256 interestRate_,
        uint256 blockRemaining_,
        string memory name_,
        string memory symbol_
    ) public initializer {
        __AssetTokenBase_init(
            eController_,
            amount_,
            price_,
            rewardPerBlock_,
            payment_,
            coordinate_,
            interestRate_,
            blockRemaining_,
            name_,
            symbol_
        );
    }

    /**
     * @dev purchase asset token with eth.
     *
     * This can be used to purchase asset token with ether.
     *
     * Requirements:
     * - `msg.value` msg.sender should have more eth than msg.value.
     */
    function purchase()
        external
        payable
        override
        whenNotPaused
    {
        require(
            msg.value > 0,
            "Not enough msg.value"
        );

        AssetTokenLibrary.AmountLocalVars memory vars =
            AssetTokenLibrary.AmountLocalVars({
                spent: msg.value,
                currencyPrice: _getCurrencyPrice(),
                assetTokenPrice: price
            });

        uint256 amount = vars.getAmount();

        _checkBalance(address(this), amount);
        _transfer(address(this), msg.sender, amount);

        _depositReserve(msg.value);
    }

    /**
     * @dev refund asset token.
     *
     * This can be used to refund asset token with ether (Eth).
     *
     * Requirements:
     * - `amount` msg.sender should have more asset token than the amount.
     * - `amount` this contract should have more eth than ether converted from the amount.
     */
    function refund(uint256 amount)
        external
        override
        whenNotPaused
    {
        _checkBalance(msg.sender, amount);

        AssetTokenLibrary.SpentLocalVars memory vars =
            AssetTokenLibrary.SpentLocalVars({
                amount: amount,
                currencyPrice: _getCurrencyPrice(),
                assetTokenPrice: price
            });

        uint256 spent = vars.getSpent();

         _withdrawReserve(spent);

        require(
            address(this).balance >= spent,
            "AssetToken: Insufficient buyer balance."
        );

        _transfer(msg.sender, address(this), amount);

        AddressUpgradeable.sendValue(payable(msg.sender), spent);
    }

    /**
     * @dev Claim account reward.
     *
     * This can be used to claim account accumulated rewrard with ether (Eth).
     *
     * Emits a {RewardClaimed} event.
     *
     * Requirements:
     * - `getPrice` cannot be the zero.
     */
    function claimReward()
        external
        override
        whenNotPaused
    {
        uint256 reward = _getReward(msg.sender) * 1e18 / _getCurrencyPrice();

         _withdrawReserve(reward);

        require(
            reward <= address(this).balance,
            "AssetToken: Insufficient contract balance."
        );

        _clearReward(msg.sender);

        if (!payable(msg.sender).send(reward)) {
            _saveReward(msg.sender);
        }

        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @dev check if buyer and seller have sufficient balance.
     *
     * This can be used to check balance of buyer and seller before swap.
     *
     * Requirements:
     * - `amount` buyer should have more asset token than the amount.
     */
    function _checkBalance(
        address seller,
        uint256 amount
    ) internal view {
        require(
            balanceOf(seller) >= amount,
            "AssetToken: Insufficient seller balance."
        );
    }

    /**
     * @notice deposit reserve in the controller
     */
    function _depositReserve(uint256 reserveSurplus) internal override {
        AddressUpgradeable.sendValue(payable(address(eController)), reserveSurplus);
        emit ReserveDeposited(reserveSurplus);
    }

    /**
     * @notice withdraw reserve from the controller
     */
    function _withdrawReserve(uint256 reserveDeficit) internal override {
        require(
            eController.withdrawReserveFromAssetTokenEth(reserveDeficit),
            "withdraw failed"
        );
        emit ReserveWithdrawed(reserveDeficit);
    }
}
