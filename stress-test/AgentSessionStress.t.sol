// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AgentExecutor} from "../contracts/AgentExecutor.sol";
import {IMatchPulseHook} from "../contracts/interfaces/IMatchPulseHook.sol";
import {IMatchOracle} from "../contracts/interfaces/IMatchOracle.sol";
import {MatchOracleMock} from "../contracts/MatchOracleMock.sol";
import {MatchPulseHook} from "../contracts/MatchPulseHook.sol";
import {SimulatedPoolManager} from "../contracts/SimulatedPoolManager.sol";
import {WorldCupMarketFactory} from "../contracts/WorldCupMarketFactory.sol";

interface Vm {
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external returns (address);
    function warp(uint256 newTimestamp) external;
}

contract AgentSessionStress {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant MATCH_ID = keccak256("ARG-BRA-2026-QF");
    uint256 private constant AGENTS = 240;

    AgentExecutor private executor;
    StressRouter private router;
    MatchOracleMock private oracle;
    MatchPulseHook private hook;
    SimulatedPoolManager private poolManager;
    bytes32 private poolId;

    function setUp() public {
        executor = new AgentExecutor();
        router = new StressRouter();
        oracle = new MatchOracleMock(address(this));
        oracle.createMatch(MATCH_ID, "Argentina", "Brazil", uint64(block.timestamp + 2 days));
        WorldCupMarketFactory factory = new WorldCupMarketFactory(oracle, address(this));
        WorldCupMarketFactory.Market memory market = factory.createMarket(MATCH_ID, "Argentina", "Brazil");
        hook = new MatchPulseHook(oracle, address(this));
        poolManager = new SimulatedPoolManager(hook);
        hook.setPoolManager(address(poolManager));
        poolId = poolManager.createPool(
            IMatchPulseHook.PoolKey({
                token0: market.homeToken,
                token1: market.awayToken,
                baseFeeBps: 30,
                matchId: MATCH_ID
            })
        );
    }

    function testAgentSessionBurstAndHookRebalance() public {
        oracle.updateMatch(MATCH_ID, IMatchOracle.Phase.LiveSecondHalf, 89, 1, 1, 1, true);

        uint256 gasStart = gasleft();
        for (uint256 index = 0; index < AGENTS; index++) {
            _executeAgent(index);
            poolManager.simulateSwap(poolId, index % 2 == 0, int256(1 ether), 1_000 + index);
            if (index % 12 == 0) {
                poolManager.simulateModifyPosition(poolId, -2400, 2400, int128(int256(10_000 + index)));
            }
            if (index % 24 == 0) vm.warp(block.timestamp + 1);
        }
        uint256 gasUsed = gasStart - gasleft();

        if (router.routedCount() != AGENTS) revert("stress: all agent intents should route");
        (uint256 totalVolumeUsd, uint256 swapCount, uint256 rebalances,,,,,,,,,) = hook.poolMetrics(poolId);
        if (swapCount != AGENTS) revert("stress: swap count mismatch");
        if (rebalances != 20) revert("stress: rebalance count mismatch");
        if (totalVolumeUsd <= AGENTS * 1_000) revert("stress: volume did not accumulate");
        if (gasUsed == 0) revert("stress: gas accounting failed");
    }

    function _executeAgent(uint256 index) private {
        uint256 userKey = 10_000 + index * 2;
        uint256 sessionKey = 10_001 + index * 2;
        address user = vm.addr(userKey);
        address session = vm.addr(sessionKey);

        AgentExecutor.SessionKeyAuthorization memory auth = AgentExecutor.SessionKeyAuthorization({
            user: user,
            sessionKey: session,
            router: address(router),
            tokenIn: address(0x1111),
            tokenOut: address(0x2222),
            matchId: MATCH_ID,
            maxSpend: 1 ether,
            validAfter: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 10 seconds),
            nonce: 0
        });
        AgentExecutor.AgentIntent memory intent = AgentExecutor.AgentIntent({
            user: user,
            sessionKey: session,
            router: address(router),
            tokenIn: address(0x1111),
            tokenOut: address(0x2222),
            matchId: MATCH_ID,
            amountIn: 0.1 ether,
            minAmountOut: 0.095 ether,
            deadline: block.timestamp + 10 seconds,
            nonce: 0,
            strategyId: keccak256(abi.encode("burst", index)),
            callData: abi.encodeWithSelector(StressRouter.route.selector, user, uint256(0.1 ether))
        });

        executor.execute(auth, _sign(userKey, executor.hashAuthorization(auth)), intent, _sign(sessionKey, executor.hashIntent(intent)));
    }

    function _sign(uint256 key, bytes32 digest) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}

contract StressRouter {
    uint256 public routedCount;
    uint256 public routedAmount;

    function route(address, uint256 amount) external returns (bool) {
        routedCount += 1;
        routedAmount += amount;
        return true;
    }
}
