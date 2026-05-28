// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IMatchOracle} from "./interfaces/IMatchOracle.sol";
import {ISportsProofVerifier} from "./interfaces/ISportsProofVerifier.sol";

contract TlsSportsOracleAdapter is IMatchOracle {
    ISportsProofVerifier public immutable verifier;
    address public owner;

    struct FeedBinding {
        bytes32 feedId;
        string authority;
        bool exists;
    }

    mapping(bytes32 matchId => MatchState state) private matches;
    mapping(bytes32 matchId => FeedBinding binding) public feedBindings;
    mapping(bytes32 proofHash => bool usedProofs) public usedProof;

    event MatchBoundToFeed(bytes32 indexed matchId, bytes32 indexed feedId, string authority);
    event SportsProofAccepted(bytes32 indexed matchId, bytes32 indexed feedId, bytes32 tlsTranscriptHash, bytes32 proofHash);
    event MatchStateUpdated(
        bytes32 indexed matchId,
        Phase phase,
        uint8 minute,
        uint8 homeScore,
        uint8 awayScore,
        uint8 redCards,
        bool upsetSignal
    );

    error NotOwner();
    error UnknownMatch();
    error DuplicateProof();
    error InvalidMinute();
    error InvalidProof();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(ISportsProofVerifier sportsProofVerifier, address initialOwner) {
        verifier = sportsProofVerifier;
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
    }

    function bindMatch(
        bytes32 matchId,
        bytes32 feedId,
        string calldata authority,
        string calldata homeTeam,
        string calldata awayTeam,
        uint64 kickoff
    ) external onlyOwner {
        MatchState storage data = matches[matchId];
        data.homeTeam = homeTeam;
        data.awayTeam = awayTeam;
        data.kickoff = kickoff;
        data.phase = Phase.Scheduled;
        data.exists = true;
        feedBindings[matchId] = FeedBinding({feedId: feedId, authority: authority, exists: true});

        emit MatchBoundToFeed(matchId, feedId, authority);
    }

    function submitVerifiedState(
        bytes32 matchId,
        bytes32 tlsTranscriptHash,
        bytes calldata proof,
        Phase phase,
        uint8 minute,
        uint8 homeScore,
        uint8 awayScore,
        uint8 redCards,
        bool upsetSignal
    ) external onlyOwner {
        FeedBinding memory binding = feedBindings[matchId];
        if (!binding.exists || !matches[matchId].exists) revert UnknownMatch();
        if (minute > 130) revert InvalidMinute();

        bytes32 proofHash = keccak256(abi.encode(matchId, tlsTranscriptHash, proof));
        if (usedProof[proofHash]) revert DuplicateProof();
        if (!verifier.verify(binding.feedId, tlsTranscriptHash, proof)) revert InvalidProof();

        usedProof[proofHash] = true;
        MatchState storage data = matches[matchId];
        data.phase = phase;
        data.minute = minute;
        data.homeScore = homeScore;
        data.awayScore = awayScore;
        data.redCards = redCards;
        data.upsetSignal = upsetSignal;

        emit SportsProofAccepted(matchId, binding.feedId, tlsTranscriptHash, proofHash);
        emit MatchStateUpdated(matchId, phase, minute, homeScore, awayScore, redCards, upsetSignal);
    }

    function getMatch(bytes32 matchId) external view returns (MatchState memory state) {
        state = matches[matchId];
        if (!state.exists) revert UnknownMatch();
    }
}
