'use client'

import Link from 'next/link'
import { Header } from '@/components/Header'

export default function HelpPage() {
  return (
    <div className="container">
      <Header title="Help & Documentation" showNav={false} />
      <div className="mb-5">
        <Link href="/settings" className="nav-link">&larr; Back to Settings</Link>
      </div>

      <div className="card">
        <h2>Understanding AI Features</h2>

        <div className="mb-6" style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-4">LLM Processing (Local AI)</h3>
          <p className="mb-4">
            An LLM (Large Language Model) is like having a smart assistant that reads and understands your journal entries.
            Unlike ChatGPT or other online services, this runs entirely on your computer - your private thoughts never leave your machine.
          </p>

          <h4 className="mb-2">What it does:</h4>
          <ul style={{ marginLeft: 'var(--space-5)' }}>
            <li className="mb-2">
              <strong>Reflections:</strong> After you write entries, the AI reads them and provides thoughtful insights.
              It notices patterns and suggests actionable advice.
            </li>
            <li className="mb-2">
              <strong>Mood Inference:</strong> Automatically detects the emotional tone of your entries (1-5 scale)
              even if you forget to set it manually.
            </li>
            <li>
              <strong>Insights Generation:</strong> Every night, analyzes your recent entries and creates summaries
              with themes and suggestions.
            </li>
          </ul>
        </div>

        <div className="mb-6" style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-4">Vector Search (Semantic Search)</h3>
          <p className="mb-4">
            Traditional search finds entries by matching exact words. Vector search understands the <em>meaning</em> behind
            your words, even if you use different phrasing.
          </p>

          <h4 className="mb-2">How it works:</h4>
          <ol style={{ marginLeft: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
            <li className="mb-2">When you write an entry, the AI converts it into a "vector" (a mathematical representation of meaning)</li>
            <li className="mb-2">When you search, your query is also converted to a vector</li>
            <li>The system finds entries with similar meanings, not just matching words</li>
          </ol>

          <div className="alert alert--info">
            <p className="mb-2"><strong>Example:</strong></p>
            <p className="mb-2">You search for: <em>"feeling anxious about deadlines"</em></p>
            <p>
              It finds entries about: "work stress", "pressure at the office", "worried about projects" -
              even if those exact words weren't used!
            </p>
          </div>
        </div>

        <div style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-4">Time-Decayed Scoring</h3>
          <p className="mb-4">
            A way to balance relevance with recency in search results. Entries are ranked by both how similar they are
            to your query AND how recent they are.
          </p>

          <div className="alert alert--info">
            <p className="mb-2"><strong>Example:</strong></p>
            <p className="mb-2">If you search for "work stress" and have 10 relevant entries:</p>
            <ul style={{ marginLeft: 'var(--space-5)' }}>
              <li>A very recent entry about work stress might rank #1 even if it's slightly less similar</li>
              <li>An older entry needs to be much more relevant to rank high</li>
              <li>You control this balance in Settings with the "Search Half-Life" setting</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Settings Explained</h2>

        <div className="mb-6" style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-4">Search Half-Life</h3>
          <p className="mb-4">
            Controls how quickly older entries decay in search results. This is the number of days it takes for an entry's
            "recency score" to drop to half its original value.
          </p>

          <div className="alert alert--warning">
            <p className="mb-2"><strong>Recommended Values:</strong></p>
            <ul style={{ marginLeft: 'var(--space-5)' }}>
              <li><strong>7-15 days:</strong> If you want to see what you wrote recently about a topic</li>
              <li><strong>30-60 days:</strong> Balanced approach (default: 30 days)</li>
              <li><strong>90-365 days:</strong> If you want the most relevant entries regardless of when they were written</li>
            </ul>
          </div>
        </div>

        <div style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-4">Hard Delete vs Soft Delete</h3>
          <p className="mb-4">
            When you use the "Forget" feature on an entry, you can choose between two deletion modes:
          </p>

          <div className="mb-5">
            <h4 className="text-accent mb-2">Soft Delete (Default)</h4>
            <ul style={{ marginLeft: 'var(--space-5)' }}>
              <li>Entry is removed from search results</li>
              <li>Content is preserved - you can still access it directly</li>
              <li>Embedding is zeroed out (can't be found by semantic search)</li>
              <li>Good for: "Hide this from search but keep the memory"</li>
            </ul>
          </div>

          <div>
            <h4 className="text-error mb-2">Hard Delete</h4>
            <ul style={{ marginLeft: 'var(--space-5)' }}>
              <li>Entry is permanently deleted from the database</li>
              <li>All associated data is removed (embeddings, attachments)</li>
              <li><strong>This action cannot be undone</strong></li>
              <li>Good for: Complete privacy - "I never want to see this again"</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Features Guide</h2>

        <div className="mb-5" style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-2">Creating Entries</h3>
          <ul style={{ marginLeft: 'var(--space-5)' }}>
            <li>Click "New Entry" to create a journal entry</li>
            <li>Add a title (optional) and write your content</li>
            <li>Set your mood using the slider (1 = very negative, 5 = very positive)</li>
            <li>Add tags to categorize your entries</li>
            <li>After saving, the AI will automatically generate an embedding and infer mood</li>
          </ul>
        </div>

        <div className="mb-5" style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-2">Semantic Search</h3>
          <ul style={{ marginLeft: 'var(--space-5)' }}>
            <li>Search by meaning, not just keywords</li>
            <li>Describe how you felt or what you were thinking about</li>
            <li>Results are ranked by relevance and recency</li>
            <li>Use filters to narrow by date range or tags</li>
          </ul>
        </div>

        <div className="mb-5" style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-2">Reflections</h3>
          <ul style={{ marginLeft: 'var(--space-5)' }}>
            <li>AI-generated insights about your entries</li>
            <li>Streams in real-time after you create an entry</li>
            <li>Includes themes, patterns, and actionable suggestions</li>
            <li>Based on your recent entries (last 7 days)</li>
          </ul>
        </div>

        <div className="mb-5" style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-2">Insights</h3>
          <ul style={{ marginLeft: 'var(--space-5)' }}>
            <li>Automated summaries generated nightly</li>
            <li>Available for 7-day and 30-day periods</li>
            <li>Includes summary, themes, and actionable suggestions</li>
            <li>View on the Insights page</li>
          </ul>
        </div>

        <div style={{ paddingTop: 'var(--space-5)', borderTop: '1px solid var(--border)' }}>
          <h3 className="mb-2">Mood Tracking</h3>
          <ul style={{ marginLeft: 'var(--space-5)' }}>
            <li>Set your mood manually when creating entries (1-5 scale)</li>
            <li>AI also infers mood automatically from your writing</li>
            <li>View trends on the Dashboard</li>
            <li>Track patterns over time with the Mood Trends chart</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>Privacy & Security</h2>
        <ul style={{ marginLeft: 'var(--space-5)' }}>
          <li className="mb-2"><strong>All processing is local:</strong> Your entries never leave your machine</li>
          <li className="mb-2"><strong>No external APIs:</strong> All AI features use your local Ollama instance</li>
          <li className="mb-2"><strong>Encrypted passwords:</strong> Passwords are hashed using bcrypt</li>
          <li className="mb-2"><strong>JWT authentication:</strong> Secure token-based authentication</li>
          <li className="mb-2"><strong>User-scoped data:</strong> You can only access your own entries</li>
          <li><strong>Export option:</strong> Download all your data in JSONL format</li>
        </ul>
      </div>

      <div className="alert alert--info mt-5">
        <p className="mb-2"><strong>Still have questions?</strong></p>
        <p className="text-muted">
          Check out the <Link href="/">Dashboard</Link> or view the architecture documentation for technical details.
        </p>
      </div>
    </div>
  )
}
