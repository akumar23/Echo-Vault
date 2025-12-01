export interface Cluster {
  cluster_id: number
  label: string | null
  description: string | null
  entry_count: number
  created_at: string
  is_stale: boolean
}

export interface ClusterEntry {
  entry_id: number
  title: string | null
  content: string
  created_at: string
  tags: string[]
}

export interface ClusterDetail {
  cluster_id: number
  label: string | null
  description: string | null
  entries: ClusterEntry[]
  representative_entry_ids: number[]
  confidence: number | null
}

export interface ClusterStats {
  total_clusters: number
  total_clustered_entries: number
  total_unclustered_entries: number
  largest_cluster_size: number
  last_clustering_date: string | null
}

export interface ClusterEvolutionSnapshot {
  snapshot_id: number
  snapshot_date: string
  total_entries: number
  total_clusters: number
  noise_count: number
  metadata: Record<string, any>
}

export interface RelatedCluster {
  cluster_id: number
  label: string | null
  description: string | null
  similarity: number
  entry_count: number
}

export interface TriggerClusteringResponse {
  status: string
  message: string
}
