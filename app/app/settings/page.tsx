'use client'

import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { SettingsUpdate } from '@/lib/api'
import {
  Search,
  Bot,
  Shield,
  HelpCircle,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  MessageCircle
} from 'lucide-react'
import { useInsightVoice, InsightVoice } from '@/contexts/InsightVoiceContext'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()
  const { voice, setVoice } = useInsightVoice()

  // Search settings
  const [halfLife, setHalfLife] = useState(30)
  const [hardDelete, setHardDelete] = useState(false)

  // Generation LLM settings
  const [generationUrl, setGenerationUrl] = useState('')
  const [generationToken, setGenerationToken] = useState('')
  const [generationModel, setGenerationModel] = useState('')
  const [generationUrlError, setGenerationUrlError] = useState('')
  const [showGenerationToken, setShowGenerationToken] = useState(false)

  // Embedding LLM settings
  const [embeddingUrl, setEmbeddingUrl] = useState('')
  const [embeddingToken, setEmbeddingToken] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [embeddingUrlError, setEmbeddingUrlError] = useState('')
  const [showEmbeddingToken, setShowEmbeddingToken] = useState(false)

  // Sync state when settings load
  useEffect(() => {
    if (settings) {
      setHalfLife(settings.search_half_life_days ?? 30)
      setHardDelete(settings.privacy_hard_delete ?? false)
      setGenerationUrl(settings.generation_url ?? '')
      setGenerationModel(settings.generation_model ?? '')
      setEmbeddingUrl(settings.embedding_url ?? '')
      setEmbeddingModel(settings.embedding_model ?? '')
      // Don't set tokens - they are write-only
    }
  }, [settings])

  const validateUrl = (url: string, setError: (e: string) => void): boolean => {
    if (!url) return true // Empty is valid (uses default)
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        setError('URL must use http:// or https://')
        return false
      }
      setError('')
      return true
    } catch {
      setError('Please enter a valid URL (e.g., http://host.docker.internal:11434)')
      return false
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="container">
          <div className="flex items-center gap-2">
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span className="text-muted">Loading...</span>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const handleSave = () => {
    if (!validateUrl(generationUrl, setGenerationUrlError)) return
    if (!validateUrl(embeddingUrl, setEmbeddingUrlError)) return

    const update: SettingsUpdate = {
      search_half_life_days: halfLife,
      privacy_hard_delete: hardDelete,
      generation_url: generationUrl || null,
      generation_model: generationModel || null,
      embedding_url: embeddingUrl || null,
      embedding_model: embeddingModel || null,
    }

    // Only send token if user entered a new one
    if (generationToken) {
      update.generation_api_token = generationToken
    }
    if (embeddingToken) {
      update.embedding_api_token = embeddingToken
    }

    updateMutation.mutate(update, {
      onSuccess: () => {
        alert('Settings updated!')
        // Clear token fields after save
        setGenerationToken('')
        setEmbeddingToken('')
      }
    })
  }

  const clearToken = (type: 'generation' | 'embedding') => {
    const update: SettingsUpdate = type === 'generation'
      ? { generation_api_token: '' }
      : { embedding_api_token: '' }

    updateMutation.mutate(update, {
      onSuccess: () => {
        alert(`${type === 'generation' ? 'Generation' : 'Embedding'} API token cleared!`)
      }
    })
  }

  const LLMSettingsSection = ({
    title,
    description,
    url,
    setUrl,
    urlError,
    setUrlError,
    token,
    setToken,
    showToken,
    setShowToken,
    model,
    setModel,
    tokenSet,
    type,
  }: {
    title: string
    description: string
    url: string
    setUrl: (v: string) => void
    urlError: string
    setUrlError: (v: string) => void
    token: string
    setToken: (v: string) => void
    showToken: boolean
    setShowToken: (v: boolean) => void
    model: string
    setModel: (v: string) => void
    tokenSet: boolean
    type: 'generation' | 'embedding'
  }) => (
    <div className="mb-6" style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
      <h3 className="mb-2">{title}</h3>
      <p className="text-muted mb-5">{description}</p>

      {/* URL */}
      <div className="form-group">
        <label htmlFor={`${type}-url`}>API URL</label>
        <input
          id={`${type}-url`}
          type="url"
          className={`input ${urlError ? 'input--error' : ''}`}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (urlError) validateUrl(e.target.value, setUrlError)
          }}
          onBlur={(e) => validateUrl(e.target.value, setUrlError)}
          placeholder="http://host.docker.internal:11434"
          aria-invalid={!!urlError}
        />
        {urlError && <p className="form-error">{urlError}</p>}
        <p className="form-helper">Leave empty to use the default server</p>
      </div>

      {/* API Token */}
      <div className="form-group">
        <label htmlFor={`${type}-token`}>
          API Token {tokenSet && <span className="text-accent">(configured)</span>}
        </label>
        <div className="flex gap-2">
          <input
            id={`${type}-token`}
            type={showToken ? 'text' : 'password'}
            className="input flex-1"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tokenSet ? '********' : 'Optional - for cloud providers'}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="btn btn-secondary btn-sm"
            title={showToken ? 'Hide token' : 'Show token'}
          >
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {tokenSet && (
            <button
              type="button"
              onClick={() => clearToken(type)}
              className="btn btn-danger btn-sm"
              title="Clear token"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <p className="form-helper">Required for OpenAI, Anthropic, etc. Optional for local Ollama.</p>
      </div>

      {/* Model Name */}
      <div className="form-group mb-0">
        <label htmlFor={`${type}-model`}>Model Name</label>
        <input
          id={`${type}-model`}
          type="text"
          className="input"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={type === 'generation' ? 'llama3.1:8b, gpt-4, claude-3-haiku, etc.' : 'mxbai-embed-large, text-embedding-3-small, etc.'}
        />
        <p className="form-helper">Leave empty to use the default model</p>
      </div>
    </div>
  )

  return (
    <ProtectedRoute>
      <div className="container container--narrow">
        <Header title="Settings" showNav={false} />
        <div className="text-right mb-5">
          <Link href="/help" className="nav-link">
            <HelpCircle size={16} />
            Need help? View Help Page
          </Link>
        </div>

        {/* Search Settings */}
        <div className="card">
          <div className="section-header">
            <div className="section-header__icon">
              <Search />
            </div>
            <h2>Search Settings</h2>
          </div>
          <div className="form-group">
            <label htmlFor="half-life">
              Search Half-Life: <span className="text-accent">{halfLife}</span> days
            </label>
            <input
              id="half-life"
              type="range"
              min="1"
              max="365"
              value={halfLife}
              onChange={(e) => setHalfLife(parseFloat(e.target.value))}
              className="range-slider"
            />
            <div className="alert alert--info mt-4">
              <p className="mb-2"><strong>What does this do?</strong></p>
              <p className="mb-4">
                Controls how search results balance relevance vs. recency. When you search for entries,
                the system considers both how similar they are to your query AND how recent they are.
              </p>
              <ul style={{ marginLeft: 'var(--space-5)' }}>
                <li><strong>Lower values (1-15 days):</strong> Recent entries rank higher</li>
                <li><strong>Medium values (15-60 days):</strong> Balanced approach</li>
                <li><strong>Higher values (60-365 days):</strong> Only relevance matters</li>
              </ul>
            </div>
          </div>
        </div>

        {/* LLM Settings */}
        <div className="card">
          <div className="section-header">
            <div className="section-header__icon">
              <Bot />
            </div>
            <h2>LLM Settings</h2>
          </div>
          <p className="text-muted mb-5">
            Configure the AI models used for reflections, insights, mood analysis, and semantic search.
            Uses OpenAI-compatible API format.
          </p>

          <LLMSettingsSection
            title="Text Generation"
            description="Used for reflections, insights, and mood analysis"
            url={generationUrl}
            setUrl={setGenerationUrl}
            urlError={generationUrlError}
            setUrlError={setGenerationUrlError}
            token={generationToken}
            setToken={setGenerationToken}
            showToken={showGenerationToken}
            setShowToken={setShowGenerationToken}
            model={generationModel}
            setModel={setGenerationModel}
            tokenSet={settings?.generation_api_token_set ?? false}
            type="generation"
          />

          <LLMSettingsSection
            title="Embeddings"
            description="Used for semantic search to find related entries"
            url={embeddingUrl}
            setUrl={setEmbeddingUrl}
            urlError={embeddingUrlError}
            setUrlError={setEmbeddingUrlError}
            token={embeddingToken}
            setToken={setEmbeddingToken}
            showToken={showEmbeddingToken}
            setShowToken={setShowEmbeddingToken}
            model={embeddingModel}
            setModel={setEmbeddingModel}
            tokenSet={settings?.embedding_api_token_set ?? false}
            type="embedding"
          />

          <div className="alert alert--info">
            <strong>Tip:</strong> For local Ollama with Docker, use <code>http://host.docker.internal:11434</code> as the URL.
            Make sure the models are pulled (e.g., <code>ollama pull llama3.1:8b</code>).
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="card">
          <div className="section-header">
            <div className="section-header__icon">
              <Shield />
            </div>
            <h2>Privacy Settings</h2>
          </div>
          <div className="form-group">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
              />
              Enable Hard Delete
            </label>
            <div className="alert alert--warning mt-4">
              <p className="mb-2"><strong>What does this do?</strong></p>
              <p className="mb-4">Controls what happens when you use the "Forget" feature on an entry.</p>

              <p className="mb-2"><strong>When disabled (Soft Delete):</strong></p>
              <ul style={{ marginLeft: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
                <li>Entry is removed from search results</li>
                <li>Content is preserved in your journal</li>
                <li>Embedding vector is zeroed out</li>
              </ul>

              <p className="mb-2"><strong>When enabled (Hard Delete):</strong></p>
              <ul style={{ marginLeft: 'var(--space-5)' }}>
                <li>Entry is permanently deleted</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Insight Voice Settings */}
        <div className="card">
          <div className="section-header">
            <div className="section-header__icon">
              <MessageCircle />
            </div>
            <h2>Insight Voice</h2>
          </div>
          <p className="text-muted mb-5">
            Choose how EchoVault speaks to you. This affects greetings, insights, and nudges.
          </p>

          <div className="voice-selector">
            {([
              {
                id: 'gentle' as InsightVoice,
                name: 'Gentle',
                emoji: '🌿',
                description: 'Warm, supportive, and encouraging',
                example: '"You\'ve been on a great streak lately"'
              },
              {
                id: 'direct' as InsightVoice,
                name: 'Direct',
                emoji: '📊',
                description: 'Concise, factual, no-nonsense',
                example: '"Mood up. Strong momentum."'
              },
              {
                id: 'playful' as InsightVoice,
                name: 'Playful',
                emoji: '✨',
                description: 'Fun, upbeat, with emojis',
                example: '"Look at you go! On fire! 🔥"'
              }
            ]).map((option) => (
              <button
                key={option.id}
                type="button"
                className={`voice-option ${voice === option.id ? 'voice-option--active' : ''}`}
                onClick={() => setVoice(option.id)}
              >
                <span className="voice-option__emoji">{option.emoji}</span>
                <div className="voice-option__content">
                  <span className="voice-option__name">{option.name}</span>
                  <span className="voice-option__description">{option.description}</span>
                  <span className="voice-option__example">{option.example}</span>
                </div>
                {voice === option.id && (
                  <span className="voice-option__check">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="btn btn-cta btn-lg"
          disabled={updateMutation.isPending}
          style={{ width: '100%' }}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Settings
            </>
          )}
        </button>
      </div>
    </ProtectedRoute>
  )
}
