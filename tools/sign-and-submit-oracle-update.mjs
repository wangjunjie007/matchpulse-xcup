import { readFileSync } from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = process.cwd();
const deployment = JSON.parse(readFileSync(path.join(root, "deployments", "xlayer-testnet-1952.json"), "utf8"));
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) throw new Error("PRIVATE_KEY is required");

const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
const chain = {
  id: deployment.chainId,
  name: deployment.network,
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [deployment.rpcUrl] } }
};

const oracleAbi = [
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [{ name: "nonce", type: "uint256" }]
  },
  {
    type: "function",
    name: "updateMatchState",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "update",
        type: "tuple",
        components: [
          { name: "matchId", type: "bytes32" },
          { name: "phase", type: "uint8" },
          { name: "minute", type: "uint8" },
          { name: "homeScore", type: "uint8" },
          { name: "awayScore", type: "uint8" },
          { name: "redCards", type: "uint8" },
          { name: "upsetSignal", type: "bool" },
          { name: "observedAt", type: "uint64" },
          { name: "deadline", type: "uint64" },
          { name: "nonce", type: "uint256" },
          { name: "evidenceHash", type: "bytes32" }
        ]
      },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  }
];

const publicClient = createPublicClient({ chain, transport: http(deployment.rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(deployment.rpcUrl) });
const nonce = await publicClient.readContract({
  address: deployment.contracts.MatchPulseOracle,
  abi: oracleAbi,
  functionName: "nonces",
  args: [deployment.matchId]
});

const now = Math.floor(Date.now() / 1000);
const update = {
  matchId: deployment.matchId,
  phase: 3,
  minute: 84,
  homeScore: 1,
  awayScore: 1,
  redCards: 1,
  upsetSignal: true,
  observedAt: now,
  deadline: now + 600,
  nonce,
  evidenceHash: "0x9f9b4bc50d1c79a11a42d9d99e18f3cd3447b12603dbe2e73a038ef31e2b2f71"
};

const signature = await account.signTypedData({
  domain: {
    name: "MatchPulseOracle",
    version: "1",
    chainId: deployment.chainId,
    verifyingContract: deployment.contracts.MatchPulseOracle
  },
  types: {
    MatchStateUpdate: [
      { name: "matchId", type: "bytes32" },
      { name: "phase", type: "uint8" },
      { name: "minute", type: "uint8" },
      { name: "homeScore", type: "uint8" },
      { name: "awayScore", type: "uint8" },
      { name: "redCards", type: "uint8" },
      { name: "upsetSignal", type: "bool" },
      { name: "observedAt", type: "uint64" },
      { name: "deadline", type: "uint64" },
      { name: "nonce", type: "uint256" },
      { name: "evidenceHash", type: "bytes32" }
    ]
  },
  primaryType: "MatchStateUpdate",
  message: update
});

const hash = await walletClient.writeContract({
  address: deployment.contracts.MatchPulseOracle,
  abi: oracleAbi,
  functionName: "updateMatchState",
  args: [update, signature]
});

console.log(JSON.stringify({ hash, nonce: nonce.toString(), signer: account.address }, null, 2));
