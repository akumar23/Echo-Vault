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
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Clear invalid token on auth errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
      }
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

export interface SemanticMoodInsight {
  type: 'positive_theme' | 'negative_theme' | 'mood_trend'
  theme: string
  avg_mood: number
  count: number
  insight: string
}

export interface SemanticMoodInsightsResponse {
  insights: SemanticMoodInsight[]
  total_entries: number
  has_sufficient_data: boolean
}

export interface Settings {
  id: number
  user_id: number
  search_half_life_days: number
  privacy_hard_delete: boolean

  // Generation LLM settings
  generation_url: string | null
  generation_api_token_set: boolean
  generation_model: string | null

  // Embedding LLM settings
  embedding_url: string | null
  embedding_api_token_set: boolean
  embedding_model: string | null
}

export interface SettingsUpdate {
  search_half_life_days?: number
  privacy_hard_delete?: boolean

  // Generation LLM settings (token is write-only)
  generation_url?: string | null
  generation_api_token?: string | null
  generation_model?: string | null

  // Embedding LLM settings (token is write-only)
  embedding_url?: string | null
  embedding_api_token?: string | null
  embedding_model?: string | null
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

// Prompts
export interface WritingSuggestion {
  id: string
  text: string
  type: 'question' | 'prompt' | 'continuation'
  context: string
  source_entry_id?: number
}

export interface SuggestionsResponse {
  suggestions: WritingSuggestion[]
  preferred_type: string | null
  has_sufficient_data: boolean
}

export interface PromptInteraction {
  prompt_text: string
  prompt_type: 'question' | 'prompt' | 'continuation'
  action: 'displayed' | 'clicked' | 'cycled' | 'dismissed' | 'completed'
  entry_id?: number
  source_entry_id?: number
}

export interface PromptStats {
  prompt_type: string
  displayed_count: number
  clicked_count: number
  completed_count: number
  completion_rate: number
}

export interface PromptStatsResponse {
  stats: PromptStats[]
  total_interactions: number
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
  getMoodContent: async (): Promise<SemanticMoodInsightsResponse> => {
    const response = await api.get('/insights/mood-content')
    return response.data
  },
}

// Settings
export const settingsApi = {
  get: async (): Promise<Settings> => {
    const response = await api.get('/settings')
    return response.data
  },
  update: async (settings: SettingsUpdate): Promise<Settings> => {
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

// Prompts
export const promptsApi = {
  getSuggestions: async (): Promise<SuggestionsResponse> => {
    const response = await api.get('/prompts/suggestions')
    return response.data
  },
  logInteraction: async (interaction: PromptInteraction): Promise<void> => {
    await api.post('/prompts/interaction', interaction)
  },
  getStats: async (): Promise<PromptStatsResponse> => {
    const response = await api.get('/prompts/stats')
    return response.data
  },
}

export default api

