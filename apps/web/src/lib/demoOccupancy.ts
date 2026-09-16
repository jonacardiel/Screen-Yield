/**
 * Deterministic placeholder for "which seats are sold at X% occupancy" — a stable, seeded
 * ranking of every seat, so moving the occupancy slider fills seats in a fixed order
 * instead of flickering randomly on every render. This is NOT the real demand simulator
 * (packages/pricing/src/demand.ts, milestone M5): that one models booking arrivals over
 * time with a proper seeded PRNG. This is just enough to make the M1 demo look alive.
 */

// FNV-1a, small and dependency-free — but on its own it under-mixes short, near-identical
// inputs like seat IDs ("A1", "A2", ... sharing a long constant salt prefix): the raw
// hashes came out clustered by row (verified: every seat in a row landed within ~0.08 of
// each other), which made the demo occupancy pattern fill or empty an entire row at once
// instead of looking plausibly scattered. A Murmur3-style 32-bit finalizer (fmix32) after
// the FNV pass fixes this — its whole job is guaranteeing full avalanche on exactly this
// kind of input.
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function fmix32(hIn: number): number {
  let h = hIn;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A stable value in [0, 1) for a seat — sold once `occupancy` exceeds this seat's rank. */
export function seatSaleRank(seatId: string, salt = "meridian-demo-v1"): number {
  return fmix32(fnv1a(`${salt}:${seatId}`)) / 0xffffffff;
}
