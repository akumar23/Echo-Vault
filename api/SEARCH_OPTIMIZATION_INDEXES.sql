-- Performance Optimization Indexes for Semantic Search
-- Add these indexes via Alembic migration for optimal search performance

-- 1. IVFFlat index for pgvector cosine distance operations
-- This dramatically speeds up nearest neighbor search on large datasets
-- The 'lists' parameter should be approximately sqrt(row_count)
-- For 1000 entries: lists=32, for 10000 entries: lists=100, for 100000 entries: lists=316
CREATE INDEX IF NOT EXISTS idx_entry_embeddings_vector_cosine
ON entry_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Note: IVFFlat index requires VACUUM ANALYZE after creation and significant data changes
-- Run: VACUUM ANALYZE entry_embeddings;

-- Alternative: HNSW index (available in pgvector 0.5.0+)
-- HNSW generally provides better recall than IVFFlat with similar performance
-- Uncomment if using pgvector 0.5.0 or higher:
-- CREATE INDEX IF NOT EXISTS idx_entry_embeddings_vector_cosine_hnsw
-- ON entry_embeddings
-- USING hnsw (embedding vector_cosine_ops);

-- 2. Composite index for filtering active embeddings by user
-- Speeds up the JOIN and WHERE clauses
CREATE INDEX IF NOT EXISTS idx_entry_embeddings_active
ON entry_embeddings (entry_id, is_active)
WHERE is_active = TRUE;

-- 3. Index on entries for user filtering and date range queries
CREATE INDEX IF NOT EXISTS idx_entries_user_created
ON entries (user_id, created_at DESC)
WHERE is_deleted = FALSE;

-- 4. Index on entries tags for tag filtering (GIN index for JSON array containment)
CREATE INDEX IF NOT EXISTS idx_entries_tags
ON entries USING GIN (tags);

-- 5. Partial index for active, non-deleted entries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_entries_active_user
ON entries (user_id, id)
WHERE is_deleted = FALSE;

-- Performance Notes:
-- - The vector index (IVFFlat/HNSW) is crucial for large datasets (>10k entries)
-- - For smaller datasets (<1k entries), the overhead might not be worth it
-- - Monitor query performance with EXPLAIN ANALYZE to tune 'lists' parameter
-- - Consider increasing work_mem for better sort performance on score calculation
-- - pgvector indexes work best when vectors are normalized (they are in our case)

-- Query to check if indexes are being used:
-- EXPLAIN ANALYZE
-- SELECT e.id, ee.embedding <=> '[...]' as distance
-- FROM entries e
-- JOIN entry_embeddings ee ON e.id = ee.entry_id
-- WHERE e.user_id = 1 AND e.is_deleted = false AND ee.is_active = true
-- ORDER BY distance
-- LIMIT 10;
