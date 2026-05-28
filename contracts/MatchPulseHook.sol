// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMatchPulseHook} from "./interfaces/IMatchPulseHook.sol";
import {IMatchOracle} from "./interfaces/IMatchOracle.sol";

contract MatchPulseHook is IMatchPulseHook {
    IMatchOracle public immutable oracle;
    address public owner;
    address public poolManager;
    uint24 public constant MAX_FEE_BPS = 300;
    uint16 public constant MAX_CONCENTRATION_BPS = 9800;
    int256 private constant MIN_BAND_HALF_WIDTH = 120;

    struct PoolMetrics {
        uint256 totalVolumeUsd;
        uint256 swapCount;
        uint24 lastFeeBps;
        uint256 lastVolatilityScore;
        uint16 lastLiquidityConcentrationBps;
        int24 lastTickLower;
        int24 lastTickUpper;
        uint64 lastUpdated;
        string lastReason;
    }

    mapping(bytes32 poolId => PoolMetrics metrics) public poolMetrics;

    event DynamicFeeApplied(
        bytes32 indexed poolId,
        bytes32 indexed matchId,
        uint24 feeBps,
        uint256 volatilityScore,
        string reason
    );
    event SwapMeasured(bytes32 indexed poolId, uint256 volumeUsd, uint256 totalVolumeUsd, uint256 swapCount);
    event LiquidityBandRebalanced(
        bytes32 indexed poolId,
        bytes32 indexed matchId,
        uint16 concentrationBps,
        int24 tickLower,
        int24 tickUpper,
        string reason
    );
    event PoolManagerSet(address indexed poolManager);

    error NotOwner();
    error NotPoolManager();
    error PoolManagerAlreadySet();
    error InvalidPoolManager();

    modifier onlyPoolManager() {
        if (msg.sender != poolManager) revert NotPoolManager();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IMatchOracle matchOracle, address initialOwner) {
        oracle = matchOracle;
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
    }

    function setPoolManager(address authorizedPoolManager) external onlyOwner {
        if (poolManager != address(0)) revert PoolManagerAlreadySet();
        if (authorizedPoolManager == address(0)) revert InvalidPoolManager();
        poolManager = authorizedPoolManager;
        emit PoolManagerSet(authorizedPoolManager);
    }

    function beforeSwap(PoolKey calldata key, SwapContext calldata)
        external
        onlyPoolManager
        returns (bytes4 selector, uint24 appliedFeeBps)
    {
        (appliedFeeBps,,) = quoteFee(key.matchId, key.baseFeeBps);
        selector = IMatchPulseHook.beforeSwap.selector;
    }

    function afterSwap(PoolKey calldata key, SwapContext calldata, uint256 volumeUsd)
        external
        onlyPoolManager
        returns (bytes4 selector, SwapReport memory report)
    {
        (uint24 feeBps, uint256 volatilityScore, string memory reason) = quoteFee(key.matchId, key.baseFeeBps);
        (uint16 concentrationBps, int24 tickLower, int24 tickUpper, string memory liquidityReason) =
            quoteLiquidityBand(key.matchId);
        bytes32 poolId = getPoolId(key);
        PoolMetrics storage data = poolMetrics[poolId];

        data.totalVolumeUsd += volumeUsd;
        data.swapCount += 1;
        data.lastFeeBps = feeBps;
        data.lastVolatilityScore = volatilityScore;
        data.lastLiquidityConcentrationBps = concentrationBps;
        data.lastTickLower = tickLower;
        data.lastTickUpper = tickUpper;
        data.lastUpdated = uint64(block.timestamp);
        data.lastReason = reason;

        report = SwapReport({
            appliedFeeBps: feeBps,
            volatilityScore: volatilityScore,
            liquidityConcentrationBps: concentrationBps,
            tickLower: tickLower,
            tickUpper: tickUpper,
            reason: reason
        });
        selector = IMatchPulseHook.afterSwap.selector;

        emit DynamicFeeApplied(poolId, key.matchId, feeBps, volatilityScore, reason);
        emit LiquidityBandRebalanced(poolId, key.matchId, concentrationBps, tickLower, tickUpper, liquidityReason);
        emit SwapMeasured(poolId, volumeUsd, data.totalVolumeUsd, data.swapCount);
    }

    function quoteFee(bytes32 matchId, uint24 baseFeeBps)
        public
        view
        returns (uint24 feeBps, uint256 volatilityScore, string memory reason)
    {
        IMatchOracle.MatchState memory state = oracle.getMatch(matchId);
        uint256 premium;

        if (state.phase == IMatchOracle.Phase.Scheduled) {
            reason = "scheduled baseline";
        } else if (state.phase == IMatchOracle.Phase.HalfTime) {
            premium += 12;
            reason = "half-time liquidity rebalance";
        } else if (state.phase == IMatchOracle.Phase.Finalized) {
            premium += 5;
            reason = "finalized settlement window";
        } else {
            premium += 25;
            reason = "live match volatility";
        }

        bool competitiveWindow =
            state.phase != IMatchOracle.Phase.Scheduled && state.phase != IMatchOracle.Phase.Finalized;

        if (competitiveWindow && _isLateMatch(state)) {
            premium += 30;
            reason = "late-game volatility";
        }
        if (competitiveWindow && _isCloseScore(state)) {
            premium += 25;
            reason = "close-score pressure";
        }
        if (competitiveWindow && state.redCards > 0) {
            premium += uint256(state.redCards) * 15;
            reason = "red-card shock";
        }
        if (competitiveWindow && state.upsetSignal) {
            premium += 20;
            reason = "upset signal";
        }

        uint256 computedFee = uint256(baseFeeBps) + premium;
        if (computedFee > MAX_FEE_BPS) computedFee = MAX_FEE_BPS;

        feeBps = uint24(computedFee);
        volatilityScore = premium * 100 / MAX_FEE_BPS;
    }

    function quoteLiquidityBand(bytes32 matchId)
        public
        view
        returns (uint16 concentrationBps, int24 tickLower, int24 tickUpper, string memory reason)
    {
        IMatchOracle.MatchState memory state = oracle.getMatch(matchId);
        uint256 concentration = 1500;
        int256 halfWidth = 2400;
        reason = "pre-match wide liquidity band";

        if (state.phase == IMatchOracle.Phase.HalfTime) {
            concentration = 2600;
            halfWidth = 1800;
            reason = "half-time liquidity reset";
        } else if (state.phase == IMatchOracle.Phase.Finalized) {
            concentration = 5200;
            halfWidth = 720;
            reason = "settlement redemption band";
        } else if (state.phase != IMatchOracle.Phase.Scheduled) {
            concentration = 3400;
            halfWidth = 1200;
            reason = "live balanced liquidity band";
        }

        bool competitiveWindow =
            state.phase != IMatchOracle.Phase.Scheduled && state.phase != IMatchOracle.Phase.Finalized;

        if (competitiveWindow && _isLateMatch(state)) {
            concentration += 2200;
            halfWidth = halfWidth * 58 / 100;
            reason = "final-whistle squeeze";
        }
        if (competitiveWindow && _isCloseScore(state)) {
            concentration += 1400;
            halfWidth = halfWidth * 70 / 100;
            reason = "close-score convergence";
        }
        if (competitiveWindow && state.redCards > 0) {
            concentration += uint256(state.redCards) * 700;
            halfWidth -= int256(uint256(state.redCards)) * 100;
            reason = "red-card concentration";
        }
        if (competitiveWindow && state.upsetSignal) {
            concentration += 1000;
            halfWidth -= 180;
            reason = "upset flow concentration";
        }
        if (competitiveWindow && state.minute >= 90) {
            concentration += 1200;
            halfWidth = halfWidth / 2;
            reason = "injury-time doom option";
        }

        if (concentration > MAX_CONCENTRATION_BPS) concentration = MAX_CONCENTRATION_BPS;
        if (halfWidth < MIN_BAND_HALF_WIDTH) halfWidth = MIN_BAND_HALF_WIDTH;

        concentrationBps = uint16(concentration);
        tickLower = int24(-halfWidth);
        tickUpper = int24(halfWidth);
    }

    function getPoolId(PoolKey memory key) public pure returns (bytes32) {
        return keccak256(abi.encode(key.token0, key.token1, key.baseFeeBps, key.matchId));
    }

    function _isLateMatch(IMatchOracle.MatchState memory state) private pure returns (bool) {
        return state.minute >= 75 || state.phase == IMatchOracle.Phase.ExtraTime
            || state.phase == IMatchOracle.Phase.Penalties;
    }

    function _isCloseScore(IMatchOracle.MatchState memory state) private pure returns (bool) {
        uint8 home = state.homeScore;
        uint8 away = state.awayScore;
        return home == away || home + 1 == away || away + 1 == home;
    }
}
