import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const deploymentPath = path.join(root, "deployments", "xlayer-testnet-1952.json");
const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));

const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const bytes32Pattern = /^0x[a-fA-F0-9]{64}$/;
const urlPattern = /^https:\/\/[^\s]+$/;

const requiredContracts = [
  "MatchOracleMock",
  "WorldCupMarketFactory",
  "MatchPulseHook",
  "SimulatedPoolManager"
];
const requiredTokens = ["Argentina", "Draw", "Brazil"];

const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

assert(typeof deployment.network === "string" && deployment.network.length > 0, "network must be a non-empty string");
assert(typeof deployment.chainId === "number" && Number.isInteger(deployment.chainId), "chainId must be an integer number");
assert(deployment.chainId === 1952, "chainId must be 1952 for X Layer testnet");
assert(urlPattern.test(deployment.rpcUrl), "rpcUrl must be an https URL");
assert(urlPattern.test(deployment.explorer), "explorer must be an https URL");
assert(addressPattern.test(deployment.deployer), "deployer must be an EVM address");
assert(bytes32Pattern.test(deployment.matchId), "matchId must be bytes32");
assert(bytes32Pattern.test(deployment.poolId), "poolId must be bytes32");

for (const name of requiredContracts) {
  assert(deployment.contracts && addressPattern.test(deployment.contracts[name]), `contracts.${name} must be an EVM address`);
}

for (const name of requiredTokens) {
  assert(deployment.predictionTokens && addressPattern.test(deployment.predictionTokens[name]), `predictionTokens.${name} must be an EVM address`);
}

for (const [name, hash] of Object.entries(deployment.transactions || {})) {
  assert(bytes32Pattern.test(hash), `transactions.${name} must be a 32-byte transaction hash`);
}

if (errors.length) {
  console.error("Deployment config validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Deployment config validation passed.");
