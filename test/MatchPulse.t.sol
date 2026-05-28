// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMatchPulseHook} from "../contracts/interfaces/IMatchPulseHook.sol";
import {IMatchOracle} from "../contracts/interfaces/IMatchOracle.sol";
import {MatchOracleMock} from "../contracts/MatchOracleMock.sol";
import {MatchPulseOracle} from "../contracts/MatchPulseOracle.sol";
import {MatchPulseHook} from "../contracts/MatchPulseHook.sol";
import {AgentExecutor} from "../contracts/AgentExecutor.sol";
import {MatchPulsePaymaster} from "../contracts/MatchPulsePaymaster.sol";
import {PredictionToken} from "../contracts/PredictionToken.sol";
import {SimulatedPoolManager} from "../contracts/SimulatedPoolManager.sol";
import {WorldCupMarketFactory} from "../contracts/WorldCupMarketFactory.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function prank(address caller) external;
    function expectRevert(bytes4 selector) external;
    function warp(uint256 newTimestamp) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external returns (address);
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

        (
            uint256 totalVolumeUsd,
            uint256 swapCount,
            ,
            uint24 lastFeeBps,
            ,
            uint16 lastConcentration,
            int24 activeTick,
            int24 lastLower,
            int24 lastUpper,
            uint256 vaultCreditBps,
            ,
        ) =
            hook.poolMetrics(poolId);
        _assertEq(swapCount, 2, "swap count");
        _assertEq(totalVolumeUsd, 17_500, "total volume");
        _assertEq(lastFeeBps, uint24(145), "last fee");
        _assertEq(lastConcentration, uint16(8700), "last concentration");
        _assertEq(activeTick, -150, "active tick");
        _assertEq(lastLower, -357, "last lower tick");
        _assertEq(lastUpper, 57, "last upper tick");
        _assertEq(vaultCreditBps, 52, "vault credit");
        _assertEq(uint256(uint24(lastUpper - lastLower)), 414, "last band width");
    }

    function testTwclConvergesLiquidityDuringInjuryTime() public {
        (uint16 scheduledConcentration,, int24 scheduledLower, int24 scheduledUpper,,) = hook.quoteLiquidityBand(MATCH_ID);

        oracle.updateMatch(MATCH_ID, IMatchOracle.Phase.LiveSecondHalf, 92, 2, 2, 1, true);
        (uint16 injuryConcentration, int24 activeTick, int24 injuryLower, int24 injuryUpper, uint256 vaultCreditBps, string memory reason) =
            hook.quoteLiquidityBand(MATCH_ID);

        _assertEq(scheduledConcentration, uint16(1500), "scheduled TWCL concentration");
        _assertLt(uint256(uint24(injuryUpper - injuryLower)), uint256(uint24(scheduledUpper - scheduledLower)), "narrower band");
        _assertGt(injuryConcentration, scheduledConcentration, "higher concentration");
        _assertEq(activeTick, -150, "injury active tick");
        _assertEq(uint256(uint24(injuryUpper - injuryLower)), 240, "minimum injury-time band");
        _assertEq(vaultCreditBps, 58, "vault credit");
        _assertEq(reason, "injury-time doom option", "injury-time reason");
    }

    function testBeforeModifyPositionRebalancesAroundActiveTick() public {
        address homeToken = factory.outcomeToken(MATCH_ID, WorldCupMarketFactory.Outcome.Home);
        address awayToken = factory.outcomeToken(MATCH_ID, WorldCupMarketFactory.Outcome.Away);
        IMatchPulseHook.PoolKey memory key = IMatchPulseHook.PoolKey({
            token0: homeToken,
            token1: awayToken,
            baseFeeBps: 30,
            matchId: MATCH_ID
        });
        bytes32 poolId = poolManager.createPool(key);

        oracle.updateMatch(MATCH_ID, IMatchOracle.Phase.LiveSecondHalf, 92, 2, 2, 1, true);
        (uint16 concentrationBps, int24 activeTick, int24 tickLower, int24 tickUpper, string memory reason) =
            poolManager.simulateModifyPosition(poolId, -2400, 2400, 10_000);

        _assertEq(concentrationBps, uint16(9800), "position concentration");
        _assertEq(activeTick, -150, "position active tick");
        _assertEq(tickLower, -270, "position lower");
        _assertEq(tickUpper, -30, "position upper");
        _assertEq(reason, "injury-time doom option", "position reason");

        (,, uint256 rebalanceCount,,,,,,,,,) = hook.poolMetrics(poolId);
        _assertEq(rebalanceCount, 1, "rebalance count");
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

    function testEip712OracleAcceptsTrustedSignerOnly() public {
        uint256 signerKey = 0xA11CE;
        address signer = vm.addr(signerKey);
        MatchPulseOracle signedOracle = new MatchPulseOracle(address(this), signer);
        signedOracle.createMatch(MATCH_ID, "Argentina", "Brazil", uint64(block.timestamp + 2 days));

        MatchPulseOracle.SignedMatchState memory update = MatchPulseOracle.SignedMatchState({
            matchId: MATCH_ID,
            phase: IMatchOracle.Phase.LiveSecondHalf,
            minute: 80,
            homeScore: 1,
            awayScore: 1,
            redCards: 1,
            upsetSignal: true,
            observedAt: uint64(block.timestamp),
            deadline: uint64(block.timestamp + 5 minutes),
            nonce: 0,
            evidenceHash: keccak256("espn+opta+frame")
        });
        bytes32 digest = signedOracle.hashTypedData(update);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        signedOracle.updateMatchState(update, abi.encodePacked(r, s, v));

        IMatchOracle.MatchState memory state = signedOracle.getMatch(MATCH_ID);
        _assertEq(uint256(state.minute), 80, "oracle minute");
        _assertEq(uint256(state.redCards), 1, "oracle red card");
        _assertEq(signedOracle.nonces(MATCH_ID), 1, "oracle nonce");

        vm.expectRevert(MatchPulseOracle.InvalidNonce.selector);
        signedOracle.updateMatchState(update, abi.encodePacked(r, s, v));
    }

    function testAgentExecutorRequiresUserAndSessionSignatures() public {
        uint256 userKey = 0xB0B;
        uint256 sessionKey = 0xC0A;
        address user = vm.addr(userKey);
        address session = vm.addr(sessionKey);
        AgentExecutor executor = new AgentExecutor();
        NoopRouter router = new NoopRouter();

        AgentExecutor.SessionKeyAuthorization memory auth = AgentExecutor.SessionKeyAuthorization({
            user: user,
            sessionKey: session,
            router: address(router),
            tokenIn: address(0x1111),
            tokenOut: address(0x2222),
            matchId: MATCH_ID,
            maxSpend: 1 ether,
            validAfter: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 1 hours),
            nonce: 0
        });
        AgentExecutor.AgentIntent memory intent = AgentExecutor.AgentIntent({
            user: user,
            sessionKey: session,
            router: address(router),
            tokenIn: address(0x1111),
            tokenOut: address(0x2222),
            matchId: MATCH_ID,
            amountIn: 0.2 ether,
            minAmountOut: 0.19 ether,
            deadline: block.timestamp + 5 minutes,
            nonce: 0,
            strategyId: keccak256("fanatic-fan"),
            callData: abi.encodeWithSelector(NoopRouter.route.selector, user, uint256(0.2 ether))
        });

        bytes memory userSig = _sign(userKey, executor.hashAuthorization(auth));
        bytes memory sessionSig = _sign(sessionKey, executor.hashIntent(intent));

        executor.execute(auth, userSig, intent, sessionSig);
        _assertEq(router.lastAmount(), 0.2 ether, "routed amount");

        vm.expectRevert(AgentExecutor.InvalidNonce.selector);
        executor.execute(auth, userSig, intent, sessionSig);
    }

    function testPaymasterQuotesTokenGasCharge() public {
        MatchPulsePaymaster paymaster = new MatchPulsePaymaster(address(this));
        address token = address(0xCAFE);
        paymaster.setGasTokenPrice(token, 2e15);

        uint256 charge = paymaster.recordSponsoredGas(alice, token, 4e15, MATCH_ID);
        _assertEq(charge, 2 ether, "gas token charge");
    }

    function _sign(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
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

contract NoopRouter {
    address public lastUser;
    uint256 public lastAmount;

    function route(address user, uint256 amount) external returns (bool) {
        lastUser = user;
        lastAmount = amount;
        return true;
    }
}
