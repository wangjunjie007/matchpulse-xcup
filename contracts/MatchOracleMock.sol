// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMatchOracle} from "./interfaces/IMatchOracle.sol";

contract MatchOracleMock is IMatchOracle {

    address public owner;
    mapping(bytes32 matchId => IMatchOracle.MatchState state) private matches;

    event MatchCreated(bytes32 indexed matchId, string homeTeam, string awayTeam, uint64 kickoff);
    event MatchStateUpdated(
        bytes32 indexed matchId,
        IMatchOracle.Phase phase,
        uint8 minute,
        uint8 homeScore,
        uint8 awayScore,
        uint8 redCards,
        bool upsetSignal
    );

    error NotOwner();
    error UnknownMatch();
    error InvalidMinute();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
    }

    function createMatch(bytes32 matchId, string calldata homeTeam, string calldata awayTeam, uint64 kickoff)
        external
        onlyOwner
    {
        IMatchOracle.MatchState storage state = matches[matchId];
        state.homeTeam = homeTeam;
        state.awayTeam = awayTeam;
        state.kickoff = kickoff;
        state.phase = IMatchOracle.Phase.Scheduled;
        state.exists = true;

        emit MatchCreated(matchId, homeTeam, awayTeam, kickoff);
    }

    function updateMatch(
        bytes32 matchId,
        IMatchOracle.Phase phase,
        uint8 minute,
        uint8 homeScore,
        uint8 awayScore,
        uint8 redCards,
        bool upsetSignal
    ) external onlyOwner {
        if (!matches[matchId].exists) revert UnknownMatch();
        if (minute > 130) revert InvalidMinute();

        IMatchOracle.MatchState storage state = matches[matchId];
        state.phase = phase;
        state.minute = minute;
        state.homeScore = homeScore;
        state.awayScore = awayScore;
        state.redCards = redCards;
        state.upsetSignal = upsetSignal;

        emit MatchStateUpdated(matchId, phase, minute, homeScore, awayScore, redCards, upsetSignal);
    }

    function getMatch(bytes32 matchId) external view returns (IMatchOracle.MatchState memory state) {
        state = matches[matchId];
        if (!state.exists) revert UnknownMatch();
    }
}
