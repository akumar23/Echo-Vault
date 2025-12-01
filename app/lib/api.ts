import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    // Guard against SSR - localStorage only available in browser
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        console.log('[API] Adding Authorization header to request:', config.url)
      } else {
        console.warn('[API] No token found in localStorage for request:', config.url)
      }
    } else {
      console.warn('[API] SSR context - skipping token for request:', config.url)
    }
    return config
  },
  (error) => {
    console.error('[API] Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('[API] Response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url
      })

      if (error.response.status === 401 || error.response.status === 403) {
        // Clear invalid token on 401/403 errors
        if (typeof window !== 'undefined') {
          console.warn('[API] Authentication failed - clearing token')
          localStorage.removeItem('token')
        }
      }
    } else if (error.request) {
      console.error('[API] No response received:', error.request)
    } else {
      console.error('[API] Error setting up request:', error.message)
    }
    return Promise.reject(error)
  }
)

export interface User {
  id: number
  email: string
  username: string
  created_at: string
  is_active: boolean
}

export interface Entry {
  id: number
  user_id: number
  title: string | null
  content: string
  tags: string[]
  mood_user: number | null
  mood_inferred: number | null
  created_at: string
  updated_at: string | null
}

export interface Insight {
  id: number
  user_id: number
  summary: string
  themes: string[]
  actions: string[]
  period_start: string
  period_end: string
  created_at: string
}

export interface Settings {
  id: number
  user_id: number
  search_half_life_days: number
  privacy_hard_delete: boolean
  ollama_url: string | null
}

export interface Reflection {
  reflection: string
  status: 'generating' | 'complete' | 'error'
}

export interface SearchResult {
  entry_id: number
  title: string | null
  content: string
  created_at: string
  score: number
  tags?: string[]
}

// Auth
export const authApi = {
  register: async (email: string, username: string, password: string) => {
    const response = await api.post('/auth/register', { email, username, password })
    return response.data
  },
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password })
    return response.data
  },
  getMe: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },
}

// Entries
export const entriesApi = {
  create: async (entry: { title?: string; content: string; tags?: string[]; mood_user?: number }) => {
    const response = await api.post('/entries', entry)
    return response.data
  },
  list: async (skip = 0, limit = 100) => {
    const response = await api.get('/entries', { params: { skip, limit } })
    return response.data
  },
  get: async (id: number) => {
    const response = await api.get(`/entries/${id}`)
    return response.data
  },
  update: async (id: number, entry: Partial<Entry>) => {
    const response = await api.put(`/entries/${id}`, entry)
    return response.data
  },
  delete: async (id: number) => {
    await api.delete(`/entries/${id}`)
  },
}

// Search
export const searchApi = {
  semantic: async (query: string, k = 10, date_range?: { start: string; end: string }, tags?: string[]) => {
    const response = await api.post('/search/semantic', { query, k, date_range, tags })
    return response.data
  },
}

// Insights
export const insightsApi = {
  getRecent: async (limit = 5) => {
    const response = await api.get('/insights/recent', { params: { limit } })
    return response.data
  },
  generate: async (days = 7) => {
    const response = await api.post('/insights/generate', null, { params: { days } })
    return response.data
  },
}

// Settings
export const settingsApi = {
  get: async () => {
    const response = await api.get('/settings')
    return response.data
  },
  update: async (settings: Partial<Settings>) => {
    const response = await api.put('/settings', settings)
    return response.data
  },
}

// Forget
export const forgetApi = {
  forget: async (entryId: number) => {
    await api.post(`/forget/${entryId}`)
  },
}

// Reflections
export const reflectionsApi = {
  get: async (): Promise<Reflection> => {
    const response = await api.get('/reflections')
    return response.data
  },
  regenerate: async (): Promise<Reflection> => {
    const response = await api.post('/reflections/regenerate')
    return response.data
  },
}

// Clusters
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

export const clustersApi = {
  trigger: async () => {
    const response = await api.post('/clusters/trigger')
    return response.data
  },
  list: async () => {
    const response = await api.get('/clusters/')
    return response.data
  },
  stats: async () => {
    const response = await api.get('/clusters/stats')
    return response.data
  },
  evolution: async () => {
    const response = await api.get('/clusters/evolution')
    return response.data
  },
  get: async (id: number) => {
    const response = await api.get(`/clusters/${id}`)
    return response.data
  },
  related: async (id: number) => {
    const response = await api.get(`/clusters/${id}/related`)
    return response.data
  },
}

export default api

