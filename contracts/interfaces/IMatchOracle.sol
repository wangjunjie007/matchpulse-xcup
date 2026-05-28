// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IMatchOracle {
    enum Phase {
        Scheduled,
        LiveFirstHalf,
        HalfTime,
        LiveSecondHalf,
        ExtraTime,
        Penalties,
        Finalized
    }

    struct MatchState {
        string homeTeam;
        string awayTeam;
        uint64 kickoff;
        uint8 homeScore;
        uint8 awayScore;
        uint8 redCards;
        uint8 minute;
        Phase phase;
        bool upsetSignal;
        bool exists;
    }

    function getMatch(bytes32 matchId) external view returns (MatchState memory state);
}
