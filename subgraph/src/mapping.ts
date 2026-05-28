import {
  DynamicFeeApplied as DynamicFeeAppliedEvent,
  LiquidityBandRebalanced as LiquidityBandRebalancedEvent,
  SwapMeasured as SwapMeasuredEvent
} from "../generated/MatchPulseHook/MatchPulseHook";
import {
  DynamicFeeApplied,
  LiquidityBandRebalanced,
  PoolSnapshot,
  SwapMeasured
} from "../generated/schema";

export function handleDynamicFeeApplied(event: DynamicFeeAppliedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  const entity = new DynamicFeeApplied(id);
  entity.poolId = event.params.poolId;
  entity.matchId = event.params.matchId;
  entity.feeBps = event.params.feeBps;
  entity.volatilityScore = event.params.volatilityScore;
  entity.reason = event.params.reason;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  let snapshot = PoolSnapshot.load(event.params.poolId);
  if (snapshot == null) snapshot = new PoolSnapshot(event.params.poolId);
  snapshot.matchId = event.params.matchId;
  snapshot.lastFeeBps = event.params.feeBps;
  snapshot.lastVolatilityScore = event.params.volatilityScore;
  snapshot.lastReason = event.params.reason;
  snapshot.updatedAt = event.block.timestamp;
  snapshot.save();
}

export function handleLiquidityBandRebalanced(event: LiquidityBandRebalancedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  const entity = new LiquidityBandRebalanced(id);
  entity.poolId = event.params.poolId;
  entity.matchId = event.params.matchId;
  entity.concentrationBps = event.params.concentrationBps;
  entity.tickLower = event.params.tickLower;
  entity.tickUpper = event.params.tickUpper;
  entity.reason = event.params.reason;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  let snapshot = PoolSnapshot.load(event.params.poolId);
  if (snapshot == null) snapshot = new PoolSnapshot(event.params.poolId);
  snapshot.matchId = event.params.matchId;
  snapshot.lastConcentrationBps = event.params.concentrationBps;
  snapshot.lastTickLower = event.params.tickLower;
  snapshot.lastTickUpper = event.params.tickUpper;
  snapshot.lastReason = event.params.reason;
  snapshot.updatedAt = event.block.timestamp;
  snapshot.save();
}

export function handleSwapMeasured(event: SwapMeasuredEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  const entity = new SwapMeasured(id);
  entity.poolId = event.params.poolId;
  entity.volumeUsd = event.params.volumeUsd;
  entity.totalVolumeUsd = event.params.totalVolumeUsd;
  entity.swapCount = event.params.swapCount;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  let snapshot = PoolSnapshot.load(event.params.poolId);
  if (snapshot == null) snapshot = new PoolSnapshot(event.params.poolId);
  snapshot.totalVolumeUsd = event.params.totalVolumeUsd;
  snapshot.swapCount = event.params.swapCount;
  snapshot.updatedAt = event.block.timestamp;
  snapshot.save();
}
