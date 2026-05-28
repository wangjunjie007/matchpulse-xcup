// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMatchPulseHook} from "./interfaces/IMatchPulseHook.sol";
import {MatchOracleMock} from "./MatchOracleMock.sol";

contract MatchPulseHook is IMatchPulseHook {
    MatchOracleMock public immutable oracle;
    address public owner;
    address public poolManager;
    uint24 public constant MAX_FEE_BPS = 300;

    struct PoolMetrics {
        uint256 totalVolumeUsd;
        uint256 swapCount;
        uint24 lastFeeBps;
        uint256 lastVolatilityScore;
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

    constructor(MatchOracleMock matchOracle, address initialOwner) {
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
        bytes32 poolId = getPoolId(key);
        PoolMetrics storage data = poolMetrics[poolId];

        data.totalVolumeUsd += volumeUsd;
        data.swapCount += 1;
        data.lastFeeBps = feeBps;
        data.lastVolatilityScore = volatilityScore;
        data.lastUpdated = uint64(block.timestamp);
        data.lastReason = reason;

        report = SwapReport({appliedFeeBps: feeBps, volatilityScore: volatilityScore, reason: reason});
        selector = IMatchPulseHook.afterSwap.selector;

        emit DynamicFeeApplied(poolId, key.matchId, feeBps, volatilityScore, reason);
        emit SwapMeasured(poolId, volumeUsd, data.totalVolumeUsd, data.swapCount);
    }

    function quoteFee(bytes32 matchId, uint24 baseFeeBps)
        public
        view
        returns (uint24 feeBps, uint256 volatilityScore, string memory reason)
    {
        MatchOracleMock.MatchState memory state = oracle.getMatch(matchId);
        uint256 premium;

        if (state.phase == MatchOracleMock.Phase.Scheduled) {
            reason = "scheduled baseline";
        } else if (state.phase == MatchOracleMock.Phase.HalfTime) {
            premium += 12;
            reason = "half-time liquidity rebalance";
        } else if (state.phase == MatchOracleMock.Phase.Finalized) {
            premium += 5;
            reason = "finalized settlement window";
        } else {
            premium += 25;
            reason = "live match volatility";
        }

        bool competitiveWindow = state.phase != MatchOracleMock.Phase.Scheduled
            && state.phase != MatchOracleMock.Phase.Finalized;

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

    function getPoolId(PoolKey memory key) public pure returns (bytes32) {
        return keccak256(abi.encode(key.token0, key.token1, key.baseFeeBps, key.matchId));
    }

    function _isLateMatch(MatchOracleMock.MatchState memory state) private pure returns (bool) {
        return state.minute >= 75
            || state.phase == MatchOracleMock.Phase.ExtraTime
            || state.phase == MatchOracleMock.Phase.Penalties;
    }

    function _isCloseScore(MatchOracleMock.MatchState memory state) private pure returns (bool) {
        uint8 home = state.homeScore;
        uint8 away = state.awayScore;
        return home == away || home + 1 == away || away + 1 == home;
    }
}
