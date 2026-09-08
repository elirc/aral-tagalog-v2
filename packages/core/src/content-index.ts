/** Partitioned lookup keeps a small mistake review from downloading every exercise ID. */
export const REVIEW_INDEX_PARTITIONS = 64;
export function exercisePartition(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  return hash % REVIEW_INDEX_PARTITIONS;
}
