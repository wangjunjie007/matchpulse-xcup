// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ECDSA} from "./libraries/ECDSA.sol";
import {IMatchOracle} from "./interfaces/IMatchOracle.sol";

contract MatchPulseOracle is IMatchOracle {
    bytes32 public constant MATCH_STATE_TYPEHASH = keccak256(
        "MatchStateUpdate(bytes32 matchId,uint8 phase,uint8 minute,uint8 homeScore,uint8 awayScore,uint8 redCards,bool upsetSignal,uint64 observedAt,uint64 deadline,uint256 nonce,bytes32 evidenceHash)"
    );

    bytes32 private immutable DOMAIN_SEPARATOR;
    uint256 private immutable DOMAIN_CHAIN_ID;

    address public owner;
    mapping(address signer => bool trusted) public trustedSigner;
    mapping(bytes32 matchId => MatchState state) private matches;
    mapping(bytes32 matchId => uint256 nonce) public nonces;
    mapping(bytes32 digest => bool usedDigest) public usedDigests;

    event TrustedSignerSet(address indexed signer, bool trusted);
    event MatchCreated(bytes32 indexed matchId, string homeTeam, string awayTeam, uint64 kickoff);
    event OracleStateAccepted(
        bytes32 indexed matchId,
        address indexed signer,
        bytes32 indexed evidenceHash,
        uint256 nonce,
        Phase phase,
        uint8 minute,
        uint8 homeScore,
        uint8 awayScore,
        uint8 redCards,
        bool upsetSignal
    );
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
    error InvalidMinute();
    error SignatureExpired();
    error InvalidNonce();
    error DuplicateDigest();
    error UntrustedSigner();
    error ZeroSigner();

    struct SignedMatchState {
        bytes32 matchId;
        Phase phase;
        uint8 minute;
        uint8 homeScore;
        uint8 awayScore;
        uint8 redCards;
        bool upsetSignal;
        uint64 observedAt;
        uint64 deadline;
        uint256 nonce;
        bytes32 evidenceHash;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner, address initialSigner) {
        owner = initialOwner == address(0) ? msg.sender : initialOwner;
        DOMAIN_CHAIN_ID = block.chainid;
        DOMAIN_SEPARATOR = _buildDomainSeparator();
        if (initialSigner != address(0)) {
            trustedSigner[initialSigner] = true;
            emit TrustedSignerSet(initialSigner, true);
        }
    }

    function createMatch(bytes32 matchId, string calldata homeTeam, string calldata awayTeam, uint64 kickoff)
        external
        onlyOwner
    {
        MatchState storage state = matches[matchId];
        state.homeTeam = homeTeam;
        state.awayTeam = awayTeam;
        state.kickoff = kickoff;
        state.phase = Phase.Scheduled;
        state.exists = true;

        emit MatchCreated(matchId, homeTeam, awayTeam, kickoff);
    }

    function setTrustedSigner(address signer, bool trusted) external onlyOwner {
        if (signer == address(0)) revert ZeroSigner();
        trustedSigner[signer] = trusted;
        emit TrustedSignerSet(signer, trusted);
    }

    function updateMatchState(SignedMatchState calldata update, bytes calldata signature) external {
        if (!matches[update.matchId].exists) revert UnknownMatch();
        if (update.minute > 130) revert InvalidMinute();
        if (block.timestamp > update.deadline) revert SignatureExpired();
        if (update.nonce != nonces[update.matchId]) revert InvalidNonce();

        bytes32 digest = hashTypedData(update);
        if (usedDigests[digest]) revert DuplicateDigest();

        address signer = ECDSA.recover(digest, signature);
        if (!trustedSigner[signer]) revert UntrustedSigner();

        usedDigests[digest] = true;
        nonces[update.matchId] = update.nonce + 1;

        MatchState storage state = matches[update.matchId];
        state.phase = update.phase;
        state.minute = update.minute;
        state.homeScore = update.homeScore;
        state.awayScore = update.awayScore;
        state.redCards = update.redCards;
        state.upsetSignal = update.upsetSignal;

        emit OracleStateAccepted(
            update.matchId,
            signer,
            update.evidenceHash,
            update.nonce,
            update.phase,
            update.minute,
            update.homeScore,
            update.awayScore,
            update.redCards,
            update.upsetSignal
        );
        emit MatchStateUpdated(
            update.matchId,
            update.phase,
            update.minute,
            update.homeScore,
            update.awayScore,
            update.redCards,
            update.upsetSignal
        );
    }

    function getMatch(bytes32 matchId) external view returns (MatchState memory state) {
        state = matches[matchId];
        if (!state.exists) revert UnknownMatch();
    }

    function domainSeparator() external view returns (bytes32) {
        return block.chainid == DOMAIN_CHAIN_ID ? DOMAIN_SEPARATOR : _buildDomainSeparator();
    }

    function hashTypedData(SignedMatchState calldata update) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                MATCH_STATE_TYPEHASH,
                update.matchId,
                update.phase,
                update.minute,
                update.homeScore,
                update.awayScore,
                update.redCards,
                update.upsetSignal,
                update.observedAt,
                update.deadline,
                update.nonce,
                update.evidenceHash
            )
        );
        bytes32 separator = block.chainid == DOMAIN_CHAIN_ID ? DOMAIN_SEPARATOR : _buildDomainSeparator();
        return keccak256(abi.encodePacked("\x19\x01", separator, structHash));
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MatchPulseOracle")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }
}
