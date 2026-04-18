"use client";

import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Header } from "@/components/Header";
import { SettingsUpdate } from "@/lib/api";
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
  MessageCircle,
} from "lucide-react";
import {
  useInsightVoice,
  InsightVoice,
} from "@/contexts/InsightVoiceContext";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface LLMSettingsSectionProps {
  title: string;
  description: string;
  url: string;
  setUrl: (v: string) => void;
  urlError: string;
  validateUrl: (url: string, setError: (e: string) => void) => boolean;
  setUrlError: (v: string) => void;
  token: string;
  setToken: (v: string) => void;
  showToken: boolean;
  setShowToken: (v: boolean) => void;
  model: string;
  setModel: (v: string) => void;
  tokenSet: boolean;
  type: "generation" | "embedding";
  onClearToken: (type: "generation" | "embedding") => void;
}

function LLMSettingsSection({
  title,
  description,
  url,
  setUrl,
  urlError,
  validateUrl,
  setUrlError,
  token,
  setToken,
  showToken,
  setShowToken,
  model,
  setModel,
  tokenSet,
  type,
  onClearToken,
}: LLMSettingsSectionProps) {
  return (
    <div className="space-y-5 border-t border-border pt-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${type}-url`}>API URL</Label>
        <Input
          id={`${type}-url`}
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (urlError) validateUrl(e.target.value, setUrlError);
          }}
          onBlur={(e) => validateUrl(e.target.value, setUrlError)}
          placeholder="http://host.docker.internal:11434"
          aria-invalid={!!urlError}
        />
        {urlError && <p className="text-sm text-destructive">{urlError}</p>}
        <p className="text-xs text-muted-foreground">
          Leave empty to use the default server
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${type}-token`}>
          API Token{" "}
          {tokenSet && (
            <span className="text-xs font-normal text-primary">
              (configured)
            </span>
          )}
        </Label>
        <div className="flex gap-2">
          <Input
            id={`${type}-token`}
            type={showToken ? "text" : "password"}
            className="flex-1"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              tokenSet ? "********" : "Optional - for cloud providers"
            }
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowToken(!showToken)}
            title={showToken ? "Hide token" : "Show token"}
          >
            {showToken ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span className="sr-only">
              {showToken ? "Hide token" : "Show token"}
            </span>
          </Button>
          {tokenSet && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={() => onClearToken(type)}
              title="Clear token"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Clear token</span>
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Required for OpenAI, Anthropic, etc. Optional for local Ollama.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${type}-model`}>Model Name</Label>
        <Input
          id={`${type}-model`}
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={
            type === "generation"
              ? "llama3.1:8b, gpt-4, claude-3-haiku, etc."
              : "mxbai-embed-large, text-embedding-3-small, etc."
          }
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to use the default model
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const { voice, setVoice } = useInsightVoice();
  const { toast } = useToast();

  // Search settings
  const [halfLife, setHalfLife] = useState(30);
  const [hardDelete, setHardDelete] = useState(false);

  // Generation LLM settings
  const [generationUrl, setGenerationUrl] = useState("");
  const [generationToken, setGenerationToken] = useState("");
  const [generationModel, setGenerationModel] = useState("");
  const [generationUrlError, setGenerationUrlError] = useState("");
  const [showGenerationToken, setShowGenerationToken] = useState(false);

  // Embedding LLM settings
  const [embeddingUrl, setEmbeddingUrl] = useState("");
  const [embeddingToken, setEmbeddingToken] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [embeddingUrlError, setEmbeddingUrlError] = useState("");
  const [showEmbeddingToken, setShowEmbeddingToken] = useState(false);

  // Sync state when settings load
  useEffect(() => {
    if (settings) {
      setHalfLife(settings.search_half_life_days ?? 30);
      setHardDelete(settings.privacy_hard_delete ?? false);
      setGenerationUrl(settings.generation_url ?? "");
      setGenerationModel(settings.generation_model ?? "");
      setEmbeddingUrl(settings.embedding_url ?? "");
      setEmbeddingModel(settings.embedding_model ?? "");
      // Tokens are write-only — never hydrated.
    }
  }, [settings]);

  const validateUrl = (
    url: string,
    setError: (e: string) => void,
  ): boolean => {
    if (!url) return true;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setError("URL must use http:// or https://");
        return false;
      }
      setError("");
      return true;
    } catch {
      setError(
        "Please enter a valid URL (e.g., http://host.docker.internal:11434)",
      );
      return false;
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <Header />
        <main className="mx-auto w-full max-w-5xl px-6 py-8">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const handleSave = () => {
    if (!validateUrl(generationUrl, setGenerationUrlError)) return;
    if (!validateUrl(embeddingUrl, setEmbeddingUrlError)) return;

    const update: SettingsUpdate = {
      search_half_life_days: halfLife,
      privacy_hard_delete: hardDelete,
      generation_url: generationUrl || null,
      generation_model: generationModel || null,
      embedding_url: embeddingUrl || null,
      embedding_model: embeddingModel || null,
    };

    if (generationToken) update.generation_api_token = generationToken;
    if (embeddingToken) update.embedding_api_token = embeddingToken;

    updateMutation.mutate(update, {
      onSuccess: () => {
        toast({ message: "Settings updated!", type: "success" });
        setGenerationToken("");
        setEmbeddingToken("");
      },
    });
  };

  const clearToken = (type: "generation" | "embedding") => {
    const update: SettingsUpdate =
      type === "generation"
        ? { generation_api_token: "" }
        : { embedding_api_token: "" };

    updateMutation.mutate(update, {
      onSuccess: () => {
        toast({
          message: `${
            type === "generation" ? "Generation" : "Embedding"
          } API token cleared!`,
          type: "success",
        });
      },
    });
  };

  const voiceOptions: {
    id: InsightVoice;
    name: string;
    emoji: string;
    description: string;
    example: string;
  }[] = [
    {
      id: "gentle",
      name: "Gentle",
      emoji: "🌿",
      description: "Warm, supportive, and encouraging",
      example: '"You\'ve been on a great streak lately"',
    },
    {
      id: "direct",
      name: "Direct",
      emoji: "📊",
      description: "Concise, factual, no-nonsense",
      example: '"Mood up. Strong momentum."',
    },
    {
      id: "playful",
      name: "Playful",
      emoji: "✨",
      description: "Fun, upbeat, with emojis",
      example: '"Look at you go! On fire! 🔥"',
    },
  ];

  return (
    <ProtectedRoute>
      <Header />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure your journal, AI, and privacy preferences.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/help">
              <HelpCircle className="h-4 w-4" />
              Help
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="search" className="gap-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="llm" className="gap-2">
              <Bot className="h-4 w-4" />
              LLM
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="h-4 w-4" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="voice" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Voice
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            <Card variant="bordered">
              <CardHeader>
                <CardTitle>Search Settings</CardTitle>
                <CardDescription>
                  Control how semantic search balances relevance and recency.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="half-life">
                    Search Half-Life:{" "}
                    <span className="text-primary">{halfLife}</span> days
                  </Label>
                  <Slider
                    id="half-life"
                    min={1}
                    max={365}
                    step={1}
                    value={[halfLife]}
                    onValueChange={(values) =>
                      setHalfLife(values[0] ?? halfLife)
                    }
                  />
                </div>
                <Alert>
                  <AlertDescription>
                    <p className="mb-2">
                      <strong>What does this do?</strong>
                    </p>
                    <p className="mb-4">
                      Controls how search results balance relevance vs.
                      recency. When you search for entries, the system
                      considers both how similar they are to your query AND
                      how recent they are.
                    </p>
                    <ul className="ml-5 list-disc space-y-1">
                      <li>
                        <strong>Lower values (1-15 days):</strong> Recent
                        entries rank higher
                      </li>
                      <li>
                        <strong>Medium values (15-60 days):</strong> Balanced
                        approach
                      </li>
                      <li>
                        <strong>Higher values (60-365 days):</strong> Only
                        relevance matters
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="llm">
            <Card variant="bordered">
              <CardHeader>
                <CardTitle>LLM Settings</CardTitle>
                <CardDescription>
                  Configure the AI models used for reflections, insights, mood
                  analysis, and semantic search. Uses OpenAI-compatible API
                  format.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <LLMSettingsSection
                  title="Text Generation"
                  description="Used for reflections, insights, and mood analysis"
                  url={generationUrl}
                  setUrl={setGenerationUrl}
                  urlError={generationUrlError}
                  validateUrl={validateUrl}
                  setUrlError={setGenerationUrlError}
                  token={generationToken}
                  setToken={setGenerationToken}
                  showToken={showGenerationToken}
                  setShowToken={setShowGenerationToken}
                  model={generationModel}
                  setModel={setGenerationModel}
                  tokenSet={settings?.generation_api_token_set ?? false}
                  type="generation"
                  onClearToken={clearToken}
                />

                <LLMSettingsSection
                  title="Embeddings"
                  description="Used for semantic search to find related entries"
                  url={embeddingUrl}
                  setUrl={setEmbeddingUrl}
                  urlError={embeddingUrlError}
                  validateUrl={validateUrl}
                  setUrlError={setEmbeddingUrlError}
                  token={embeddingToken}
                  setToken={setEmbeddingToken}
                  showToken={showEmbeddingToken}
                  setShowToken={setShowEmbeddingToken}
                  model={embeddingModel}
                  setModel={setEmbeddingModel}
                  tokenSet={settings?.embedding_api_token_set ?? false}
                  type="embedding"
                  onClearToken={clearToken}
                />

                <Alert>
                  <AlertDescription>
                    <strong>Tip:</strong> For local Ollama with Docker, use{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      http://host.docker.internal:11434
                    </code>{" "}
                    as the URL. Make sure the models are pulled (e.g.,{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      ollama pull llama3.1:8b
                    </code>
                    ).
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card variant="bordered">
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>
                  Control what happens when you forget an entry.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 p-4">
                  <div className="space-y-1">
                    <Label htmlFor="hard-delete" className="text-sm">
                      Enable Hard Delete
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Permanently delete entries instead of soft-deleting.
                    </p>
                  </div>
                  <Switch
                    id="hard-delete"
                    checked={hardDelete}
                    onCheckedChange={setHardDelete}
                  />
                </div>
                <Alert variant="destructive">
                  <AlertDescription>
                    <p className="mb-2">
                      <strong>What does this do?</strong>
                    </p>
                    <p className="mb-4">
                      Controls what happens when you use the &ldquo;Forget&rdquo;
                      feature on an entry.
                    </p>

                    <p className="mb-2">
                      <strong>When disabled (Soft Delete):</strong>
                    </p>
                    <ul className="mb-4 ml-5 list-disc space-y-1">
                      <li>Entry is removed from search results</li>
                      <li>Content is preserved in your journal</li>
                      <li>Embedding vector is zeroed out</li>
                    </ul>

                    <p className="mb-2">
                      <strong>When enabled (Hard Delete):</strong>
                    </p>
                    <ul className="ml-5 list-disc space-y-1">
                      <li>Entry is permanently deleted</li>
                      <li>This action cannot be undone</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voice">
            <Card variant="bordered">
              <CardHeader>
                <CardTitle>Insight Voice</CardTitle>
                <CardDescription>
                  Choose how EchoVault speaks to you. This affects greetings,
                  insights, and nudges.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {voiceOptions.map((option) => {
                    const active = voice === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setVoice(option.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors",
                          "hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border",
                        )}
                      >
                        <span className="text-2xl">{option.emoji}</span>
                        <div className="flex-1 space-y-1">
                          <div className="font-medium text-foreground">
                            {option.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {option.description}
                          </div>
                          <div className="text-sm italic text-muted-foreground">
                            {option.example}
                          </div>
                        </div>
                        {active && (
                          <span
                            className="text-primary"
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          size="lg"
          className="mt-8 w-full"
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </main>
    </ProtectedRoute>
  );
}
