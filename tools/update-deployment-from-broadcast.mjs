import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { keccak256, encodeAbiParameters, parseAbiParameters, getAddress } from "viem";

const root = process.cwd();
const broadcastPath = path.join(root, "broadcast", "Deploy.s.sol", "1952", "run-latest.json");
const deploymentPath = path.join(root, "deployments", "xlayer-testnet-1952.json");

const broadcast = JSON.parse(readFileSync(broadcastPath, "utf8"));
const previous = JSON.parse(readFileSync(deploymentPath, "utf8"));
const transactions = broadcast.transactions || [];

function findCreate(contractName) {
  const tx = transactions.find((item) => item.transactionType === "CREATE" && item.contractName === contractName);
  if (!tx?.contractAddress || !tx?.hash) throw new Error(`Missing CREATE transaction for ${contractName}`);
  return tx;
}

function findCall(contractName, index = 0) {
  const matches = transactions.filter((item) => item.transactionType === "CALL" && item.contractName === contractName);
  const tx = matches[index];
  if (!tx?.hash) throw new Error(`Missing CALL transaction for ${contractName} at index ${index}`);
  return tx;
}

function additionalCreates(contractName) {
  return transactions.flatMap((item) =>
    (item.additionalContracts || [])
      .filter((contract) => contract.transactionType === "CREATE" && contract.contractName === contractName)
      .map((contract) => ({ ...contract, parentHash: item.hash }))
  );
}

function normalize(address) {
  return getAddress(address);
}

const oracle = findCreate("MatchPulseOracle");
const factory = findCreate("WorldCupMarketFactory");
const hook = findCreate("MatchPulseHook");
const poolManager = findCreate("SimulatedPoolManager");
const agentExecutor = findCreate("AgentExecutor");
const paymaster = findCreate("MatchPulsePaymaster");
const setPoolManager = findCall("MatchPulseHook", 0);
const createMatch = findCall("MatchPulseOracle", 0);
const createMarket = findCall("WorldCupMarketFactory", 0);
const createPool = findCall("SimulatedPoolManager", 0);

const predictionCreates = additionalCreates("PredictionToken");
if (predictionCreates.length !== 3) throw new Error(`Expected 3 PredictionToken creates, found ${predictionCreates.length}`);

const contracts = {
  MatchOracleMock: normalize(oracle.contractAddress),
  MatchPulseOracle: normalize(oracle.contractAddress),
  WorldCupMarketFactory: normalize(factory.contractAddress),
  MatchPulseHook: normalize(hook.contractAddress),
  SimulatedPoolManager: normalize(poolManager.contractAddress),
  AgentExecutor: normalize(agentExecutor.contractAddress),
  MatchPulsePaymaster: normalize(paymaster.contractAddress)
};

const predictionTokens = {
  Argentina: normalize(predictionCreates[0].address),
  Draw: normalize(predictionCreates[1].address),
  Brazil: normalize(predictionCreates[2].address)
};

const poolId = keccak256(
  encodeAbiParameters(parseAbiParameters("address token0, address token1, uint24 baseFeeBps, bytes32 matchId"), [
    predictionTokens.Argentina,
    predictionTokens.Brazil,
    30,
    previous.matchId
  ])
);

const next = {
  ...previous,
  contracts,
  predictionTokens,
  poolId,
  transactions: {
    deployMatchPulseOracle: oracle.hash,
    deployWorldCupMarketFactory: factory.hash,
    deployMatchPulseHook: hook.hash,
    deploySimulatedPoolManager: poolManager.hash,
    deployAgentExecutor: agentExecutor.hash,
    deployMatchPulsePaymaster: paymaster.hash,
    setPoolManager: setPoolManager.hash,
    createMatch: createMatch.hash,
    createMarket: createMarket.hash,
    createPool: createPool.hash,
    verifiedSimulatedSwap: previous.transactions.verifiedSimulatedSwap
  }
};

writeFileSync(deploymentPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Updated ${deploymentPath}`);
console.log(JSON.stringify({ contracts, predictionTokens, poolId }, null, 2));
