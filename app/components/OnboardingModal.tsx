"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";

import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { settingsApi, SettingsUpdate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const URL_PLACEHOLDER = "http://localhost:11434";

interface Preset {
  label: string;
  url: string;
  model: string;
}

// The local Ollama preset points at the server's configured default endpoint,
// not a hard-coded localhost. In Docker/hosted deployments the backend resolves
// `localhost` to itself, not the user's machine, so a static localhost preset
// would save a broken config (the Docker host is `host.docker.internal`).
//
// Embedding presets are limited to models that produce 1024-dimensional
// vectors — the pgvector column width. The test endpoint verifies this,
// but presets shouldn't steer users into a broken configuration.
const buildGenerationPresets = (ollamaUrl: string): Preset[] => [
  { label: "Ollama (local)", url: ollamaUrl, model: "llama3.1:8b" },
  { label: "OpenAI", url: "https://api.openai.com", model: "gpt-4o-mini" },
];

const buildEmbeddingPresets = (ollamaUrl: string): Preset[] => [
  { label: "Ollama (local)", url: ollamaUrl, model: "mxbai-embed-large" },
  { label: "Voyage AI", url: "https://api.voyageai.com", model: "voyage-3" },
];

interface TestState {
  status: "idle" | "testing" | "ok" | "fail";
  message: string;
}

const IDLE_TEST: TestState = { status: "idle", message: "" };

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

interface SectionFields {
  url: string;
  token: string;
  model: string;
}

export function OnboardingModal() {
  const { user, loading: authLoading } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const { toast } = useToast();
  const router = useRouter();

  const [generation, setGeneration] = useState<SectionFields>({ url: "", token: "", model: "" });
  const [embedding, setEmbedding] = useState<SectionFields>({ url: "", token: "", model: "" });
  const [generationTest, setGenerationTest] = useState<TestState>(IDLE_TEST);
  const [embeddingTest, setEmbeddingTest] = useState<TestState>(IDLE_TEST);
  const [error, setError] = useState("");

  // Monotonic token per section. Editing a field or starting a new test bumps
  // it, so an in-flight probe that resolves late is discarded instead of
  // overwriting state for values the form no longer holds.
  const generationTestSeq = useRef(0);
  const embeddingTestSeq = useRef(0);

  const shouldShow =
    !authLoading &&
    !settingsLoading &&
    !!user &&
    !!settings &&
    !settings.onboarding_completed;

  if (!shouldShow) return null;

  const generationPresets = buildGenerationPresets(settings.default_generation_url);
  const embeddingPresets = buildEmbeddingPresets(settings.default_embedding_url);

  const sectionFor = (type: "generation" | "embedding") =>
    type === "generation"
      ? { fields: generation, setFields: setGeneration, setTest: setGenerationTest, seqRef: generationTestSeq }
      : { fields: embedding, setFields: setEmbedding, setTest: setEmbeddingTest, seqRef: embeddingTestSeq };

  // Any edit invalidates that section's last test result and supersedes any
  // probe still in flight.
  const updateField = (
    type: "generation" | "embedding",
    field: keyof SectionFields,
    value: string,
  ) => {
    const { setFields, setTest, seqRef } = sectionFor(type);
    seqRef.current += 1;
    setFields((prev) => ({ ...prev, [field]: value }));
    setTest(IDLE_TEST);
  };

  const applyPreset = (type: "generation" | "embedding", preset: Preset) => {
    const { setFields, setTest, seqRef } = sectionFor(type);
    seqRef.current += 1;
    setFields((prev) => ({ ...prev, url: preset.url, model: preset.model }));
    setTest(IDLE_TEST);
  };

  const runTest = async (type: "generation" | "embedding") => {
    const { fields, setTest, seqRef } = sectionFor(type);
    if (!isValidUrl(fields.url)) {
      setTest({ status: "fail", message: "Enter a valid http:// or https:// URL first." });
      return;
    }
    const seq = (seqRef.current += 1);
    setTest({ status: "testing", message: "" });
    try {
      const result = await settingsApi.testLLM({
        service_type: type,
        url: fields.url || null,
        api_token: fields.token || null,
        model: fields.model || null,
      });
      // A later edit or test started after this one — drop the stale result.
      if (seqRef.current !== seq) return;
      setTest({ status: result.ok ? "ok" : "fail", message: result.message });
    } catch {
      if (seqRef.current !== seq) return;
      setTest({
        status: "fail",
        message: "The test could not run. Check your connection and try again.",
      });
    }
  };

  const handleSkip = () => {
    updateMutation.mutate(
      { onboarding_completed: true },
      {
        onSuccess: () => {
          toast({
            message: "Using default LLM settings. You can change this anytime in Settings.",
            type: "info",
          });
        },
        onError: () => {
          toast({
            message: "Couldn't skip onboarding. Check your connection and try again.",
            type: "error",
          });
        },
      },
    );
  };

  // The modal blocks everything behind it, so navigating to Settings must
  // also complete onboarding — otherwise the modal reopens on top of the
  // very page it links to.
  const handleGoToSettings = () => {
    updateMutation.mutate(
      { onboarding_completed: true },
      {
        onSuccess: () => router.push("/settings"),
        onError: () => {
          toast({
            message: "Couldn't open Settings. Check your connection and try again.",
            type: "error",
          });
        },
      },
    );
  };

  const handleSave = () => {
    if (!isValidUrl(generation.url) || !isValidUrl(embedding.url)) {
      setError("Please enter valid http:// or https:// URLs.");
      return;
    }
    setError("");

    const update: SettingsUpdate = {
      onboarding_completed: true,
      generation_url: generation.url || null,
      generation_model: generation.model || null,
      embedding_url: embedding.url || null,
      embedding_model: embedding.model || null,
    };
    if (generation.token) update.generation_api_token = generation.token;
    if (embedding.token) update.embedding_api_token = embedding.token;

    updateMutation.mutate(update, {
      onSuccess: () => {
        toast({ message: "LLM settings saved!", type: "success" });
      },
      onError: () => {
        setError("Could not save settings. Please try again.");
      },
    });
  };

  const renderTestRow = (type: "generation" | "embedding", test: TestState) => (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => runTest(type)}
        disabled={test.status === "testing" || updateMutation.isPending}
      >
        {test.status === "testing" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Testing...
          </>
        ) : (
          "Test connection"
        )}
      </Button>
      {(test.status === "ok" || test.status === "fail") && (
        <p
          role="status"
          className={`flex items-start gap-1.5 text-xs ${
            test.status === "ok" ? "text-green-600 dark:text-green-500" : "text-destructive"
          }`}
        >
          {test.status === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{test.message}</span>
        </p>
      )}
    </div>
  );

  const renderPresets = (type: "generation" | "embedding", presets: Preset[]) => (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => applyPreset(type, preset)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );

  return (
    <Dialog open onOpenChange={() => { /* dismiss only via skip/save */ }}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">Welcome to EchoVault</span>
          </div>
          <DialogTitle>Configure your LLM (optional)</DialogTitle>
          <DialogDescription>
            EchoVault uses an LLM for reflections, mood analysis, and semantic
            search. Pick a preset or enter any OpenAI-compatible API — or skip
            and use the server defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Tip: if EchoVault runs in Docker and Ollama runs on your machine,
            use <code className="rounded bg-muted px-1">http://host.docker.internal:11434</code>{" "}
            instead of localhost.
          </p>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Text Generation
              </h3>
              {renderPresets("generation", generationPresets)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-gen-url">API URL</Label>
              <Input
                id="onboard-gen-url"
                type="url"
                value={generation.url}
                onChange={(e) => updateField("generation", "url", e.target.value)}
                placeholder={URL_PLACEHOLDER}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="onboard-gen-token">API Token</Label>
                <Input
                  id="onboard-gen-token"
                  type="password"
                  value={generation.token}
                  onChange={(e) => updateField("generation", "token", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboard-gen-model">Model</Label>
                <Input
                  id="onboard-gen-model"
                  value={generation.model}
                  onChange={(e) => updateField("generation", "model", e.target.value)}
                  placeholder="llama3.1:8b"
                />
              </div>
            </div>
            {renderTestRow("generation", generationTest)}
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Embeddings
              </h3>
              {renderPresets("embedding", embeddingPresets)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-emb-url">API URL</Label>
              <Input
                id="onboard-emb-url"
                type="url"
                value={embedding.url}
                onChange={(e) => updateField("embedding", "url", e.target.value)}
                placeholder={URL_PLACEHOLDER}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="onboard-emb-token">API Token</Label>
                <Input
                  id="onboard-emb-token"
                  type="password"
                  value={embedding.token}
                  onChange={(e) => updateField("embedding", "token", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboard-emb-model">Model</Label>
                <Input
                  id="onboard-emb-model"
                  value={embedding.model}
                  onChange={(e) => updateField("embedding", "model", e.target.value)}
                  placeholder="mxbai-embed-large"
                />
              </div>
            </div>
            {renderTestRow("embedding", embeddingTest)}
          </section>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Need help? Open{" "}
            <button
              type="button"
              onClick={handleGoToSettings}
              disabled={updateMutation.isPending}
              className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
            >
              full Settings
            </button>{" "}
            for advanced options.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={updateMutation.isPending}
          >
            Skip — use defaults
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & continue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
