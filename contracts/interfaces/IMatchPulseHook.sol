// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IMatchPulseHook {
    struct PoolKey {
        address token0;
        address token1;
        uint24 baseFeeBps;
        bytes32 matchId;
    }

    struct SwapContext {
        address sender;
        int256 amountSpecified;
        bool zeroForOne;
        uint160 sqrtPriceX96;
        bytes hookData;
    }

    struct SwapReport {
        uint24 appliedFeeBps;
        uint256 volatilityScore;
        uint16 liquidityConcentrationBps;
        int24 tickLower;
        int24 tickUpper;
        string reason;
    }

    struct PositionContext {
        address sender;
        int24 requestedTickLower;
        int24 requestedTickUpper;
        int128 liquidityDelta;
        bytes hookData;
    }

    struct RebalanceReport {
        uint16 concentrationBps;
        int24 activeTick;
        int24 tickLower;
        int24 tickUpper;
        uint256 vaultCreditBps;
        string reason;
    }

    function beforeSwap(PoolKey calldata key, SwapContext calldata context)
        external
        returns (bytes4 selector, uint24 appliedFeeBps);

    function afterSwap(PoolKey calldata key, SwapContext calldata context, uint256 volumeUsd)
        external
        returns (bytes4 selector, SwapReport memory report);

    function beforeModifyPosition(PoolKey calldata key, PositionContext calldata context)
        external
        returns (bytes4 selector, RebalanceReport memory report);
}
