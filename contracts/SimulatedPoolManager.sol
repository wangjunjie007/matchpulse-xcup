// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMatchPulseHook} from "./interfaces/IMatchPulseHook.sol";

contract SimulatedPoolManager {
    IMatchPulseHook public immutable hook;

    struct Pool {
        IMatchPulseHook.PoolKey key;
        bool exists;
    }

    mapping(bytes32 poolId => Pool pool) public pools;

    event PoolCreated(bytes32 indexed poolId, address token0, address token1, uint24 baseFeeBps, bytes32 matchId);
    event SwapSimulated(
        bytes32 indexed poolId,
        address indexed sender,
        bool zeroForOne,
        uint24 appliedFeeBps,
        uint256 volatilityScore,
        uint16 liquidityConcentrationBps,
        int24 tickLower,
        int24 tickUpper,
        string reason
    );

    error PoolExists();
    error UnknownPool();
    error HookRejected();

    constructor(IMatchPulseHook matchHook) {
        hook = matchHook;
    }

    function createPool(IMatchPulseHook.PoolKey calldata key) external returns (bytes32 poolId) {
        poolId = getPoolId(key);
        if (pools[poolId].exists) revert PoolExists();
        pools[poolId] = Pool({key: key, exists: true});
        emit PoolCreated(poolId, key.token0, key.token1, key.baseFeeBps, key.matchId);
    }

    function simulateSwap(bytes32 poolId, bool zeroForOne, int256 amountSpecified, uint256 volumeUsd)
        external
        returns (uint24 feeBps, uint256 volatilityScore, string memory reason)
    {
        Pool storage pool = pools[poolId];
        if (!pool.exists) revert UnknownPool();

        IMatchPulseHook.SwapContext memory context = IMatchPulseHook.SwapContext({
            sender: msg.sender,
            amountSpecified: amountSpecified,
            zeroForOne: zeroForOne,
            sqrtPriceX96: 0,
            hookData: ""
        });

        (bytes4 beforeSelector,) = hook.beforeSwap(pool.key, context);
        if (beforeSelector != IMatchPulseHook.beforeSwap.selector) revert HookRejected();

        bytes4 afterSelector;
        IMatchPulseHook.SwapReport memory report;
        (afterSelector, report) = hook.afterSwap(pool.key, context, volumeUsd);
        if (afterSelector != IMatchPulseHook.afterSwap.selector) revert HookRejected();

        emit SwapSimulated(
            poolId,
            msg.sender,
            zeroForOne,
            report.appliedFeeBps,
            report.volatilityScore,
            report.liquidityConcentrationBps,
            report.tickLower,
            report.tickUpper,
            report.reason
        );

        return (report.appliedFeeBps, report.volatilityScore, report.reason);
    }

    function getPoolId(IMatchPulseHook.PoolKey memory key) public pure returns (bytes32) {
        return keccak256(abi.encode(key.token0, key.token1, key.baseFeeBps, key.matchId));
    }
}
