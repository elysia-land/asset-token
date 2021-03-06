// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

import "../AssetTokenBase.sol";

contract AssetTokenBaseTest is AssetTokenBase {
    constructor(
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
    )
    {
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
        _transfer(address(this), msg.sender, amount_/2);
    }

    function saveReward(address account) external returns (bool) {
        return _saveReward(account);
    }

    function setInitialBlock(uint256 initialBlock) external {
        initialBlocknumber = initialBlock;
    }

    function setBlockRemaining(uint256 newBlockRemaining) external {
        blockRemaining = newBlockRemaining;
    }

    function clearReward(address account) external returns (bool) {
        return _clearReward(account);
    }
}