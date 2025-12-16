'use client'

import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { SettingsUpdate } from '@/lib/api'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()

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
      setError('Please enter a valid URL (e.g., http://localhost:11434)')
      return false
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="container">Loading...</div>
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

  const inputStyle = (hasError: boolean) => ({
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    border: hasError ? '2px solid #dc3545' : '1px solid #ccc',
    borderRadius: '6px',
    marginTop: '0.5rem',
  })

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
    <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee' }}>
      <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>{title}</h3>
      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{description}</p>

      {/* URL */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor={`${type}-url`} style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
          API URL
        </label>
        <input
          id={`${type}-url`}
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (urlError) validateUrl(e.target.value, setUrlError)
          }}
          onBlur={(e) => validateUrl(e.target.value, setUrlError)}
          placeholder="http://localhost:11434"
          style={inputStyle(!!urlError)}
        />
        {urlError && (
          <p style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.5rem' }}>{urlError}</p>
        )}
        <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.25rem' }}>
          Leave empty to use the default server
        </p>
      </div>

      {/* API Token */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor={`${type}-token`} style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
          API Token {tokenSet && <span style={{ color: '#28a745', fontSize: '0.8rem' }}>(configured)</span>}
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            id={`${type}-token`}
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tokenSet ? '********' : 'Optional - for cloud providers'}
            style={{ ...inputStyle(false), flex: 1 }}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            style={{ padding: '0.75rem', border: '1px solid #ccc', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
          >
            {showToken ? 'Hide' : 'Show'}
          </button>
          {tokenSet && (
            <button
              type="button"
              onClick={() => clearToken(type)}
              style={{ padding: '0.75rem', border: '1px solid #dc3545', borderRadius: '6px', background: '#fff', color: '#dc3545', cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </div>
        <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.25rem' }}>
          Required for OpenAI, Anthropic, etc. Optional for local Ollama.
        </p>
      </div>

      {/* Model Name */}
      <div>
        <label htmlFor={`${type}-model`} style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
          Model Name
        </label>
        <input
          id={`${type}-model`}
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={type === 'generation' ? 'llama3.1:8b, gpt-4, claude-3-haiku, etc.' : 'mxbai-embed-large, text-embedding-3-small, etc.'}
          style={inputStyle(false)}
        />
        <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.25rem' }}>
          Leave empty to use the default model
        </p>
      </div>
    </div>
  )

  return (
    <ProtectedRoute>
      <div className="container">
        <Header title="Settings" showNav={false} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <Link href="/help" style={{ color: '#0070f3', textDecoration: 'underline' }}>
            Need help? View Help Page
          </Link>
        </div>

        {/* Search Settings */}
        <div className="card">
          <h2>Search Settings</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="half-life" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Search Half-Life: {halfLife} days
            </label>
            <input
              id="half-life"
              type="range"
              min="1"
              max="365"
              value={halfLife}
              onChange={(e) => setHalfLife(parseFloat(e.target.value))}
              style={{ width: '100%', marginTop: '0.5rem' }}
            />
            <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#f5f5f5', borderRadius: '6px' }}>
              <p style={{ color: '#333', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: '500' }}>
                What does this do?
              </p>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                This controls how search results balance relevance vs. recency. When you search for entries, the system considers both how similar they are to your query AND how recent they are.
              </p>
              <ul style={{ color: '#666', fontSize: '0.9rem', marginLeft: '1.5rem', marginBottom: '0.75rem' }}>
                <li><strong>Lower values (1-15 days):</strong> Recent entries rank higher, even if slightly less relevant</li>
                <li><strong>Medium values (15-60 days):</strong> Balanced approach - both relevance and recency matter</li>
                <li><strong>Higher values (60-365 days):</strong> All entries treated equally by age - only relevance matters</li>
              </ul>
            </div>
          </div>
        </div>

        {/* LLM Settings */}
        <div className="card">
          <h2>LLM Settings</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            Configure the AI models used for reflections, insights, mood analysis, and semantic search.
            Uses OpenAI-compatible API format, which works with Ollama, OpenAI, LM Studio, vLLM, and more.
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

          <div style={{ padding: '1rem', background: '#e7f3ff', borderRadius: '6px', borderLeft: '4px solid #0070f3' }}>
            <p style={{ color: '#333', fontSize: '0.9rem', margin: 0 }}>
              <strong>Tip:</strong> For local Ollama, use <code>http://localhost:11434</code> as the URL.
              Make sure the models are pulled (e.g., <code>ollama pull llama3.1:8b</code>).
            </p>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="card">
          <h2>Privacy Settings</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              <input
                type="checkbox"
                checked={hardDelete}
                onChange={(e) => setHardDelete(e.target.checked)}
                style={{ marginRight: '0.5rem', width: '1.2rem', height: '1.2rem' }}
              />
              Enable Hard Delete
            </label>
            <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#f5f5f5', borderRadius: '6px' }}>
              <p style={{ color: '#333', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: '500' }}>
                What does this do?
              </p>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                Controls what happens when you use the "Forget" feature on an entry.
              </p>
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <strong>When disabled (Soft Delete):</strong>
                </p>
                <ul style={{ color: '#666', fontSize: '0.9rem', marginLeft: '1.5rem' }}>
                  <li>Entry is removed from search results</li>
                  <li>Entry content is preserved in your journal</li>
                  <li>Embedding vector is zeroed out</li>
                </ul>
              </div>
              <div>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  <strong>When enabled (Hard Delete):</strong>
                </p>
                <ul style={{ color: '#666', fontSize: '0.9rem', marginLeft: '1.5rem' }}>
                  <li>Entry is permanently deleted</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={updateMutation.isPending}
          style={{ marginTop: '1rem' }}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </ProtectedRoute>
  )
}
