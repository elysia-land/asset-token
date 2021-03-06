// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;

interface IAssetTokenBase {
    function setEController(address newEController) external;
    function setRewardPerBlock(uint256 newRewardPerBlock) external;
    function pause() external;
    function unpause() external;
    function getLatitude() external view returns (uint256);
    function getLongitude() external view returns (uint256);
    function getInterestRate() external view returns (uint256);
    function getPrice() external view returns (uint256);
    function getPayment() external view returns (address);
    function getReward(address account) external view returns (uint256);
    function tokenMatured() external view returns (bool);
}

interface IAssetTokenERC20 {
    function purchase(uint256 spent) external;
    function refund(uint256 amount) external;
    function claimReward() external;
}

interface IAssetTokenEth {
    function purchase() external payable;
    function refund(uint256 amount) external;
    function claimReward() external;
}
