'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import {
  ArrowLeft,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { useUploadEntry } from '@/hooks/useEntryMutations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Keep in sync with api/app/services/file_reader.py ALLOWED_EXTENSIONS */
const ACCEPTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.html',
  '.htm',
  '.rtf',
  '.pdf',
  '.docx',
] as const

const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',')
const MAX_BYTES = 10 * 1024 * 1024
const PREVIEWABLE = new Set(['.txt', '.md', '.markdown', '.csv', '.html', '.htm', '.rtf'])

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function BackLink() {
  return (
    <Link
      href="/journal"
      className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to journal
    </Link>
  )
}

function ImportForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const mutation = useUploadEntry()

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const clearFile = useCallback(() => {
    setFile(null)
    setPreview(null)
    setLocalError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const selectFile = useCallback(async (next: File | null) => {
    setLocalError(null)
    setPreview(null)

    if (!next) {
      clearFile()
      return
    }

    const ext = extensionOf(next.name)
    if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
      setLocalError(
        `Unsupported file type. Allowed: ${ACCEPTED_EXTENSIONS.join(', ')}`,
      )
      clearFile()
      return
    }
    if (next.size > MAX_BYTES) {
      setLocalError('File exceeds the 10 MB size limit.')
      clearFile()
      return
    }
    if (next.size === 0) {
      setLocalError('File is empty.')
      clearFile()
      return
    }

    setFile(next)
    if (!title.trim()) {
      const stem = next.name.replace(/\.[^.]+$/, '')
      setTitle(stem)
    }

    if (PREVIEWABLE.has(ext)) {
      try {
        const text = await next.text()
        setPreview(text.slice(0, 4000))
      } catch {
        setPreview(null)
      }
    }
  }, [clearFile, title])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = e.dataTransfer.files?.[0]
      if (dropped) void selectFile(dropped)
    },
    [selectFile],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || mutation.isPending) return

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      const result = await mutation.mutateAsync({
        file,
        title: title.trim() || undefined,
        tags: tags.length ? tags : undefined,
      })
      if (result.truncated) {
        toast.message('Entry imported', {
          description: 'Text was truncated to the entry size limit.',
        })
      } else {
        toast.success('Entry imported')
      }
    } catch (err) {
      const detail = isAxiosError(err)
        ? (err.response?.data?.detail as string | undefined)
        : undefined
      const message =
        typeof detail === 'string'
          ? detail
          : 'Could not import this file. Try a different format.'
      setLocalError(message)
      toast.error(message)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <BackLink />

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Import a file
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a document and EchoVault will extract the text into a journal
          entry, ready for search and reflections — same as writing in the
          app.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center transition-colors',
            dragOver
              ? 'border-foreground bg-muted/40'
              : 'border-border bg-muted/20 hover:border-foreground/40 hover:bg-muted/30',
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Drop a file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ACCEPTED_EXTENSIONS.join(' · ')} · up to 10 MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => void selectFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {file && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)}
                {preview === null && !PREVIEWABLE.has(extensionOf(file.name))
                  ? ' · preview after import'
                  : null}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove file"
              onClick={(e) => {
                e.stopPropagation()
                clearFile()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {preview !== null && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Preview</Label>
              <Badge variant="secondary" className="font-normal">
                local read
              </Badge>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground">
              {preview}
              {file && file.size > 4000 ? '\n\n[…]' : ''}
            </pre>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="import-title">Title</Label>
          <Input
            id="import-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to the filename"
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="import-tags">Tags</Label>
          <Input
            id="import-tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="optional, comma-separated"
          />
        </div>

        {(localError || mutation.isError) && (
          <Alert variant="destructive">
            <AlertDescription>{localError ?? 'Import failed'}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!file || mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import as entry
              </>
            )}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/new">Write instead</Link>
          </Button>
        </div>
      </form>
    </main>
  )
}

export default function ImportPage() {
  return (
    <ProtectedRoute>
      <Header />
      <ImportForm />
    </ProtectedRoute>
  )
}
