// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMatchPulseHook} from "../contracts/interfaces/IMatchPulseHook.sol";
import {AgentExecutor} from "../contracts/AgentExecutor.sol";
import {MatchPulseOracle} from "../contracts/MatchPulseOracle.sol";
import {MatchPulseHook} from "../contracts/MatchPulseHook.sol";
import {MatchPulsePaymaster} from "../contracts/MatchPulsePaymaster.sol";
import {SimulatedPoolManager} from "../contracts/SimulatedPoolManager.sol";
import {WorldCupMarketFactory} from "../contracts/WorldCupMarketFactory.sol";

interface Vm {
    function envUint(string calldata name) external view returns (uint256 value);
    function addr(uint256 privateKey) external returns (address keyAddr);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 internal constant MATCH_ID = keccak256("ARG-BRA-2026-QF");

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MatchPulseOracle oracle = new MatchPulseOracle(deployer, deployer);
        WorldCupMarketFactory factory = new WorldCupMarketFactory(oracle, deployer);
        MatchPulseHook hook = new MatchPulseHook(oracle, deployer);
        SimulatedPoolManager poolManager = new SimulatedPoolManager(hook);
        new AgentExecutor();
        new MatchPulsePaymaster(deployer);
        hook.setPoolManager(address(poolManager));

        oracle.createMatch(MATCH_ID, "Argentina", "Brazil", uint64(block.timestamp + 7 days));
        WorldCupMarketFactory.Market memory market = factory.createMarket(MATCH_ID, "Argentina", "Brazil");

        IMatchPulseHook.PoolKey memory poolKey = IMatchPulseHook.PoolKey({
            token0: market.homeToken,
            token1: market.awayToken,
            baseFeeBps: 30,
            matchId: MATCH_ID
        });
        poolManager.createPool(poolKey);

        vm.stopBroadcast();
    }
}
