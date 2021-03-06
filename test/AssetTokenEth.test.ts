import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { deployContract } from "ethereum-waffle";
import {expandToDecimals} from "./utils/Ethereum";
import makeEPriceOracleTest from "./utils/makeEPriceOracle";

import { EControllerTest } from "../typechain/EControllerTest";
import { AssetTokenEthTest } from "../typechain/AssetTokenEthTest"
import EControllerArtifact from "../artifacts/contracts/test/EControllerTest.sol/EControllerTest.json"
import AssetTokenEthArtifact from "../artifacts/contracts/test/AssetTokenEthTest.sol/AssetTokenEthTest.json"

describe("AssetTokenEth", () => {
    let assetTokenEth: AssetTokenEthTest;
    let eController: EControllerTest;

    const amount_ = expandToDecimals(10000, 18)
    const price_ = expandToDecimals(5, 18)
    const rewardPerBlock_ = expandToDecimals(237, 6)
    const payment_ = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
    const coordinate_ = [123, 456]
    const interestRate_ = expandToDecimals(1, 17)
    const cashReserveRatio_ = expandToDecimals(5, 17)
    const name_ = "ExampleAsset"
    const symbol_ = "EA"

    const provider = waffle.provider;
    const [admin, account1, account2] = provider.getWallets()

    beforeEach(async () => {
        eController = await deployContract(
            admin,
            EControllerArtifact
        ) as EControllerTest
        assetTokenEth = await deployContract(
            admin,
            AssetTokenEthArtifact,
            [
                eController.address,
                amount_,
                price_,
                rewardPerBlock_,
                payment_,
                coordinate_,
                interestRate_,
                cashReserveRatio_,
                name_,
                symbol_,
            ],
        ) as AssetTokenEthTest
        await eController.connect(admin)
            .setAssetTokens([assetTokenEth.address])

        await makeEPriceOracleTest({
            from: admin,
            eController: eController
        })

    })

    describe(".reserve requirement system", async () => {
        it('send reserve and emit event for excess reserve', async () => {
            expect(await assetTokenEth.connect(account1).purchase({gasLimit: 999999, value: ethers.utils.parseEther("0.1")}))
                .to.emit(assetTokenEth, 'ReserveDeposited')
                .withArgs(ethers.utils.parseEther("0.1"))
            expect(await provider.getBalance(assetTokenEth.address))
                .to.be.equal(ethers.utils.parseEther("0"))
            expect(await provider.getBalance(eController.address))
                .to.be.equal(ethers.utils.parseEther("0.1"))
        })

        it('send request for insufficient reserve for payment', async () => {
            await assetTokenEth.connect(account1).purchase({gasLimit: 999999, value: ethers.utils.parseEther("0.1")})
            await expect(await assetTokenEth.connect(account1).refund(expandToDecimals(10, 18)))
                .to.emit(assetTokenEth, 'ReserveWithdrawed')
                .withArgs(ethers.utils.parseEther("0.05"))
        })

        it('cannot execute purchase, refund and claimReward when paused', async () => {
            await assetTokenEth.connect(admin).pause();
            await expect(assetTokenEth.purchase())
                .to.be.revertedWith('Pausable: paused')
            await expect(assetTokenEth.refund(expandToDecimals(20, 18)))
                .to.be.revertedWith('Pausable: paused')
            await expect(assetTokenEth.claimReward())
                .to.be.revertedWith('Pausable: paused')
        })
    })

    describe(".purchase", async () => {
        it('if account has sufficient allowed eth balance, can purchase token', async () => {
            const beforeBalance = await provider.getBalance(eController.address)
            expect(await assetTokenEth.connect(account1).purchase({gasLimit: 8888888, value: ethers.utils.parseEther("0.1")}))
                .to.changeEtherBalance(account1, ethers.utils.parseEther("-0.1"))
            // cannot use changeEtherBalnce in contract.address
            const afterBalance = await provider.getBalance(eController.address)
            expect(await assetTokenEth.balanceOf(account1.address))
                .to.be.equal(expandToDecimals(20, 18));
            expect(await assetTokenEth.balanceOf(assetTokenEth.address))
                .to.be.equal(amount_.sub(expandToDecimals(20, 18)));
            expect(afterBalance.sub(beforeBalance)).to.be.equal(
                price_.mul(20).mul(expandToDecimals(1, 18)).div((await eController.getPrice(payment_)))
            );
        })

        it('if msg.value does not have sufficient eth balance, transfer is failed', async () => {
            await expect(assetTokenEth.connect(account1).purchase())
                .to.be.revertedWith('Not enough msg.value')
        })

        it('if msg.value exceed the value of remaining tokens, transaction revert in transfer', async () => {
            await expect(assetTokenEth.connect(account1).purchase({gasLimit: 999999, value: ethers.utils.parseEther("99")}))
                .to.be.revertedWith('AssetToken: Insufficient seller balance.')
        })
    })

    describe(".refund", async () => {
        it('if account and contract has sufficient balance, refund token', async () => {
            await assetTokenEth.connect(account1).purchase({gasLimit: 8888888, value: ethers.utils.parseEther("0.1")})
            expect(await assetTokenEth.connect(account1).refund(expandToDecimals(10, 18)))
                .to.changeEtherBalance(account1, ethers.utils.parseEther("0.05"))
            expect(await assetTokenEth.balanceOf(account1.address)).to.be.equal(expandToDecimals(10, 18));
            expect(
                await assetTokenEth.balanceOf(assetTokenEth.address)
            ).to.be.equal(amount_.sub(expandToDecimals(10, 18)));
            expect(await provider.getBalance(eController.address)).to.eq(
                ethers.utils.parseEther("0.05")
            )
        })

        it('if account does not have sufficient allowed balance, transfer is failed', async () => {
            await expect(assetTokenEth.connect(account1).refund(expandToDecimals(10, 18)))
                .to.be.revertedWith('AssetToken: Insufficient seller balance.')
        })
    })

    describe('Asset token Pausable', async () => {
        it('Admin can pause asset token', async () => {
            await expect(assetTokenEth.connect(admin).pause())
                .to.emit(assetTokenEth, 'Paused')
                .withArgs(admin.address)
        })

        it('cannot execute purchase, refund and claimReward when paused', async () => {
            await assetTokenEth.connect(admin).pause();
            await expect(assetTokenEth.purchase())
                .to.be.revertedWith('Pausable: paused')
            await expect(assetTokenEth.refund(expandToDecimals(20, 18)))
                .to.be.revertedWith('Pausable: paused')
            await expect(assetTokenEth.claimReward())
                .to.be.revertedWith('Pausable: paused')
        })
    })

    // ! FIXME
    // Below test code should be excuted last
    // When other test code is excuted after this test, Uncaugh RuntimeError is raised from @ethereum-waffle
    // -- Error Message --
    // Uncaught RuntimeError: abort(AssertionError:
    // Expected "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" to change balance by 0 wei, but it has changed by 1500000000 wei).
    // Build with -s ASSERTIONS=1 for more info.
    describe('.claimReward', async () => {
        let firstBlock: number;
        let secondBlock: number;
        let thirdBlock: number;

        beforeEach(async () => {
            firstBlock = (await (await assetTokenEth.connect(account1).purchase({gasLimit: 999999, value: ethers.utils.parseEther("0.1")})).wait()).blockNumber;
            secondBlock = (await (await assetTokenEth.connect(account1).transfer(account2.address, expandToDecimals(10, 18))).wait()).blockNumber;
            thirdBlock = (await (await assetTokenEth.connect(account1).transfer(account2.address, expandToDecimals(10, 18))).wait()).blockNumber;
        })

        xit('if eController contract has not sufficient balance, transfer is failed', async () => {
            await assetTokenEth.connect(admin).withdrawToAdmin()

            await expect(assetTokenEth.connect(account1).claimReward())
                .to.be.revertedWith('AssetToken: Insufficient contract balance.')
        })

        it('account can claim reward.', async () => {
            const expectedReward = rewardPerBlock_
                .mul(
                    expandToDecimals((
                        (20 * (secondBlock - firstBlock)) +
                        (10 * (thirdBlock - secondBlock))
                    ), 18))
                .div(amount_)
                .mul(await assetTokenEth.balanceOf(account1.address))
            expect(await assetTokenEth.connect(account1).claimReward())
                .to.changeEtherBalance(account1, expectedReward)
        })
    })
})