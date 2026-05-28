// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMatchPulseHook} from "../contracts/interfaces/IMatchPulseHook.sol";
import {IMatchOracle} from "../contracts/interfaces/IMatchOracle.sol";
import {MatchOracleMock} from "../contracts/MatchOracleMock.sol";
import {MatchPulseHook} from "../contracts/MatchPulseHook.sol";
import {PredictionToken} from "../contracts/PredictionToken.sol";
import {SimulatedPoolManager} from "../contracts/SimulatedPoolManager.sol";
import {WorldCupMarketFactory} from "../contracts/WorldCupMarketFactory.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function prank(address caller) external;
    function expectRevert(bytes4 selector) external;
}

contract MatchPulseTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant MATCH_ID = keccak256("ARG-BRA-2026-QF");

    MatchOracleMock private oracle;
    MatchPulseHook private hook;
    SimulatedPoolManager private poolManager;
    WorldCupMarketFactory private factory;

    address private alice = address(0xA11CE);

    function setUp() public {
        oracle = new MatchOracleMock(address(this));
        factory = new WorldCupMarketFactory(oracle, address(this));
        oracle.createMatch(MATCH_ID, "Argentina", "Brazil", uint64(block.timestamp + 2 days));
        factory.createMarket(MATCH_ID, "Argentina", "Brazil");

        hook = new MatchPulseHook(oracle, address(this));
        poolManager = new SimulatedPoolManager(hook);
        hook.setPoolManager(address(poolManager));

        vm.deal(alice, 10 ether);
    }

    function testDynamicFeeRisesDuringLateRedCardPressure() public {
        address homeToken = factory.outcomeToken(MATCH_ID, WorldCupMarketFactory.Outcome.Home);
        address awayToken = factory.outcomeToken(MATCH_ID, WorldCupMarketFactory.Outcome.Away);
        IMatchPulseHook.PoolKey memory key = IMatchPulseHook.PoolKey({
            token0: homeToken,
            token1: awayToken,
            baseFeeBps: 30,
            matchId: MATCH_ID
        });
        bytes32 poolId = poolManager.createPool(key);

        (uint24 scheduledFee,, string memory scheduledReason) = poolManager.simulateSwap(poolId, true, 1 ether, 2_500);
        _assertEq(scheduledFee, uint24(30), "scheduled fee");
        _assertEq(scheduledReason, "scheduled baseline", "scheduled reason");

        oracle.updateMatch(MATCH_ID, IMatchOracle.Phase.LiveSecondHalf, 84, 1, 1, 1, true);
        (uint24 liveFee, uint256 liveVolatility, string memory liveReason) =
            poolManager.simulateSwap(poolId, false, 3 ether, 15_000);

        _assertEq(liveFee, uint24(145), "live fee");
        _assertEq(liveVolatility, 38, "volatility");
        _assertEq(liveReason, "upset signal", "live reason");

        (uint256 totalVolumeUsd, uint256 swapCount, uint24 lastFeeBps,, uint16 lastConcentration, int24 lastLower, int24 lastUpper,,) =
            hook.poolMetrics(poolId);
        _assertEq(swapCount, 2, "swap count");
        _assertEq(totalVolumeUsd, 17_500, "total volume");
        _assertEq(lastFeeBps, uint24(145), "last fee");
        _assertEq(lastConcentration, uint16(8700), "last concentration");
        _assertEq(lastLower, -207, "last lower tick");
        _assertEq(lastUpper, 207, "last upper tick");
        _assertEq(uint256(uint24(lastUpper - lastLower)), 414, "last band width");
    }

    function testTwclConvergesLiquidityDuringInjuryTime() public {
        (uint16 scheduledConcentration, int24 scheduledLower, int24 scheduledUpper,) = hook.quoteLiquidityBand(MATCH_ID);

        oracle.updateMatch(MATCH_ID, IMatchOracle.Phase.LiveSecondHalf, 92, 2, 2, 1, true);
        (uint16 injuryConcentration, int24 injuryLower, int24 injuryUpper, string memory reason) =
            hook.quoteLiquidityBand(MATCH_ID);

        _assertEq(scheduledConcentration, uint16(1500), "scheduled TWCL concentration");
        _assertLt(uint256(uint24(injuryUpper - injuryLower)), uint256(uint24(scheduledUpper - scheduledLower)), "narrower band");
        _assertGt(injuryConcentration, scheduledConcentration, "higher concentration");
        _assertEq(uint256(uint24(injuryUpper - injuryLower)), 240, "minimum injury-time band");
        _assertEq(reason, "injury-time doom option", "injury-time reason");
    }

    function testMarketMintsCompleteSetsAndRedeemsWinner() public {
        vm.prank(alice);
        factory.mintCompleteSet{value: 3 ether}(MATCH_ID);

        address homeToken = factory.outcomeToken(MATCH_ID, WorldCupMarketFactory.Outcome.Home);
        address drawToken = factory.outcomeToken(MATCH_ID, WorldCupMarketFactory.Outcome.Draw);
        address awayToken = factory.outcomeToken(MATCH_ID, WorldCupMarketFactory.Outcome.Away);
        _assertEq(PredictionToken(homeToken).balanceOf(alice), 3 ether, "home balance");
        _assertEq(PredictionToken(drawToken).balanceOf(alice), 3 ether, "draw balance");
        _assertEq(PredictionToken(awayToken).balanceOf(alice), 3 ether, "away balance");

        oracle.updateMatch(MATCH_ID, IMatchOracle.Phase.Finalized, 95, 2, 1, 0, false);
        factory.settle(MATCH_ID);

        uint256 balanceBefore = alice.balance;
        vm.prank(alice);
        factory.redeem(MATCH_ID, 3 ether);

        _assertEq(alice.balance - balanceBefore, 3 ether, "payout");
        _assertEq(PredictionToken(homeToken).balanceOf(alice), 0, "burned home balance");
    }

    function testCannotSettleBeforeFinalWhistle() public {
        vm.prank(alice);
        factory.mintCompleteSet{value: 1 ether}(MATCH_ID);

        oracle.updateMatch(MATCH_ID, IMatchOracle.Phase.LiveSecondHalf, 88, 1, 1, 0, true);
        vm.expectRevert(WorldCupMarketFactory.NotFinalized.selector);
        factory.settle(MATCH_ID);
    }

    function _assertGt(uint256 left, uint256 right, string memory label) private pure {
        if (left <= right) revert(string.concat("assertGt failed: ", label));
    }

    function _assertLt(uint256 left, uint256 right, string memory label) private pure {
        if (left >= right) revert(string.concat("assertLt failed: ", label));
    }

    function _assertEq(uint256 left, uint256 right, string memory label) private pure {
        if (left != right) revert(string.concat("assertEq failed: ", label));
    }

    function _assertEq(int24 left, int24 right, string memory label) private pure {
        if (left != right) revert(string.concat("assertEq failed: ", label));
    }

    function _assertEq(string memory left, string memory right, string memory label) private pure {
        if (keccak256(bytes(left)) != keccak256(bytes(right))) revert(string.concat("assertEq failed: ", label));
    }
}
