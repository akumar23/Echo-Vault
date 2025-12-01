'use client'

import Link from 'next/link'
import { Header } from '@/components/Header'

export default function HelpPage() {
  return (
    <div className="container">
      <Header title="Help & Documentation" showNav={false} />
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/settings" style={{ color: '#0070f3' }}>← Back to Settings</Link>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>Understanding AI Features</h2>
        
        <div style={{ marginBottom: '2rem' }}>
          <h3>🤖 LLM Processing (Local AI)</h3>
          <p style={{ marginBottom: '1rem' }}>
            An LLM (Large Language Model) is like having a smart assistant that reads and understands your journal entries. 
            Unlike ChatGPT or other online services, this runs entirely on your computer - your private thoughts never leave your machine.
          </p>
          
          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>What it does:</h4>
          <ul style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
            <li><strong>Reflections:</strong> After you write entries, the AI reads them and provides thoughtful insights. 
              It notices patterns and suggests actionable advice.</li>
            <li><strong>Mood Inference:</strong> Automatically detects the emotional tone of your entries (1-5 scale) 
              even if you forget to set it manually.</li>
            <li><strong>Insights Generation:</strong> Every night, analyzes your recent entries and creates summaries 
              with themes and suggestions.</li>
          </ul>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3>🔍 Vector Search (Semantic Search)</h3>
          <p style={{ marginBottom: '1rem' }}>
            Traditional search finds entries by matching exact words. Vector search understands the <em>meaning</em> behind 
            your words, even if you use different phrasing.
          </p>
          
          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>How it works:</h4>
          <ol style={{ marginLeft: '1.5rem', marginBottom: '1rem' }}>
            <li>When you write an entry, the AI converts it into a "vector" (a mathematical representation of meaning)</li>
            <li>When you search, your query is also converted to a vector</li>
            <li>The system finds entries with similar meanings, not just matching words</li>
          </ol>
          
          <div style={{ padding: '1rem', background: '#f0f7ff', borderRadius: '6px', marginTop: '1rem' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Example:</p>
            <p style={{ marginBottom: '0.5rem' }}>You search for: <em>"feeling anxious about deadlines"</em></p>
            <p>It finds entries about: "work stress", "pressure at the office", "worried about projects" - 
              even if those exact words weren't used!</p>
          </div>
        </div>

        <div>
          <h3>📊 Time-Decayed Scoring</h3>
          <p style={{ marginBottom: '1rem' }}>
            A way to balance relevance with recency in search results. Entries are ranked by both how similar they are 
            to your query AND how recent they are.
          </p>
          
          <div style={{ padding: '1rem', background: '#f0f7ff', borderRadius: '6px', marginTop: '1rem' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Example:</p>
            <p>If you search for "work stress" and have 10 relevant entries:</p>
            <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>A very recent entry about work stress might rank #1 even if it's slightly less similar</li>
              <li>An older entry needs to be much more relevant to rank high</li>
              <li>You control this balance in Settings with the "Search Half-Life" setting</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>Settings Explained</h2>
        
        <div style={{ marginBottom: '2rem' }}>
          <h3>Search Half-Life</h3>
          <p style={{ marginBottom: '1rem' }}>
            Controls how quickly older entries decay in search results. This is the number of days it takes for an entry's 
            "recency score" to drop to half its original value.
          </p>
          
          <div style={{ padding: '1rem', background: '#fff3cd', borderRadius: '6px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '0.75rem' }}>Recommended Values:</p>
            <ul style={{ marginLeft: '1.5rem' }}>
              <li><strong>7-15 days:</strong> If you want to see what you wrote recently about a topic</li>
              <li><strong>30-60 days:</strong> Balanced approach (default: 30 days)</li>
              <li><strong>90-365 days:</strong> If you want the most relevant entries regardless of when they were written</li>
            </ul>
          </div>
        </div>

        <div>
          <h3>Hard Delete vs Soft Delete</h3>
          <p style={{ marginBottom: '1rem' }}>
            When you use the "Forget" feature on an entry, you can choose between two deletion modes:
          </p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#28a745', marginBottom: '0.5rem' }}>Soft Delete (Default)</h4>
            <ul style={{ marginLeft: '1.5rem' }}>
              <li>Entry is removed from search results</li>
              <li>Content is preserved - you can still access it directly</li>
              <li>Embedding is zeroed out (can't be found by semantic search)</li>
              <li>Good for: "Hide this from search but keep the memory"</li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: '#dc3545', marginBottom: '0.5rem' }}>Hard Delete</h4>
            <ul style={{ marginLeft: '1.5rem' }}>
              <li>Entry is permanently deleted from the database</li>
              <li>All associated data is removed (embeddings, attachments)</li>
              <li><strong>This action cannot be undone</strong></li>
              <li>Good for: Complete privacy - "I never want to see this again"</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>Features Guide</h2>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <h3>Creating Entries</h3>
          <ul style={{ marginLeft: '1.5rem' }}>
            <li>Click "New Entry" to create a journal entry</li>
            <li>Add a title (optional) and write your content</li>
            <li>Set your mood using the slider (1 = very negative, 5 = very positive)</li>
            <li>Add tags to categorize your entries</li>
            <li>After saving, the AI will automatically generate an embedding and infer mood</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3>Semantic Search</h3>
          <ul style={{ marginLeft: '1.5rem' }}>
            <li>Search by meaning, not just keywords</li>
            <li>Describe how you felt or what you were thinking about</li>
            <li>Results are ranked by relevance and recency</li>
            <li>Use filters to narrow by date range or tags</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3>Reflections</h3>
          <ul style={{ marginLeft: '1.5rem' }}>
            <li>AI-generated insights about your entries</li>
            <li>Streams in real-time after you create an entry</li>
            <li>Includes themes, patterns, and actionable suggestions</li>
            <li>Based on your recent entries (last 7 days)</li>
          </ul>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3>Insights</h3>
          <ul style={{ marginLeft: '1.5rem' }}>
            <li>Automated summaries generated nightly</li>
            <li>Available for 7-day and 30-day periods</li>
            <li>Includes summary, themes, and actionable suggestions</li>
            <li>View on the Insights page</li>
          </ul>
        </div>

        <div>
          <h3>Mood Tracking</h3>
          <ul style={{ marginLeft: '1.5rem' }}>
            <li>Set your mood manually when creating entries (1-5 scale)</li>
            <li>AI also infers mood automatically from your writing</li>
            <li>View trends on the Dashboard</li>
            <li>Track patterns over time with the Mood Trends chart</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>Privacy & Security</h2>
        <ul style={{ marginLeft: '1.5rem' }}>
          <li><strong>All processing is local:</strong> Your entries never leave your machine</li>
          <li><strong>No external APIs:</strong> All AI features use your local Ollama instance</li>
          <li><strong>Encrypted passwords:</strong> Passwords are hashed using bcrypt</li>
          <li><strong>JWT authentication:</strong> Secure token-based authentication</li>
          <li><strong>User-scoped data:</strong> You can only access your own entries</li>
          <li><strong>Export option:</strong> Download all your data in JSONL format</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#e7f3ff', borderRadius: '6px' }}>
        <p style={{ marginBottom: '0.5rem' }}>
          <strong>Still have questions?</strong>
        </p>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          Check out the <Link href="/" style={{ color: '#0070f3' }}>Dashboard</Link> or 
          view the <a href="/docs/ARCHITECTURE.md" target="_blank" style={{ color: '#0070f3' }}>Architecture Documentation</a> for technical details.
        </p>
      </div>
    </div>
  )
}

