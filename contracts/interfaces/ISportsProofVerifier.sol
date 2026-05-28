// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ISportsProofVerifier {
    function verify(bytes32 feedId, bytes32 tlsTranscriptHash, bytes calldata proof) external view returns (bool);
}
