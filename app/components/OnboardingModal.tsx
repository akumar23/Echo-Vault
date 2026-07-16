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
const buildGenerationPresets = (ollamaUrl: string): Preset[] => [
  { label: "Ollama (local)", url: ollamaUrl, model: "llama3.1:8b" },
  { label: "OpenAI", url: "https://api.openai.com", model: "gpt-4o-mini" },
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
  const [generationTest, setGenerationTest] = useState<TestState>(IDLE_TEST);
  const [error, setError] = useState("");

  // Monotonic token. Editing a field or starting a new test bumps
  // it, so an in-flight probe that resolves late is discarded instead of
  // overwriting state for values the form no longer holds.
  const generationTestSeq = useRef(0);

  const shouldShow =
    !authLoading &&
    !settingsLoading &&
    !!user &&
    !!settings &&
    !settings.onboarding_completed;

  if (!shouldShow) return null;

  const generationPresets = buildGenerationPresets(settings.default_generation_url);

  // Any edit invalidates the last test result and supersedes any
  // probe still in flight.
  const updateField = (
    field: keyof SectionFields,
    value: string,
  ) => {
    generationTestSeq.current += 1;
    setGeneration((prev) => ({ ...prev, [field]: value }));
    setGenerationTest(IDLE_TEST);
  };

  const applyPreset = (preset: Preset) => {
    generationTestSeq.current += 1;
    setGeneration((prev) => ({ ...prev, url: preset.url, model: preset.model }));
    setGenerationTest(IDLE_TEST);
  };

  const runTest = async () => {
    if (!isValidUrl(generation.url)) {
      setGenerationTest({ status: "fail", message: "Enter a valid http:// or https:// URL first." });
      return;
    }
    const seq = (generationTestSeq.current += 1);
    setGenerationTest({ status: "testing", message: "" });
    try {
      const result = await settingsApi.testLLM({
        service_type: "generation",
        url: generation.url || null,
        api_token: generation.token || null,
        model: generation.model || null,
      });
      // A later edit or test started after this one — drop the stale result.
      if (generationTestSeq.current !== seq) return;
      setGenerationTest({ status: result.ok ? "ok" : "fail", message: result.message });
    } catch {
      if (generationTestSeq.current !== seq) return;
      setGenerationTest({
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
    if (!isValidUrl(generation.url)) {
      setError("Please enter valid http:// or https:// URLs.");
      return;
    }
    setError("");

    const update: SettingsUpdate = {
      onboarding_completed: true,
      generation_url: generation.url || null,
      generation_model: generation.model || null,
    };
    if (generation.token) update.generation_api_token = generation.token;

    updateMutation.mutate(update, {
      onSuccess: () => {
        toast({ message: "LLM settings saved!", type: "success" });
      },
      onError: () => {
        setError("Could not save settings. Please try again.");
      },
    });
  };

  const renderTestRow = (test: TestState) => (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={runTest}
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

  const renderPresets = (presets: Preset[]) => (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => applyPreset(preset)}
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
            EchoVault uses an LLM for reflections, mood analysis, insights,
            and chat. Pick a preset or enter any OpenAI-compatible API — or skip
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
              {renderPresets(generationPresets)}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-gen-url">API URL</Label>
              <Input
                id="onboard-gen-url"
                type="url"
                value={generation.url}
                onChange={(e) => updateField("url", e.target.value)}
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
                  onChange={(e) => updateField("token", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="onboard-gen-model">Model</Label>
                <Input
                  id="onboard-gen-model"
                  value={generation.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  placeholder="llama3.1:8b"
                />
              </div>
            </div>
            {renderTestRow(generationTest)}
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
