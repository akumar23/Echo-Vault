import { ArrowLeft, Github, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Documentation | EchoVault',
  description: 'Technical documentation for EchoVault - architecture and setup.',
}

export default function DocsPage() {
  return (
    <div className="docs-page">
      <div className="docs-page__header">
        <Link href="/" className="docs-page__back">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
        <h1>EchoVault Documentation</h1>
        <p>Technical guide for developers and self-hosters</p>
      </div>

      <div className="docs-page__content">
        <nav className="docs-nav">
          <h2>Contents</h2>
          <ul>
            <li><a href="#overview">Overview</a></li>
            <li><a href="#architecture">Architecture</a></li>
            <li><a href="#quick-start">Quick Start</a></li>
            <li><a href="#llm-configuration">LLM Configuration</a></li>
          </ul>
        </nav>

        <article className="docs-content prose">
          <section id="overview">
            <h2>Overview</h2>
            <p>
              EchoVault is a privacy-first journaling application with local LLM inference via Ollama,
              vector search via PGVector, and intelligent insights. All AI processing happens locally
              by default, with optional support for OpenAI API-compatible providers.
            </p>
          </section>

          <section id="architecture">
            <h2>Architecture</h2>

            <h3>Tech Stack</h3>
            <ul>
              <li><strong>Frontend:</strong> Next.js 16 (App Router), React 19, React Query (server state), Zustand (client state)</li>
              <li><strong>Backend:</strong> FastAPI (Python 3.11), SQLAlchemy ORM</li>
              <li><strong>Database:</strong> PostgreSQL 16 with pgvector extension (1024-dim vectors)</li>
              <li><strong>Queue:</strong> Celery with Redis broker</li>
              <li><strong>LLM:</strong> Ollama (local inference) or any OpenAI API-compatible provider</li>
            </ul>

            <h3>Key Data Flows</h3>
            <ol>
              <li>
                <strong>Entry Creation:</strong> Entry saved → Celery jobs enqueued → embedding generated →
                mood inferred → stored in entry_embeddings table
              </li>
              <li>
                <strong>Semantic Search:</strong> Query embedded → cosine similarity + time decay scoring →
                results ranked by <code>similarity * decay</code> where <code>decay = 1 / (1 + age_days / half_life)</code>
              </li>
              <li>
                <strong>Reflections/Chat:</strong> WebSocket streams LLM responses token-by-token to the client.
                Chat includes context from semantically similar entries.
              </li>
              <li>
                <strong>Forgetting:</strong> Soft delete sets <code>is_active=false</code> on embeddings and
                <code>is_deleted=true</code> on entry; hard delete removes all data permanently.
              </li>
            </ol>

            <h3>Services (Docker)</h3>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Port</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>web</td><td>3000</td><td>Next.js frontend</td></tr>
                <tr><td>api</td><td>8000</td><td>FastAPI backend</td></tr>
                <tr><td>worker</td><td>-</td><td>Celery background jobs</td></tr>
                <tr><td>beat</td><td>-</td><td>Celery scheduler</td></tr>
                <tr><td>db</td><td>5432</td><td>PostgreSQL + pgvector</td></tr>
                <tr><td>redis</td><td>6379</td><td>Celery broker</td></tr>
                <tr><td>ollama</td><td>11434</td><td>Local LLM inference</td></tr>
              </tbody>
            </table>
          </section>

          <section id="quick-start">
            <h2>Quick Start</h2>
            <pre>
{`# Clone the repository
git clone https://github.com/akumar23/Echo-Vault.git
cd echovault

# Start all services with Docker Compose
cd infra && docker compose up -d

# Pull required Ollama models
ollama pull llama3.1:8b
ollama pull mxbai-embed-large

# Run database migrations
docker compose exec api alembic upgrade head

# Visit http://localhost:3000`}
            </pre>
          </section>

          <section id="llm-configuration">
            <h2>LLM Configuration</h2>
            <p>
              EchoVault supports multiple LLM backends. By default, it uses Ollama for fully local inference.
              You can also configure external providers:
            </p>

            <h3>Supported Providers</h3>
            <ul>
              <li><strong>Ollama (default):</strong> Local inference, no API key required</li>
              <li><strong>OpenAI:</strong> GPT-4, GPT-3.5-turbo</li>
              <li><strong>Groq:</strong> Fast inference with Mixtral, LLaMA</li>
              <li><strong>Together.ai:</strong> Various open-source models</li>
              <li><strong>LM Studio:</strong> Local inference with custom models</li>
              <li><strong>vLLM:</strong> High-throughput local serving</li>
            </ul>

            <h3>Configuration</h3>
            <p>
              Users configure their own LLM endpoints per-account in Settings. The backend uses per-request
              httpx clients with user-specific URLs/tokens. Generation and embedding endpoints can be
              configured separately.
            </p>

            <pre>
{`# Example: Using Groq for generation, Ollama for embeddings
DEFAULT_GENERATION_URL=https://api.groq.com/openai/v1
DEFAULT_GENERATION_MODEL=mixtral-8x7b-32768
DEFAULT_EMBEDDING_URL=http://ollama:11434/v1
DEFAULT_EMBEDDING_MODEL=mxbai-embed-large`}
            </pre>
          </section>

        </article>
      </div>

      <div className="docs-page__footer">
        <a
          href="https://github.com/akumar23/Echo-Vault"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
        >
          <Github size={18} />
          View on GitHub
        </a>
        <a
          href="https://github.com/akumar23/Echo-Vault/blob/main/docs/API.md"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
        >
          Full API Docs
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  )
}
