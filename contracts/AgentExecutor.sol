// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ECDSA} from "./libraries/ECDSA.sol";

contract AgentExecutor {
    bytes32 public constant SESSION_KEY_TYPEHASH = keccak256(
        "SessionKeyAuthorization(address user,address sessionKey,address router,address tokenIn,address tokenOut,bytes32 matchId,uint256 maxSpend,uint64 validAfter,uint64 validUntil,uint256 nonce)"
    );
    bytes32 public constant INTENT_TYPEHASH = keccak256(
        "AgentIntent(address user,address sessionKey,address router,address tokenIn,address tokenOut,bytes32 matchId,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,bytes32 strategyId,bytes32 callDataHash)"
    );

    bytes32 private immutable DOMAIN_SEPARATOR;
    uint256 private immutable DOMAIN_CHAIN_ID;

    mapping(address user => uint256 nonce) public userNonces;
    mapping(bytes32 intentHash => bool used) public usedIntent;

    event SessionKeyAuthorized(
        address indexed user,
        address indexed sessionKey,
        bytes32 indexed matchId,
        address router,
        address tokenIn,
        address tokenOut,
        uint256 maxSpend,
        uint64 validAfter,
        uint64 validUntil,
        uint256 nonce
    );
    event AgentIntentExecuted(
        address indexed user,
        address indexed sessionKey,
        bytes32 indexed matchId,
        address router,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 strategyId,
        bytes result
    );

    error AuthorizationExpired();
    error AuthorizationNotActive();
    error IntentExpired();
    error InvalidNonce();
    error InvalidUserSignature();
    error InvalidSessionSignature();
    error DuplicateIntent();
    error SpendExceedsLimit();
    error RouterCallFailed(bytes revertData);

    struct SessionKeyAuthorization {
        address user;
        address sessionKey;
        address router;
        address tokenIn;
        address tokenOut;
        bytes32 matchId;
        uint256 maxSpend;
        uint64 validAfter;
        uint64 validUntil;
        uint256 nonce;
    }

    struct AgentIntent {
        address user;
        address sessionKey;
        address router;
        address tokenIn;
        address tokenOut;
        bytes32 matchId;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        uint256 nonce;
        bytes32 strategyId;
        bytes callData;
    }

    constructor() {
        DOMAIN_CHAIN_ID = block.chainid;
        DOMAIN_SEPARATOR = _buildDomainSeparator();
    }

    function execute(
        SessionKeyAuthorization calldata authorization,
        bytes calldata userSignature,
        AgentIntent calldata intent,
        bytes calldata sessionSignature
    ) external returns (bytes memory result) {
        _validateAuthorization(authorization, userSignature);
        _validateIntent(authorization, intent, sessionSignature);

        bytes32 intentDigest = hashIntent(intent);
        usedIntent[intentDigest] = true;
        userNonces[authorization.user] = authorization.nonce + 1;

        (bool ok, bytes memory data) = intent.router.call(intent.callData);
        if (!ok) revert RouterCallFailed(data);

        emit AgentIntentExecuted(
            intent.user,
            intent.sessionKey,
            intent.matchId,
            intent.router,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            intent.minAmountOut,
            intent.strategyId,
            data
        );
        return data;
    }

    function domainSeparator() external view returns (bytes32) {
        return block.chainid == DOMAIN_CHAIN_ID ? DOMAIN_SEPARATOR : _buildDomainSeparator();
    }

    function hashAuthorization(SessionKeyAuthorization calldata authorization) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                SESSION_KEY_TYPEHASH,
                authorization.user,
                authorization.sessionKey,
                authorization.router,
                authorization.tokenIn,
                authorization.tokenOut,
                authorization.matchId,
                authorization.maxSpend,
                authorization.validAfter,
                authorization.validUntil,
                authorization.nonce
            )
        );
        return _toTypedDataHash(structHash);
    }

    function hashIntent(AgentIntent calldata intent) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.user,
                intent.sessionKey,
                intent.router,
                intent.tokenIn,
                intent.tokenOut,
                intent.matchId,
                intent.amountIn,
                intent.minAmountOut,
                intent.deadline,
                intent.nonce,
                intent.strategyId,
                keccak256(intent.callData)
            )
        );
        return _toTypedDataHash(structHash);
    }

    function _validateAuthorization(SessionKeyAuthorization calldata authorization, bytes calldata userSignature)
        private
    {
        if (block.timestamp < authorization.validAfter) revert AuthorizationNotActive();
        if (block.timestamp > authorization.validUntil) revert AuthorizationExpired();
        if (authorization.nonce != userNonces[authorization.user]) revert InvalidNonce();

        address signer = ECDSA.recover(hashAuthorization(authorization), userSignature);
        if (signer != authorization.user) revert InvalidUserSignature();

        emit SessionKeyAuthorized(
            authorization.user,
            authorization.sessionKey,
            authorization.matchId,
            authorization.router,
            authorization.tokenIn,
            authorization.tokenOut,
            authorization.maxSpend,
            authorization.validAfter,
            authorization.validUntil,
            authorization.nonce
        );
    }

    function _validateIntent(
        SessionKeyAuthorization calldata authorization,
        AgentIntent calldata intent,
        bytes calldata sessionSignature
    ) private view {
        if (block.timestamp > intent.deadline) revert IntentExpired();
        if (usedIntent[hashIntent(intent)]) revert DuplicateIntent();
        if (intent.amountIn > authorization.maxSpend) revert SpendExceedsLimit();
        if (
            intent.user != authorization.user || intent.sessionKey != authorization.sessionKey
                || intent.router != authorization.router || intent.tokenIn != authorization.tokenIn
                || intent.tokenOut != authorization.tokenOut || intent.matchId != authorization.matchId
                || intent.nonce != authorization.nonce
        ) revert InvalidSessionSignature();

        address signer = ECDSA.recover(hashIntent(intent), sessionSignature);
        if (signer != authorization.sessionKey) revert InvalidSessionSignature();
    }

    function _toTypedDataHash(bytes32 structHash) private view returns (bytes32) {
        bytes32 separator = block.chainid == DOMAIN_CHAIN_ID ? DOMAIN_SEPARATOR : _buildDomainSeparator();
        return keccak256(abi.encodePacked("\x19\x01", separator, structHash));
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("MatchPulseAgentExecutor")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }
}
